import type { Profissional } from '../../dominio/Profissional';
import type { RequisitoPapel } from '../../dominio/Projeto';
import { RecomendadorBase } from '../../estrategias/RecomendadorBase';

/** Peso extra para experiência com documentário. */
export class RecomendadorDocumentario extends RecomendadorBase {
  override readonly nome = 'documentario';
  /** O resto da pontuação é a experiência com documentário. */
  static readonly PESO_ADERENCIA = 0.6;

  protected override pontuar(requisito: RequisitoPapel, profissional: Profissional): number {
    const k = RecomendadorDocumentario.PESO_ADERENCIA;
    return k * this.aderencia(requisito, profissional) + (1 - k) * this.nivelEm(profissional, 'documentario');
  }
}
