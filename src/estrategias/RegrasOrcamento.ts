import type { Recomendacoes } from '../dominio/Equipe';
import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';
import type { RecomendacaoStrategy } from './RecomendacaoStrategy';

/**
 * Para orçamento apertado: cada papel só aceita quem cabe na sua fatia, do mais barato ao mais caro (no
 * empate, a melhor nota).
 */
export class RegrasOrcamento implements RecomendacaoStrategy {
  readonly nome = 'orcamento';

  recomendar(projeto: Projeto, profissionais: Profissional[]): Recomendacoes {
    const recomendacoes: Recomendacoes = new Map();
    for (const { papel } of projeto.papeis) {
      const teto = projeto.tetoPorPapel(papel);
      const ranking = profissionais
        .filter((p) => p.atuaComo(papel) && p.precoMedio <= teto)
        .sort((a, b) => a.precoMedio - b.precoMedio || b.notaMedia() - a.notaMedia());
      recomendacoes.set(papel, ranking);
    }
    return recomendacoes;
  }
}
