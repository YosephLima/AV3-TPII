import { describe, expect, it } from 'vitest';
import { profissionaisIniciais } from '../src/dados/profissionais';
import type { Recomendacoes } from '../src/dominio/Equipe';
import { Papel } from '../src/dominio/Papel';
import type { Profissional } from '../src/dominio/Profissional';
import type { Projeto } from '../src/dominio/Projeto';
import type { RecomendacaoStrategy } from '../src/estrategias/RecomendacaoStrategy';
import { SimilaridadeCosseno } from '../src/estrategias/SimilaridadeCosseno';
import { OrquestradorEquipe, ProjetoInvalidoError } from '../src/orquestracao/OrquestradorEquipe';
import { OrquestradorPadrao } from '../src/orquestracao/OrquestradorPadrao';
import { RepositorioProfissionaisMemoria } from '../src/repositorio/RepositorioProfissionais';
import { criarProjeto, PRAZO, requisito } from './fixtures';

const repositorio = () => new RepositorioProfissionaisMemoria(profissionaisIniciais());

/** Só anota a ordem em que o template chama as etapas. */
class OrquestradorEspiao extends OrquestradorEquipe {
  readonly passos: string[] = [];

  constructor(private readonly valido = true) {
    super(repositorio());
  }

  protected validarRestricoes(): boolean {
    this.passos.push('validar');
    return this.valido;
  }

  protected normalizarDados(_projeto: Projeto, profissionais: Profissional[]): Profissional[] {
    this.passos.push('normalizar');
    return profissionais;
  }

  protected posProcessar(_projeto: Projeto, recomendacoes: Recomendacoes): Recomendacoes {
    this.passos.push('posProcessar');
    return recomendacoes;
  }
}

const estrategiaEspia = (passos: string[]): RecomendacaoStrategy => ({
  nome: 'espia',
  recomendar: (projeto, profissionais) => {
    passos.push('recomendar');
    return new SimilaridadeCosseno().recomendar(projeto, profissionais);
  },
});

describe('Template Method', () => {
  it('orquestrar executa as etapas sempre na mesma ordem, seja qual for a subclasse', async () => {
    const orquestrador = new OrquestradorEspiao();
    const equipe = await orquestrador.orquestrar(criarProjeto(), estrategiaEspia(orquestrador.passos));

    expect(orquestrador.passos).toEqual(['validar', 'normalizar', 'recomendar', 'posProcessar']);
    expect(equipe.membros).toHaveLength(5);
  });

  it('interrompe o fluxo antes de recomendar quando as restrições não são atendidas', async () => {
    const orquestrador = new OrquestradorEspiao(false);
    await expect(orquestrador.orquestrar(criarProjeto(), estrategiaEspia(orquestrador.passos))).rejects.toThrow(
      ProjetoInvalidoError,
    );
    expect(orquestrador.passos).toEqual(['validar']);
  });

  it('pode restringir a rodada a alguns papéis e excluir profissionais', async () => {
    const orquestrador = new OrquestradorPadrao(repositorio());
    const equipe = await orquestrador.orquestrar(criarProjeto(), new SimilaridadeCosseno(), {
      papeis: [Papel.SONOPLASTA],
      excluir: ['p07'],
    });

    expect(equipe.membros.map((m) => [m.papel, m.profissional.id])).toEqual([[Papel.SONOPLASTA, 'p08']]);
  });
});

describe('OrquestradorPadrao', () => {
  const orquestrador = new OrquestradorPadrao(repositorio());

  it('recusa animação sem especialista em efeitos visuais', async () => {
    const animacao = criarProjeto({ tipoCaptacao: 'animacao' });
    await expect(orquestrador.orquestrar(animacao, new SimilaridadeCosseno())).rejects.toThrow(ProjetoInvalidoError);
  });

  it('recusa orçamento zerado ou papel sem peso', async () => {
    const semOrcamento = criarProjeto({ restricoes: { orcamento: 0, prazo: PRAZO, localizacao: 'SP' } });
    const semPeso = criarProjeto({ papeis: [requisito(Papel.DIRETOR, 0)] });
    await expect(orquestrador.orquestrar(semOrcamento, new SimilaridadeCosseno())).rejects.toThrow(ProjetoInvalidoError);
    await expect(orquestrador.orquestrar(semPeso, new SimilaridadeCosseno())).rejects.toThrow(ProjetoInvalidoError);
  });

  it('descarta quem só fica disponível depois do prazo', async () => {
    const projeto = criarProjeto({ papeis: [requisito(Papel.DIRETOR_FOTOGRAFIA, 1, ['iluminacao', 8], ['camera', 8])] });
    const equipe = await orquestrador.orquestrar(projeto, new SimilaridadeCosseno());
    // Fábio Nunes (p06) só começa em 2027-06-01, depois do prazo.
    expect(equipe.ranking.get(Papel.DIRETOR_FOTOGRAFIA)?.map((p) => p.id)).not.toContain('p06');
  });

  it('não escala a mesma pessoa para dois papéis; o papel de maior peso escolhe primeiro', async () => {
    // Bruno (p02) é o melhor candidato tanto a diretor quanto a roteirista.
    const projeto = criarProjeto({
      papeis: [
        requisito(Papel.ROTEIRISTA, 5, ['roteiro', 8], ['documentario', 9], ['narrativa', 9]),
        requisito(Papel.DIRETOR, 2, ['documentario', 9]),
      ],
    });
    const equipe = await orquestrador.orquestrar(projeto, new SimilaridadeCosseno());

    expect(equipe.membro(Papel.ROTEIRISTA)?.profissional.id).toBe('p02');
    expect(equipe.membro(Papel.DIRETOR)?.profissional.id).not.toBe('p02');
    expect(equipe.ranking.get(Papel.DIRETOR)?.map((p) => p.id)).not.toContain('p02');
    expect([...equipe.ranking.keys()]).toEqual([Papel.ROTEIRISTA, Papel.DIRETOR]);
  });

  it('limita as alternativas exibidas por papel', async () => {
    const equipe = await orquestrador.orquestrar(criarProjeto(), new SimilaridadeCosseno());
    for (const ranking of equipe.ranking.values()) {
      expect(ranking.length).toBeLessThanOrEqual(OrquestradorPadrao.ALTERNATIVAS_POR_PAPEL);
    }
  });
});
