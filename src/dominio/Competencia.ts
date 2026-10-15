/** Nível de 0 a 10. */
export class Competencia {
  constructor(
    readonly nome: string,
    readonly nivel: number,
  ) {}
}

export type VetorCompetencia = Map<string, number>;

export function vetorDe(competencias: readonly Competencia[]): VetorCompetencia {
  return new Map(competencias.map((c) => [c.nome.trim().toLowerCase(), c.nivel]));
}

/** Dá 0 se algum dos vetores for nulo. */
export function cosseno(a: VetorCompetencia, b: VetorCompetencia): number {
  let produto = 0;
  for (const [nome, valor] of a) produto += valor * (b.get(nome) ?? 0);
  const norma = (v: VetorCompetencia) => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0));
  const divisor = norma(a) * norma(b);
  return divisor === 0 ? 0 : produto / divisor;
}
