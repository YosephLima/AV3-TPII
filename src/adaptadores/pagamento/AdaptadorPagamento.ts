/** Os status de cada provedor são traduzidos para estes quatro. */
export type StatusPagamento = 'aprovado' | 'pendente' | 'recusado' | 'cancelado';

/** Adapter: valores sempre em reais; o adaptador converte para o formato do provedor. */
export interface AdaptadorPagamento {
  readonly provedor: string;
  /** Devolve o id do pagamento no provedor. */
  efetuarPagamento(valor: number, origem: string, destino: string): Promise<string>;
  /** false se o pagamento não existe ou já não pode ser cancelado. */
  cancelarPagamento(id: string): Promise<boolean>;
  verificarPagamento(id: string): Promise<StatusPagamento>;
}

export class PagamentoNaoEncontradoError extends Error {
  constructor(id: string) {
    super(`Pagamento não encontrado: ${id}`);
    this.name = 'PagamentoNaoEncontradoError';
  }
}

export class PagamentoInvalidoError extends Error {
  constructor(motivo: string) {
    super(`Pagamento não aceito pelo provedor: ${motivo}`);
    this.name = 'PagamentoInvalidoError';
  }
}
