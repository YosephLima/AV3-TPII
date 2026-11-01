/**
 * Imita o formato do cliente do Google Cloud Storage: bucket(nome).file(caminho), respostas em tuplas
 * ([conteudo], [arquivos]) e erro com code 404. Guarda tudo em memória.
 */
class ErroApi extends Error {
  constructor(
    mensagem: string,
    readonly code: number,
  ) {
    super(mensagem);
  }
}

interface Gravado {
  dados: Buffer;
  contentType?: string;
  metadata: Record<string, string>;
}

class Arquivo {
  constructor(
    private readonly armazenamento: Map<string, Gravado>,
    readonly name: string,
    private readonly aoGravar: (bytes: number) => void,
  ) {}

  async save(
    dados: Buffer,
    opcoes: { contentType?: string; metadata?: { metadata?: Record<string, string> } } = {},
  ): Promise<void> {
    this.aoGravar(dados.byteLength);
    this.armazenamento.set(this.name, {
      dados: Buffer.from(dados),
      contentType: opcoes.contentType,
      metadata: { ...opcoes.metadata?.metadata },
    });
  }

  async download(): Promise<[Buffer]> {
    const gravado = this.armazenamento.get(this.name);
    if (!gravado) throw new ErroApi(`No such object: ${this.name}`, 404);
    return [Buffer.from(gravado.dados)];
  }
}

class Bucket {
  constructor(
    private readonly armazenamento: Map<string, Gravado>,
    private readonly aoGravar: (bytes: number) => void,
  ) {}

  file(caminho: string): Arquivo {
    return new Arquivo(this.armazenamento, caminho, this.aoGravar);
  }

  async getFiles(opcoes: { prefix?: string } = {}): Promise<[Arquivo[]]> {
    const nomes = [...this.armazenamento.keys()].filter((n) => n.startsWith(opcoes.prefix ?? '')).sort();
    return [nomes.map((n) => this.file(n))];
  }
}

export class GoogleCloudStorageSimulado {
  private readonly buckets = new Map<string, Map<string, Gravado>>();
  bytesRecebidos = 0;

  bucket(nome: string): Bucket {
    let armazenamento = this.buckets.get(nome);
    if (!armazenamento) {
      armazenamento = new Map();
      this.buckets.set(nome, armazenamento);
    }
    return new Bucket(armazenamento, (bytes) => (this.bytesRecebidos += bytes));
  }
}
