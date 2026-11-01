import type { Profissional } from '../../dominio/Profissional';
import type { RequisitoPapel } from '../../dominio/Projeto';
import { RecomendadorBase } from '../../estrategias/RecomendadorBase';

/** Agências querem reputação comprovada, então a nota pesa tanto quanto a aderência. */
export class RecomendadorPublicitario extends RecomendadorBase {
  override readonly nome = 'publicitario';
  /** O resto da pontuação é a reputação (nota de 0 a 5, normalizada). */
  static readonly PESO_ADERENCIA = 0.5;

  protected override pontuar(requisito: RequisitoPapel, profissional: Profissional): number {
    const k = RecomendadorPublicitario.PESO_ADERENCIA;
    return k * this.aderencia(requisito, profissional) + (1 - k) * (profissional.notaMedia() / 5);
  }
}
