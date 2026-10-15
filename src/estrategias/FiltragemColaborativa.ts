import type { Recomendacoes } from '../dominio/Equipe';
import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';
import { ranquearPorPapel, type RecomendacaoStrategy } from './RecomendacaoStrategy';

/**
 * Usa as avaliações de outros produtores. A média é bayesiana para que uma única nota alta não passe na
 * frente de quem tem muitas.
 */
export class FiltragemColaborativa implements RecomendacaoStrategy {
  readonly nome = 'colaborativa';

  constructor(private readonly avaliacoesMinimas = 3) {}

  recomendar(projeto: Projeto, profissionais: Profissional[]): Recomendacoes {
    const todas = profissionais.flatMap((p) => p.avaliacoes);
    const mediaGeral = todas.length === 0 ? 0 : todas.reduce((s, a) => s + a.nota, 0) / todas.length;
    const c = this.avaliacoesMinimas;

    return ranquearPorPapel(projeto, profissionais, (_, p) => {
      const soma = p.avaliacoes.reduce((s, a) => s + a.nota, 0);
      return (c * mediaGeral + soma) / (c + p.avaliacoes.length);
    });
  }
}
