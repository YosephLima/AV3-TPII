import { gzipSync } from 'node:zlib';
import type { AdaptadorArmazenamento } from '../adaptadores/armazenamento/AdaptadorArmazenamento';
import type { Recomendacoes } from '../dominio/Equipe';
import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';
import type { RecomendacaoStrategy } from '../estrategias/RecomendacaoStrategy';
import { DecoradorRecomendacao } from './DecoradorRecomendacao';

export interface InfoEnvio {
  projetoId: string;
  estrategia: string;
  codificacao: 'gzip' | 'identity';
  tamanhoOriginal: number;
  tamanhoEnviado: number;
}

/** Para onde vai o ranking serializado: é aqui que os dados saem do processo. */
export interface CanalSaida {
  enviar(conteudo: Buffer, info: InfoEnvio): void;
}

/**
 * Comprime o ranking antes de ele sair do processo. O resultado devolvido continua sendo o mesmo Map (o
 * contrato da estratégia não muda); o que encolhe é o que vai pelo canal. Abaixo do tamanho mínimo, o gzip
 * mais atrapalha que ajuda (o cabeçalho sozinho tem 18 bytes), então o conteúdo vai sem compressão.
 */
export class CompressaoDecorator extends DecoradorRecomendacao {
  protected readonly camada = 'compressao';

  constructor(
    recomendador: RecomendacaoStrategy,
    private readonly canal: CanalSaida,
    private readonly nivelCompressao = 6,
    private readonly tamanhoMinimo = 1_024,
  ) {
    super(recomendador);
    validarNivelCompressao(nivelCompressao);
  }

  recomendar(projeto: Projeto, profissionais: Profissional[]): Recomendacoes {
    const recomendacoes = this.recomendador.recomendar(projeto, profissionais);
    const original = Buffer.from(JSON.stringify(serializarRecomendacoes(recomendacoes)));
    const comprimir = original.byteLength >= this.tamanhoMinimo;
    const conteudo = comprimir ? gzipSync(original, { level: this.nivelCompressao }) : original;

    this.canal.enviar(conteudo, {
      projetoId: projeto.id,
      estrategia: this.nome,
      codificacao: comprimir ? 'gzip' : 'identity',
      tamanhoOriginal: original.byteLength,
      tamanhoEnviado: conteudo.byteLength,
    });
    return recomendacoes;
  }
}

export function validarNivelCompressao(nivel: number): number {
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 9) throw new RangeError('O nível de compressão vai de 1 a 9');
  return nivel;
}

/** O ranking completo de cada papel, com os dados de cada candidato. */
export function serializarRecomendacoes(recomendacoes: Recomendacoes): Record<string, unknown[]> {
  return Object.fromEntries(
    [...recomendacoes].map(([papel, ranking]) => [
      papel,
      ranking.map((p) => ({
        id: p.id,
        nome: p.nome,
        especialidades: p.especialidades,
        competencias: p.competencias.map((c) => ({ nome: c.nome, nivel: c.nivel })),
        notaMedia: p.notaMedia(),
        precoMedio: p.precoMedio,
        localizacao: p.localizacao,
      })),
    ]),
  );
}

/**
 * Grava o ranking no armazenamento configurado no momento do envio. A gravação é assíncrona e a estratégia
 * não é, então os envios ficam pendentes até terminarem; uma falha só vai para o log.
 */
export class CanalArmazenamento implements CanalSaida {
  static readonly PASTA = 'rankings/';
  private readonly pendentes = new Set<Promise<unknown>>();

  constructor(
    private readonly armazenamento: () => AdaptadorArmazenamento,
    private readonly aoFalhar: (erro: unknown) => void = (erro) => console.error('Falha ao enviar o ranking:', erro),
  ) {}

  enviar(conteudo: Buffer, info: InfoEnvio): void {
    const extensao = info.codificacao === 'gzip' ? '.json.gz' : '.json';
    const envio = this.armazenamento()
      .salvarArquivo(conteudo, {
        caminho: `${CanalArmazenamento.PASTA}${info.projetoId}${extensao}`,
        tipoConteudo: 'application/json',
        extras: { codificacao: info.codificacao, tamanhoOriginal: String(info.tamanhoOriginal) },
      })
      .catch(this.aoFalhar)
      .finally(() => this.pendentes.delete(envio));
    this.pendentes.add(envio);
  }

  async aguardar(): Promise<void> {
    await Promise.all([...this.pendentes]);
  }
}
