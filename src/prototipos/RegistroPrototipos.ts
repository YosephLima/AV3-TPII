import type { AjustesProjeto, Projeto } from '../dominio/Projeto';

export class ModeloDesconhecidoError extends Error {
  constructor(nome: string) {
    super(`Modelo de projeto desconhecido: ${nome}`);
    this.name = 'ModeloDesconhecidoError';
  }
}

/** Modelos prontos, clonados para criar projetos novos. */
export class RegistroPrototipos<P extends Projeto = Projeto> {
  private readonly modelos = new Map<string, P>();

  registrar(nome: string, prototipo: P): this {
    this.modelos.set(nome, prototipo);
    return this;
  }

  nomes(): string[] {
    return [...this.modelos.keys()];
  }

  modelo(nome: string): P {
    const prototipo = this.modelos.get(nome);
    if (!prototipo) throw new ModeloDesconhecidoError(nome);
    return prototipo;
  }

  /** O modelo registrado nunca é alterado. */
  clonar(nome: string, ajustes: AjustesProjeto = {}): P {
    return this.modelo(nome).clonar(ajustes) as P;
  }
}
