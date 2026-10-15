import type { Recomendacoes } from '../dominio/Equipe';
import type { Profissional } from '../dominio/Profissional';
import type { Projeto, RequisitoPapel } from '../dominio/Projeto';

/** Strategy: devolve, para cada papel, os profissionais em ordem de preferência. */
export interface RecomendacaoStrategy {
  readonly nome: string;
  recomendar(projeto: Projeto, profissionais: Profissional[]): Recomendacoes;
}

/** Maior pontuação primeiro. */
export function ranquearPorPapel(
  projeto: Projeto,
  profissionais: Profissional[],
  pontuar: (requisito: RequisitoPapel, profissional: Profissional) => number,
): Recomendacoes {
  const recomendacoes: Recomendacoes = new Map();
  for (const requisito of projeto.papeis) {
    const ranking = profissionais
      .filter((p) => p.atuaComo(requisito.papel))
      .map((p) => ({ p, pontos: pontuar(requisito, p) }))
      .sort((a, b) => b.pontos - a.pontos)
      .map(({ p }) => p);
    recomendacoes.set(requisito.papel, ranking);
  }
  return recomendacoes;
}
