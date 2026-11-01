import type { Projeto } from '../dominio/Projeto';
import type { RecomendacaoStrategy } from '../estrategias/RecomendacaoStrategy';

export const DECORADORES = ['auditoria', 'cache', 'compressao'] as const;
export type NomeDecorador = (typeof DECORADORES)[number];

export type CriarDecorador = (recomendador: RecomendacaoStrategy) => RecomendacaoStrategy;

export class PilhaInvalidaError extends Error {
  constructor(motivo: string) {
    super(`Pilha de decoradores inválida: ${motivo}`);
    this.name = 'PilhaInvalidaError';
  }
}

/**
 * Monta a pilha de decoradores em tempo de execução. A lista vai de fora para dentro: ['auditoria', 'cache']
 * vira auditoria(cache(estratégia)). Vale a preferência do produtor (guardada no projeto) e, sem ela, a
 * política configurada, que pode ser trocada com o sistema rodando.
 */
export class PoliticaDecoradores {
  private padrao: NomeDecorador[];

  constructor(
    private readonly criadores: Record<NomeDecorador, CriarDecorador>,
    padrao: readonly string[] = [],
  ) {
    this.padrao = validarPilha(padrao);
  }

  get pilhaPadrao(): NomeDecorador[] {
    return [...this.padrao];
  }

  definirPadrao(pilha: readonly string[]): void {
    this.padrao = validarPilha(pilha);
  }

  decorar(base: RecomendacaoStrategy, pilha: readonly string[] = this.padrao): RecomendacaoStrategy {
    return validarPilha(pilha).reduceRight<RecomendacaoStrategy>((interno, nome) => this.criadores[nome](interno), base);
  }

  /** No formato que o SistemaRecomendacao recebe. */
  readonly paraProjeto = (base: RecomendacaoStrategy, projeto: Projeto): RecomendacaoStrategy =>
    this.decorar(base, projeto.decoradores ?? this.padrao);
}

export function validarPilha(pilha: readonly string[]): NomeDecorador[] {
  const desconhecido = pilha.find((nome) => !(DECORADORES as readonly string[]).includes(nome));
  if (desconhecido !== undefined) {
    throw new PilhaInvalidaError(`"${desconhecido}" não existe (use ${DECORADORES.join(', ')})`);
  }
  if (new Set(pilha).size !== pilha.length) throw new PilhaInvalidaError('decorador repetido');
  return [...pilha] as NomeDecorador[];
}

/** "auditoria,cache" vira ['auditoria', 'cache']; vazio vira pilha vazia. */
export function pilhaDoTexto(texto: string | undefined): NomeDecorador[] {
  return validarPilha((texto ?? '').split(',').map((s) => s.trim()).filter(Boolean));
}
