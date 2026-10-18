import type { Profissional } from '../../dominio/Profissional';
import type { RequisitoPapel } from '../../dominio/Projeto';
import { RecomendadorPorPontuacao } from '../../estrategias/RecomendadorPorPontuacao';
import { SOFTWARES_3D } from './softwares3d';

/** Peso extra para quem domina software de modelagem 3D. */
export class RecomendadorAnimacao extends RecomendadorPorPontuacao {
  readonly nome = 'animacao';

  protected pontuar(requisito: RequisitoPapel, profissional: Profissional): number {
    const melhorSoftware = Math.max(...SOFTWARES_3D.map((s) => this.nivelEm(profissional, s)));
    return 0.6 * this.aderencia(requisito, profissional) + 0.4 * melhorSoftware;
  }
}
