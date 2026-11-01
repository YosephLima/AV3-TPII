import { randomUUID } from 'node:crypto';

/**
 * Imita o formato da API do Stripe: valores inteiros em centavos, ids com prefixo (pi_, re_), status em
 * inglês e estorno feito por um recurso separado (refunds). Um pagamento estornado continua "succeeded",
 * só ganha amount_refunded.
 */
export type StatusIntent = 'succeeded' | 'processing' | 'requires_payment_method' | 'canceled';

export interface PaymentIntent {
  id: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  customer: string;
  status: StatusIntent;
  transfer_data: { destination: string };
}

export class StripeInvalidRequestError extends Error {
  override readonly name = 'StripeInvalidRequestError';

  constructor(
    readonly code: 'resource_missing' | 'amount_too_small' | 'parameter_invalid_integer' | 'charge_already_refunded',
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export class StripeSimulado {
  /** Clientes cujo cartão é recusado. */
  constructor(private readonly recusados: string[] = []) {}

  private readonly intents = new Map<string, PaymentIntent>();

  readonly paymentIntents = {
    create: async (params: {
      amount: number;
      currency: string;
      customer: string;
      transfer_data: { destination: string };
    }): Promise<PaymentIntent> => {
      if (!Number.isInteger(params.amount)) {
        throw new StripeInvalidRequestError('parameter_invalid_integer', 'Invalid integer: amount');
      }
      if (params.amount < 50) throw new StripeInvalidRequestError('amount_too_small', 'Amount must be at least 50 cents');
      const intent: PaymentIntent = {
        id: `pi_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
        amount: params.amount,
        amount_refunded: 0,
        currency: params.currency,
        customer: params.customer,
        status: this.recusados.includes(params.customer) ? 'requires_payment_method' : 'succeeded',
        transfer_data: params.transfer_data,
      };
      this.intents.set(intent.id, intent);
      return { ...intent };
    },

    retrieve: async (id: string): Promise<PaymentIntent> => ({ ...this.intent(id) }),
  };

  readonly refunds = {
    create: async (params: { payment_intent: string }): Promise<{ id: string; status: 'succeeded' }> => {
      const intent = this.intent(params.payment_intent);
      if (intent.amount_refunded >= intent.amount) {
        throw new StripeInvalidRequestError('charge_already_refunded', 'Charge has already been refunded');
      }
      intent.amount_refunded = intent.amount;
      return { id: `re_${randomUUID().replaceAll('-', '').slice(0, 24)}`, status: 'succeeded' };
    },
  };

  private intent(id: string): PaymentIntent {
    const intent = this.intents.get(id);
    if (!intent) throw new StripeInvalidRequestError('resource_missing', `No such payment_intent: '${id}'`);
    return intent;
  }
}
