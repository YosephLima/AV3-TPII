import { StripeInvalidRequestError, type StripeSimulado } from '../../externos/StripeSimulado';
import {
  PagamentoInvalidoError,
  PagamentoNaoEncontradoError,
  type AdaptadorPagamento,
  type StatusPagamento,
} from './AdaptadorPagamento';

export class AdaptadorStripe implements AdaptadorPagamento {
  readonly provedor = 'stripe';

  constructor(private readonly stripe: StripeSimulado) {}

  async efetuarPagamento(valor: number, origem: string, destino: string): Promise<string> {
    try {
      const intent = await this.stripe.paymentIntents.create({
        amount: Math.round(valor * 100),
        currency: 'brl',
        customer: origem,
        transfer_data: { destination: destino },
      });
      return intent.id;
    } catch (erro) {
      if (erro instanceof StripeInvalidRequestError) throw new PagamentoInvalidoError(erro.code);
      throw erro;
    }
  }

  /** No Stripe, cancelar um pagamento já aprovado é criar um estorno. */
  async cancelarPagamento(id: string): Promise<boolean> {
    try {
      const intent = await this.stripe.paymentIntents.retrieve(id);
      if (intent.status !== 'succeeded' || intent.amount_refunded >= intent.amount) return false;
      await this.stripe.refunds.create({ payment_intent: id });
      return true;
    } catch (erro) {
      if (erro instanceof StripeInvalidRequestError && erro.code === 'resource_missing') return false;
      throw erro;
    }
  }

  async verificarPagamento(id: string): Promise<StatusPagamento> {
    let intent;
    try {
      intent = await this.stripe.paymentIntents.retrieve(id);
    } catch (erro) {
      if (erro instanceof StripeInvalidRequestError && erro.code === 'resource_missing') {
        throw new PagamentoNaoEncontradoError(id);
      }
      throw erro;
    }
    // Estornado continua "succeeded" no Stripe; para nós é cancelado.
    if (intent.amount_refunded >= intent.amount) return 'cancelado';
    switch (intent.status) {
      case 'succeeded':
        return 'aprovado';
      case 'processing':
        return 'pendente';
      case 'requires_payment_method':
        return 'recusado';
      case 'canceled':
        return 'cancelado';
    }
  }
}
