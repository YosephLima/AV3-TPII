/**
 * Imita um gateway brasileiro no estilo do PagSeguro: valor em texto com duas casas ("1234.50"), situação
 * em português e nenhuma exceção (as falhas voltam no corpo da resposta, e uma cobrança inexistente volta
 * como null).
 */
export type Situacao = 'AGUARDANDO_PAGAMENTO' | 'PAGA' | 'NEGADA' | 'ESTORNADA';

export interface Cobranca {
  codigo: string;
  valor: string;
  pagador: { email: string };
  recebedor: string;
  situacao: Situacao;
}

export class PagSeguroSimulado {
  private readonly cobrancas = new Map<string, Cobranca>();
  private sequencia = 0;

  /** Pagadores cuja cobrança é negada. */
  constructor(private readonly negados: string[] = []) {}

  async criarCobranca(pedido: { valor: string; pagador: { email: string }; recebedor: string }): Promise<
    { sucesso: true; cobranca: Cobranca } | { sucesso: false; erro: 'VALOR_INVALIDO' }
  > {
    if (!/^\d+\.\d{2}$/.test(pedido.valor) || Number(pedido.valor) <= 0) return { sucesso: false, erro: 'VALOR_INVALIDO' };
    this.sequencia += 1;
    const cobranca: Cobranca = {
      ...pedido,
      codigo: `COB-${String(this.sequencia).padStart(6, '0')}`,
      situacao: this.negados.includes(pedido.pagador.email) ? 'NEGADA' : 'PAGA',
    };
    this.cobrancas.set(cobranca.codigo, cobranca);
    return { sucesso: true, cobranca: { ...cobranca } };
  }

  async estornar(codigo: string): Promise<{ sucesso: boolean; erro?: 'COBRANCA_INEXISTENTE' | 'SITUACAO_NAO_PERMITE' }> {
    const cobranca = this.cobrancas.get(codigo);
    if (!cobranca) return { sucesso: false, erro: 'COBRANCA_INEXISTENTE' };
    if (cobranca.situacao !== 'PAGA') return { sucesso: false, erro: 'SITUACAO_NAO_PERMITE' };
    cobranca.situacao = 'ESTORNADA';
    return { sucesso: true };
  }

  async consultar(codigo: string): Promise<Cobranca | null> {
    const cobranca = this.cobrancas.get(codigo);
    return cobranca ? { ...cobranca } : null;
  }
}
