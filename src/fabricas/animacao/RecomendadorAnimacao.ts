import type { Profissional } from '../../dominio/Profissional';
import type { RequisitoPapel } from '../../dominio/Projeto';
import { RecomendadorBase } from '../../estrategias/RecomendadorBase';
import { SOFTWARES_3D } from './softwares3d';

/** Peso extra para quem domina software de modelagem 3D. */
export class RecomendadorAnimacao extends RecomendadorBase {
  override readonly nome = 'animacao';
  /** O resto da pontuação é o domínio do melhor software 3D. */
  static readonly PESO_ADERENCIA = 0.6;

  protected override pontuar(requisito: RequisitoPapel, profissional: Profissional): number {
    const melhorSoftware = Math.max(...SOFTWARES_3D.map((s) => this.nivelEm(profissional, s)));
    const k = RecomendadorAnimacao.PESO_ADERENCIA;
    return k * this.aderencia(requisito, profissional) + (1 - k) * melhorSoftware;
  }
}
