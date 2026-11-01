import { NoSuchKey, type S3Simulado } from '../../externos/S3Simulado';
import { ArquivoNaoEncontradoError, type AdaptadorArmazenamento, type MetadadosArquivo } from './AdaptadorArmazenamento';

export class AdaptadorS3 implements AdaptadorArmazenamento {
  readonly provedor = 's3';

  constructor(
    private readonly s3: S3Simulado,
    private readonly bucket: string,
  ) {}

  async salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string> {
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: metadados.caminho,
      Body: new Uint8Array(conteudo),
      ContentType: metadados.tipoConteudo,
      Metadata: metadados.extras,
    });
    return metadados.caminho;
  }

  async recuperarArquivo(id: string): Promise<Buffer> {
    try {
      const objeto = await this.s3.getObject({ Bucket: this.bucket, Key: id });
      return Buffer.from(objeto.Body);
    } catch (erro) {
      if (erro instanceof NoSuchKey) throw new ArquivoNaoEncontradoError(id);
      throw erro;
    }
  }

  /** O S3 devolve no máximo MaxKeys por chamada; segue o token até o fim. */
  async listarArquivos(prefixo: string): Promise<string[]> {
    const chaves: string[] = [];
    let token: string | undefined;
    do {
      const pagina = await this.s3.listObjectsV2({ Bucket: this.bucket, Prefix: prefixo, ContinuationToken: token });
      chaves.push(...(pagina.Contents ?? []).map((o) => o.Key));
      token = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
    } while (token);
    return chaves;
  }
}
