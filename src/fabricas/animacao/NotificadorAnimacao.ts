import type { ProjetoAnimacao } from '../../dominio/ProjetoAnimacao';
import { NotificadorConvite } from '../../observadores/NotificadorConvite';

export class NotificadorAnimacao extends NotificadorConvite<ProjetoAnimacao> {
  protected override detalhes(projeto: ProjetoAnimacao): string {
    return `Animação ${projeto.tecnica} a ${projeto.quadrosPorSegundo} fps (${projeto.totalDeQuadros} quadros).`;
  }
}
