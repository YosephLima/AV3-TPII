import type { AdaptadorProfissional } from '../adaptadores/profissionais/AdaptadorProfissional';
import { Equipe, MembroEquipe, type Recomendacoes } from '../dominio/Equipe';
import type { Papel } from '../dominio/Papel';
import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';
import type { RecomendacaoStrategy } from '../estrategias/RecomendacaoStrategy';
import type { FabricaProjeto } from '../fabricas/FabricaProjeto';

export class ProjetoInvalidoError extends Error {
  constructor(
    projeto: Projeto,
    readonly motivos: string[] = [],
  ) {
    const detalhe = motivos.length > 0 ? `: ${motivos.join('; ')}` : ' para recomendação';
    super(`O projeto ${projeto.nome} não atende às restrições${detalhe}`);
    this.name = 'ProjetoInvalidoError';
  }
}

export interface OpcoesOrquestracao {
  /** Só estes papéis entram na rodada. */
  papeis?: Papel[];
  /** Profissionais que ficam de fora da rodada. */
  excluir?: string[];
}

/**
 * Template Method: orquestrar() fixa a ordem das etapas e as subclasses implementam cada uma. O que depende
 * do tipo de projeto vem da fábrica.
 */
export abstract class OrquestradorEquipe {
  constructor(
    protected readonly fabrica: FabricaProjeto,
    protected readonly profissionais: AdaptadorProfissional,
  ) {}

  /** Sem estratégia, usa o recomendador da família. */
  async orquestrar(
    projeto: Projeto,
    estrategia: RecomendacaoStrategy = this.fabrica.criarRecomendador(),
    opcoes: OpcoesOrquestracao = {},
  ): Promise<Equipe> {
    if (!this.validarRestricoes(projeto)) throw new ProjetoInvalidoError(projeto);

    const excluidos = new Set(opcoes.excluir ?? []);
    const papeis = projeto.papeis.map((r) => r.papel);
    const cadastrados = (await this.profissionais.listarProfissionais({ papeis })).filter((p) => !excluidos.has(p.id));
    const candidatos = this.normalizarDados(projeto, cadastrados);

    let recomendacoes = estrategia.recomendar(projeto, candidatos);
    if (opcoes.papeis) {
      const papeis = opcoes.papeis;
      recomendacoes = new Map([...recomendacoes].filter(([papel]) => papeis.includes(papel)));
    }

    return this.montarEquipe(this.posProcessar(projeto, recomendacoes));
  }

  protected abstract validarRestricoes(projeto: Projeto): boolean;

  protected abstract normalizarDados(projeto: Projeto, profissionais: Profissional[]): Profissional[];

  protected abstract posProcessar(projeto: Projeto, recomendacoes: Recomendacoes): Recomendacoes;

  private montarEquipe(recomendacoes: Recomendacoes): Equipe {
    const membros: MembroEquipe[] = [];
    for (const [papel, ranking] of recomendacoes) {
      const escolhido = ranking[0];
      if (escolhido) membros.push(new MembroEquipe(papel, escolhido));
    }
    return new Equipe(membros, recomendacoes);
  }
}
