export interface MetadadosArquivo {
  /** Caminho lógico, com "/" como separador ("recomendacoes/123.json"). É também o id devolvido. */
  caminho: string;
  tipoConteudo?: string;
  extras?: Record<string, string>;
}

/** Adapter: o núcleo grava e lê arquivos sem saber qual provedor está por trás. */
export interface AdaptadorArmazenamento {
  readonly provedor: string;
  salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string>;
  recuperarArquivo(id: string): Promise<Buffer>;
  listarArquivos(prefixo: string): Promise<string[]>;
}

export class ArquivoNaoEncontradoError extends Error {
  constructor(id: string) {
    super(`Arquivo não encontrado: ${id}`);
    this.name = 'ArquivoNaoEncontradoError';
  }
}
