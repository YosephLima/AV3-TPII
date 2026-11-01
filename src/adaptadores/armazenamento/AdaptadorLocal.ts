import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { ArquivoNaoEncontradoError, type AdaptadorArmazenamento, type MetadadosArquivo } from './AdaptadorArmazenamento';

/**
 * Grava no disco. O caminho lógico usa "/" e é convertido para o separador do sistema, então funciona igual
 * no Windows e no Linux.
 */
export class AdaptadorLocal implements AdaptadorArmazenamento {
  readonly provedor = 'local';
  private readonly raiz: string;

  constructor(diretorio: string) {
    this.raiz = resolve(diretorio);
  }

  async salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string> {
    const destino = this.resolver(metadados.caminho);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, conteudo);
    return metadados.caminho;
  }

  async recuperarArquivo(id: string): Promise<Buffer> {
    try {
      return await readFile(this.resolver(id));
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') throw new ArquivoNaoEncontradoError(id);
      throw erro;
    }
  }

  async listarArquivos(prefixo: string): Promise<string[]> {
    let entradas;
    try {
      entradas = await readdir(this.raiz, { recursive: true, withFileTypes: true });
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw erro;
    }
    return entradas
      .filter((e) => e.isFile())
      .map((e) => relative(this.raiz, resolve(e.parentPath, e.name)).split(sep).join('/'))
      .filter((caminho) => caminho.startsWith(prefixo))
      .sort();
  }

  /** Impede que um caminho como "../../etc" saia do diretório. */
  private resolver(caminho: string): string {
    const destino = resolve(this.raiz, ...caminho.split('/'));
    if (!destino.startsWith(this.raiz + sep)) throw new Error(`Caminho fora do armazenamento: ${caminho}`);
    return destino;
  }
}
