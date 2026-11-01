import type { PagSeguroSimulado } from '../../externos/PagSeguroSimulado';
import {
  PagamentoInvalidoError,
  PagamentoNaoEncontradoError,
  type AdaptadorPagamento,
  type StatusPagamento,
} from './AdaptadorPagamento';

const STATUS = {
  AGUARDANDO_PAGAMENTO: 'pendente',
  PAGA: 'aprovado',
  NEGADA: 'recusado',
  ESTORNADA: 'cancelado',
} as const satisfies Record<string, StatusPagamento>;

export class AdaptadorPagSeguro implements AdaptadorPagamento {
  readonly provedor = 'pagseguro';

  constructor(private readonly pagseguro: PagSeguroSimulado) {}

  async efetuarPagamento(valor: number, origem: string, destino: string): Promise<string> {
    const resposta = await this.pagseguro.criarCobranca({
      valor: valor.toFixed(2),
      pagador: { email: origem },
      recebedor: destino,
    });
    if (!resposta.sucesso) throw new PagamentoInvalidoError(resposta.erro);
    return resposta.cobranca.codigo;
  }

  async cancelarPagamento(id: string): Promise<boolean> {
    return (await this.pagseguro.estornar(id)).sucesso;
  }

  async verificarPagamento(id: string): Promise<StatusPagamento> {
    const cobranca = await this.pagseguro.consultar(id);
    if (!cobranca) throw new PagamentoNaoEncontradoError(id);
    return STATUS[cobranca.situacao];
  }
}
