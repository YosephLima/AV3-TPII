import type { ProjetoDocumentario } from '../../dominio/ProjetoDocumentario';
import { NotificadorConvite } from '../../observadores/NotificadorConvite';

export class NotificadorDocumentario extends NotificadorConvite<ProjetoDocumentario> {
  protected override detalhes(projeto: ProjetoDocumentario): string {
    return `Documentário sobre "${projeto.tema}", com ${projeto.entrevistados.length} entrevistado(s) previsto(s).`;
  }
}
