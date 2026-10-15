import type { Profissional } from '../dominio/Profissional';
import type { RepositorioProfissionais } from './RepositorioProfissionais';

/** Se o principal falhar, usa o reserva. */
export class RepositorioComReserva implements RepositorioProfissionais {
  constructor(
    private readonly principal: RepositorioProfissionais,
    private readonly reserva: RepositorioProfissionais,
    private readonly aoFalhar: (erro: unknown) => void = (erro) => console.error('Cadastro principal indisponível:', erro),
  ) {}

  async listar(): Promise<Profissional[]> {
    try {
      return await this.principal.listar();
    } catch (erro) {
      this.aoFalhar(erro);
      return this.reserva.listar();
    }
  }
}
