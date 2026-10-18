/** Os detalhes chegam sem tipagem (do corpo da requisição), então cada leitura confere o formato. */
export type Detalhes = Record<string, unknown>;

export class DetalheInvalidoError extends Error {
  constructor(campo: string, esperado: string) {
    super(`O detalhe "${campo}" deve ser ${esperado}`);
    this.name = 'DetalheInvalidoError';
  }
}

export function texto(detalhes: Detalhes, campo: string): string | undefined {
  const valor = detalhes[campo];
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string') throw new DetalheInvalidoError(campo, 'um texto');
  return valor;
}

export function numero(detalhes: Detalhes, campo: string): number | undefined {
  const valor = detalhes[campo];
  if (valor === undefined) return undefined;
  if (typeof valor !== 'number' || Number.isNaN(valor)) throw new DetalheInvalidoError(campo, 'um número');
  return valor;
}

export function listaDeTextos(detalhes: Detalhes, campo: string): string[] | undefined {
  const valor = detalhes[campo];
  if (valor === undefined) return undefined;
  if (!Array.isArray(valor) || !valor.every((item) => typeof item === 'string')) {
    throw new DetalheInvalidoError(campo, 'uma lista de textos');
  }
  return valor;
}
