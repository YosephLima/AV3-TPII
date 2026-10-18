import type { ProjetoPublicitario } from '../../dominio/ProjetoPublicitario';
import { NotificadorConvite } from '../../observadores/NotificadorConvite';

export class NotificadorPublicitario extends NotificadorConvite<ProjetoPublicitario> {
  protected override detalhes(projeto: ProjetoPublicitario): string {
    const entrega = projeto.prazo.toISOString().slice(0, 10);
    return `Campanha para ${projeto.cliente}, veiculação em ${projeto.veiculacao}, entrega em ${entrega}.`;
  }
}
