import type { Profissional } from '../dominio/Profissional';

export interface RepositorioProfissionais {
  listar(): Promise<Profissional[]>;
}

export class RepositorioProfissionaisMemoria implements RepositorioProfissionais {
  constructor(private readonly profissionais: Profissional[]) {}

  async listar(): Promise<Profissional[]> {
    return [...this.profissionais];
  }
}
