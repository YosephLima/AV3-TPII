import type { Profissional } from '../../dominio/Profissional';
import type { RequisitoPapel } from '../../dominio/Projeto';
import { RecomendadorPorPontuacao } from '../../estrategias/RecomendadorPorPontuacao';

/** Peso extra para experiência com documentário. */
export class RecomendadorDocumentario extends RecomendadorPorPontuacao {
  readonly nome = 'documentario';

  protected pontuar(requisito: RequisitoPapel, profissional: Profissional): number {
    return 0.6 * this.aderencia(requisito, profissional) + 0.4 * this.nivelEm(profissional, 'documentario');
  }
}
