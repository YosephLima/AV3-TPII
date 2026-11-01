import type { Avaliacao } from '../../dominio/Avaliacao';
import type { Profissional } from '../../dominio/Profissional';
import type { RepositorioProfissionais } from '../../repositorio/RepositorioProfissionais';
import {
  atendeCriterios,
  ProfissionalNaoEncontradoError,
  type AdaptadorProfissional,
  type CriteriosBusca,
} from './AdaptadorProfissional';

/** O cadastro próprio da plataforma (PostgreSQL com reserva em memória) visto pela mesma interface. */
export class AdaptadorInterno implements AdaptadorProfissional {
  readonly provedor = 'interno';

  constructor(private readonly repositorio: RepositorioProfissionais) {}

  async listarProfissionais(criterios?: CriteriosBusca): Promise<Profissional[]> {
    return (await this.repositorio.listar()).filter((p) => atendeCriterios(p, criterios));
  }

  async detalharProfissional(id: string): Promise<Profissional> {
    const encontrado = (await this.repositorio.listar()).find((p) => p.id === id);
    if (!encontrado) throw new ProfissionalNaoEncontradoError(id);
    return encontrado;
  }

  async registrarAvaliacao(id: string, avaliacao: Avaliacao): Promise<void> {
    await this.detalharProfissional(id);
    await this.repositorio.registrarAvaliacao(id, avaliacao);
  }
}
