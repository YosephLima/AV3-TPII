import type { Avaliacao } from '../dominio/Avaliacao';
import type { Profissional } from '../dominio/Profissional';

export interface RepositorioProfissionais {
  listar(): Promise<Profissional[]>;
  registrarAvaliacao(profissionalId: string, avaliacao: Avaliacao): Promise<void>;
}

export class RepositorioProfissionaisMemoria implements RepositorioProfissionais {
  constructor(private readonly profissionais: Profissional[]) {}

  async listar(): Promise<Profissional[]> {
    return [...this.profissionais];
  }

  async registrarAvaliacao(profissionalId: string, avaliacao: Avaliacao): Promise<void> {
    this.profissionais.find((p) => p.id === profissionalId)?.avaliacoes.push(avaliacao);
  }
}
