import type { Equipe } from '../../dominio/Equipe';
import { Papel } from '../../dominio/Papel';
import type { ProjetoAnimacao } from '../../dominio/ProjetoAnimacao';
import { ValidadorConsistencia } from '../../visitantes/ValidadorConsistencia';
import { SOFTWARES_3D } from './softwares3d';

export class ValidadorAnimacao extends ValidadorConsistencia {
  static readonly FPS_MINIMO = 12;
  static readonly FPS_MAXIMO = 60;

  protected override validarTipo(projeto: ProjetoAnimacao): void {
    if (!projeto.papeis.some((r) => r.papel === Papel.EFEITOS_VISUAIS)) {
      this.registrarErro('Animação exige especialista em efeitos visuais');
    }
    const fps = projeto.quadrosPorSegundo;
    if (fps < ValidadorAnimacao.FPS_MINIMO || fps > ValidadorAnimacao.FPS_MAXIMO) {
      this.registrarErro(`Quadros por segundo fora da faixa ${ValidadorAnimacao.FPS_MINIMO} a ${ValidadorAnimacao.FPS_MAXIMO}`);
    }
  }

  /** Em 3D, quem cuida dos efeitos visuais precisa saber modelar. */
  protected override validarEquipe(projeto: ProjetoAnimacao, equipe: Equipe): void {
    super.validarEquipe(projeto, equipe);
    const vfx = equipe.membro(Papel.EFEITOS_VISUAIS);
    if (projeto.tecnica === '3d' && vfx) {
      const competencias = vfx.profissional.vetorCompetencias();
      if (!SOFTWARES_3D.some((software) => competencias.has(software))) {
        this.registrarErro(`${vfx.profissional.nome} não domina software de modelagem 3D`);
      }
    }
  }
}
