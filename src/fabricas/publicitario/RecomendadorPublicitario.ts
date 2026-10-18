import type { Profissional } from '../../dominio/Profissional';
import type { RequisitoPapel } from '../../dominio/Projeto';
import { RecomendadorPorPontuacao } from '../../estrategias/RecomendadorPorPontuacao';

/** Agências querem reputação comprovada, então a nota pesa tanto quanto a aderência. */
export class RecomendadorPublicitario extends RecomendadorPorPontuacao {
  readonly nome = 'publicitario';

  protected pontuar(requisito: RequisitoPapel, profissional: Profissional): number {
    return 0.5 * this.aderencia(requisito, profissional) + 0.5 * (profissional.notaMedia() / 5);
  }
}
