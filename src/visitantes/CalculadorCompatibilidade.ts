import { cosseno, vetorDe } from '../dominio/Competencia';
import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';
import type { VisitanteProjeto } from './VisitanteProjeto';

/**
 * De 0 a 1. No profissional é a reputação (nota / 5); no projeto, a média ponderada pelo peso dos papéis de
 * 70% aderência técnica e 30% reputação.
 */
export class CalculadorCompatibilidade implements VisitanteProjeto<number> {
  static readonly PESO_TECNICO = 0.7;

  visitarProjeto(projeto: Projeto): number {
    const equipe = projeto.equipe;
    if (!equipe) return 0;

    let soma = 0;
    let pesoTotal = 0;
    for (const requisito of projeto.papeis) {
      pesoTotal += requisito.peso;
      const membro = equipe.membro(requisito.papel);
      if (!membro) continue;
      const tecnico = cosseno(vetorDe(requisito.competenciasDesejadas), membro.profissional.vetorCompetencias());
      const reputacao = membro.profissional.aceitar(this);
      const k = CalculadorCompatibilidade.PESO_TECNICO;
      soma += requisito.peso * (k * tecnico + (1 - k) * reputacao);
    }
    return pesoTotal === 0 ? 0 : soma / pesoTotal;
  }

  visitarProfissional(profissional: Profissional): number {
    return profissional.notaMedia() / 5;
  }
}
