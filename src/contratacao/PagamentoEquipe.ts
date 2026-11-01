import type { AdaptadorPagamento } from '../adaptadores/pagamento/AdaptadorPagamento';
import type { Equipe } from '../dominio/Equipe';
import type { Projeto } from '../dominio/Projeto';

/** Paga cada membro quando a equipe é formada e estorna se a equipe for descartada. */
export class PagamentoEquipe {
  constructor(private readonly pagamento: AdaptadorPagamento) {}

  /** Do produtor para cada profissional, pelo preço médio dele. Quem já foi pago fica de fora. */
  async pagar(projeto: Projeto, equipe: Equipe): Promise<void> {
    for (const membro of equipe.membros) {
      if (membro.pagamentoId) continue;
      const { precoMedio, id } = membro.profissional;
      membro.pagamentoId = await this.pagamento.efetuarPagamento(precoMedio, projeto.produtor, id);
    }
  }

  /** Devolve quantos pagamentos foram cancelados. */
  async estornar(equipe: Equipe): Promise<number> {
    let cancelados = 0;
    for (const membro of equipe.membros) {
      if (membro.pagamentoId && (await this.pagamento.cancelarPagamento(membro.pagamentoId))) cancelados += 1;
    }
    return cancelados;
  }
}
