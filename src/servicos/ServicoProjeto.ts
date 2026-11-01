import type { ServicoAtomico } from './ServicoAtomico';

/**
 * Composite: serviço atômico e pacote de serviços têm a mesma interface, então o projeto calcula custo,
 * prazo e validação sem saber a profundidade da árvore.
 */
export interface ServicoProjeto {
  readonly nome: string;
  calcularCusto(): number;
  listarSubservicos(): ServicoProjeto[];
  /** Quando o último serviço da árvore termina. */
  obterPrazo(): Date;
  validar(): boolean;
  /** Cada problema vem com o caminho até o serviço, como "Pós-produção > Montagem: ...". */
  problemas(caminho?: string[]): string[];
  /** As folhas da árvore, na ordem em que aparecem. */
  servicosAtomicos(): ServicoAtomico[];
  contem(servico: ServicoProjeto): boolean;
  /** Cópia profunda. O deslocamento (em ms) move todos os prazos, para acompanhar uma nova data de entrega. */
  clonar(deslocamento?: number): ServicoProjeto;
}

export class ComposicaoInvalidaError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ComposicaoInvalidaError';
  }
}

export function descreverCaminho(caminho: string[]): string {
  return caminho.join(' > ');
}
