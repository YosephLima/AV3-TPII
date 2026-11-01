import type { Recomendacoes } from '../dominio/Equipe';
import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';
import type { RecomendacaoStrategy } from '../estrategias/RecomendacaoStrategy';

/**
 * Decorator: tem a mesma interface da estratégia e envolve outra. O nome é o da estratégia de dentro, então
 * para quem chama nada muda; a descrição mostra a pilha inteira, como "auditoria(cache(animacao))".
 */
export abstract class DecoradorRecomendacao implements RecomendacaoStrategy {
  protected abstract readonly camada: string;

  constructor(protected readonly recomendador: RecomendacaoStrategy) {}

  get nome(): string {
    return this.recomendador.nome;
  }

  get descricao(): string {
    return `${this.camada}(${descreverPilha(this.recomendador)})`;
  }

  abstract recomendar(projeto: Projeto, profissionais: Profissional[]): Recomendacoes;
}

export function descreverPilha(estrategia: RecomendacaoStrategy): string {
  return estrategia instanceof DecoradorRecomendacao ? estrategia.descricao : estrategia.nome;
}
