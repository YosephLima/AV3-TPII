import type { GoogleCloudStorageSimulado } from '../../externos/GoogleCloudStorageSimulado';
import { ArquivoNaoEncontradoError, type AdaptadorArmazenamento, type MetadadosArquivo } from './AdaptadorArmazenamento';

export class AdaptadorGoogleCloud implements AdaptadorArmazenamento {
  readonly provedor = 'gcs';

  constructor(
    private readonly storage: GoogleCloudStorageSimulado,
    private readonly bucket: string,
  ) {}

  async salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string> {
    await this.storage
      .bucket(this.bucket)
      .file(metadados.caminho)
      .save(conteudo, { contentType: metadados.tipoConteudo, metadata: { metadata: metadados.extras } });
    return metadados.caminho;
  }

  async recuperarArquivo(id: string): Promise<Buffer> {
    try {
      const [conteudo] = await this.storage.bucket(this.bucket).file(id).download();
      return conteudo;
    } catch (erro) {
      if ((erro as { code?: number }).code === 404) throw new ArquivoNaoEncontradoError(id);
      throw erro;
    }
  }

  async listarArquivos(prefixo: string): Promise<string[]> {
    const [arquivos] = await this.storage.bucket(this.bucket).getFiles({ prefix: prefixo });
    return arquivos.map((a) => a.name);
  }
}
