import type { Avaliacao } from '../../dominio/Avaliacao';
import type { Papel } from '../../dominio/Papel';
import type { Profissional } from '../../dominio/Profissional';

export interface CriteriosBusca {
  /** Quem atua em pelo menos um destes papéis. */
  papeis?: Papel[];
  localizacao?: string;
}

/** Adapter: qualquer fonte de cadastro devolve profissionais do nosso domínio. */
export interface AdaptadorProfissional {
  readonly provedor: string;
  listarProfissionais(criterios?: CriteriosBusca): Promise<Profissional[]>;
  detalharProfissional(id: string): Promise<Profissional>;
  registrarAvaliacao(id: string, avaliacao: Avaliacao): Promise<void>;
}

export class ProfissionalNaoEncontradoError extends Error {
  constructor(id: string) {
    super(`Profissional não encontrado: ${id}`);
    this.name = 'ProfissionalNaoEncontradoError';
  }
}

export function atendeCriterios(profissional: Profissional, criterios: CriteriosBusca = {}): boolean {
  return (
    (!criterios.papeis || criterios.papeis.some((papel) => profissional.atuaComo(papel))) &&
    (!criterios.localizacao || profissional.localizacao === criterios.localizacao)
  );
}
