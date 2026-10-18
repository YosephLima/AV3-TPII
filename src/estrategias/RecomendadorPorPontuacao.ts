import { cosseno, vetorDe } from '../dominio/Competencia';
import type { Recomendacoes } from '../dominio/Equipe';
import type { Profissional } from '../dominio/Profissional';
import type { Projeto, RequisitoPapel } from '../dominio/Projeto';
import type { RecomendacaoStrategy } from './RecomendacaoStrategy';

/**
 * Base dos recomendadores das famílias: respeita a fatia do orçamento de cada papel e ordena pela pontuação
 * de cada família.
 */
export abstract class RecomendadorPorPontuacao implements RecomendacaoStrategy {
  abstract readonly nome: string;

  recomendar(projeto: Projeto, profissionais: Profissional[]): Recomendacoes {
    const recomendacoes: Recomendacoes = new Map();
    for (const requisito of projeto.papeis) {
      const teto = projeto.tetoPorPapel(requisito.papel);
      const ranking = profissionais
        .filter((p) => p.atuaComo(requisito.papel) && p.precoMedio <= teto)
        .map((p) => ({ p, pontos: this.pontuar(requisito, p) }))
        .sort((a, b) => b.pontos - a.pontos)
        .map(({ p }) => p);
      recomendacoes.set(requisito.papel, ranking);
    }
    return recomendacoes;
  }

  protected abstract pontuar(requisito: RequisitoPapel, profissional: Profissional): number;

  /** Cosseno entre o que o papel pede e o que o profissional sabe (0 a 1). */
  protected aderencia(requisito: RequisitoPapel, profissional: Profissional): number {
    return cosseno(vetorDe(requisito.competenciasDesejadas), profissional.vetorCompetencias());
  }

  /** De 0 a 1. */
  protected nivelEm(profissional: Profissional, competencia: string): number {
    return (profissional.vetorCompetencias().get(competencia) ?? 0) / 10;
  }
}
