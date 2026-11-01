/**
 * Imita o formato do cliente do Amazon S3: parâmetros com inicial maiúscula, corpo em Uint8Array, erro
 * NoSuchKey e listagem paginada por ContinuationToken. Guarda tudo em memória.
 */
export interface ObjetoS3 {
  Body: Uint8Array;
  ContentType?: string;
  Metadata: Record<string, string>;
}

export class NoSuchKey extends Error {
  override readonly name = 'NoSuchKey';
}

export class S3Simulado {
  private readonly buckets = new Map<string, Map<string, ObjetoS3>>();
  /** Bytes que chegaram por putObject, para medir o tráfego. */
  bytesRecebidos = 0;

  async putObject(params: {
    Bucket: string;
    Key: string;
    Body: Uint8Array;
    ContentType?: string;
    Metadata?: Record<string, string>;
  }): Promise<{ ETag: string }> {
    this.bytesRecebidos += params.Body.byteLength;
    this.bucket(params.Bucket).set(params.Key, {
      Body: new Uint8Array(params.Body),
      ContentType: params.ContentType,
      Metadata: { ...params.Metadata },
    });
    return { ETag: `"${params.Key.length}-${params.Body.byteLength}"` };
  }

  async getObject(params: { Bucket: string; Key: string }): Promise<ObjetoS3 & { ContentLength: number }> {
    const objeto = this.bucket(params.Bucket).get(params.Key);
    if (!objeto) throw new NoSuchKey(`The specified key does not exist: ${params.Key}`);
    return { ...objeto, Body: new Uint8Array(objeto.Body), ContentLength: objeto.Body.byteLength };
  }

  async listObjectsV2(params: { Bucket: string; Prefix?: string; MaxKeys?: number; ContinuationToken?: string }): Promise<{
    Contents?: { Key: string; Size: number }[];
    IsTruncated: boolean;
    NextContinuationToken?: string;
  }> {
    const bucket = this.bucket(params.Bucket);
    const chaves = [...bucket.keys()].filter((k) => k.startsWith(params.Prefix ?? '')).sort();
    const inicio = Number(params.ContinuationToken ?? 0);
    const fim = inicio + (params.MaxKeys ?? 1000);
    const pagina = chaves.slice(inicio, fim);
    return {
      Contents: pagina.length === 0 ? undefined : pagina.map((Key) => ({ Key, Size: bucket.get(Key)?.Body.byteLength ?? 0 })),
      IsTruncated: fim < chaves.length,
      NextContinuationToken: fim < chaves.length ? String(fim) : undefined,
    };
  }

  private bucket(nome: string): Map<string, ObjetoS3> {
    let bucket = this.buckets.get(nome);
    if (!bucket) {
      bucket = new Map();
      this.buckets.set(nome, bucket);
    }
    return bucket;
  }
}
