import { cosseno, vetorDe } from '../dominio/Competencia';
import type { Recomendacoes } from '../dominio/Equipe';
import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';
import { ranquearPorPapel, type RecomendacaoStrategy } from './RecomendacaoStrategy';

/** Compara o que o papel pede com as competências de cada profissional. */
export class SimilaridadeCosseno implements RecomendacaoStrategy {
  readonly nome = 'cosseno';

  recomendar(projeto: Projeto, profissionais: Profissional[]): Recomendacoes {
    return ranquearPorPapel(projeto, profissionais, (requisito, p) =>
      cosseno(vetorDe(requisito.competenciasDesejadas), p.vetorCompetencias()),
    );
  }
}
