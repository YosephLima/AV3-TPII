import type { FabricaProjeto } from './FabricaProjeto';

export class TipoDesconhecidoError extends Error {
  constructor(tipo: string) {
    super(`Tipo de projeto desconhecido: ${tipo}`);
    this.name = 'TipoDesconhecidoError';
  }
}

/** Registrar a fábrica é tudo o que um tipo novo precisa. */
export class RegistroFabricas {
  private readonly fabricas = new Map<string, FabricaProjeto>();

  registrar(fabrica: FabricaProjeto): this {
    this.fabricas.set(fabrica.tipo, fabrica);
    return this;
  }

  para(tipo: string): FabricaProjeto {
    const fabrica = this.fabricas.get(tipo);
    if (!fabrica) throw new TipoDesconhecidoError(tipo);
    return fabrica;
  }

  tipos(): string[] {
    return [...this.fabricas.keys()];
  }

  todas(): FabricaProjeto[] {
    return [...this.fabricas.values()];
  }
}
