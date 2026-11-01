import { createHash } from 'node:crypto';
import type { Recomendacoes } from '../dominio/Equipe';
import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';
import type { RecomendacaoStrategy } from '../estrategias/RecomendacaoStrategy';
import { DecoradorRecomendacao } from './DecoradorRecomendacao';

export interface OpcoesCache {
  /** Quantas recomendações ficam guardadas; a mais antiga sai primeiro. */
  capacidade?: number;
  validadeMs?: number;
  agora?: () => number;
}

/**
 * O conteúdo do cache fica fora do decorador, para sobreviver quando a pilha é montada de novo a cada
 * requisição. Tem limite de tamanho e validade, então não cresce sem fim.
 */
export class ArmazemCache {
  private readonly entradas = new Map<string, { valor: Recomendacoes; expiraEm: number }>();
  private readonly capacidade: number;
  private readonly validadeMs: number;
  private readonly agora: () => number;
  acertos = 0;
  falhas = 0;

  constructor({ capacidade = 500, validadeMs = 10 * 60_000, agora = Date.now }: OpcoesCache = {}) {
    this.capacidade = capacidade;
    this.validadeMs = validadeMs;
    this.agora = agora;
  }

  get tamanho(): number {
    return this.entradas.size;
  }

  ler(chave: string): Recomendacoes | undefined {
    const entrada = this.entradas.get(chave);
    if (!entrada || entrada.expiraEm <= this.agora()) {
      this.entradas.delete(chave);
      this.falhas += 1;
      return undefined;
    }
    this.acertos += 1;
    return entrada.valor;
  }

  gravar(chave: string, valor: Recomendacoes): void {
    this.entradas.delete(chave);
    this.entradas.set(chave, { valor, expiraEm: this.agora() + this.validadeMs });
    const maisAntiga = this.entradas.keys().next().value;
    if (this.entradas.size > this.capacidade && maisAntiga !== undefined) this.entradas.delete(maisAntiga);
  }

  limpar(): void {
    this.entradas.clear();
  }
}

/**
 * Devolve a recomendação já calculada para um pedido equivalente. A chave considera tudo o que muda o
 * resultado (estratégia, orçamento, requisitos de cada papel e dados dos candidatos), mas não o id nem o nome
 * do projeto: projetos parecidos aproveitam o mesmo resultado.
 */
export class CacheDecorator extends DecoradorRecomendacao {
  protected readonly camada = 'cache';

  constructor(
    recomendador: RecomendacaoStrategy,
    private readonly cache: ArmazemCache = new ArmazemCache(),
  ) {
    super(recomendador);
  }

  recomendar(projeto: Projeto, profissionais: Profissional[]): Recomendacoes {
    const chave = chaveDoPedido(this.nome, projeto, profissionais);
    const guardada = this.cache.ler(chave);
    if (guardada) return copiar(guardada);

    const recomendacoes = this.recomendador.recomendar(projeto, profissionais);
    this.cache.gravar(chave, copiar(recomendacoes));
    return recomendacoes;
  }
}

export function chaveDoPedido(estrategia: string, projeto: Projeto, profissionais: Profissional[]): string {
  const pedido = {
    estrategia,
    orcamento: projeto.orcamento,
    papeis: projeto.papeis.map((r) => [r.papel, r.custo, r.competenciasDesejadas.map((c) => [c.nome, c.nivel])]),
    candidatos: profissionais.map((p) => [
      p.id,
      p.precoMedio,
      p.especialidades,
      p.competencias.map((c) => [c.nome, c.nivel]),
      p.avaliacoes.map((a) => a.nota),
    ]),
  };
  return createHash('sha256').update(JSON.stringify(pedido)).digest('hex');
}

/** Quem recebe pode mexer nas listas sem estragar o que está guardado. */
function copiar(recomendacoes: Recomendacoes): Recomendacoes {
  return new Map([...recomendacoes].map(([papel, ranking]) => [papel, [...ranking]]));
}
