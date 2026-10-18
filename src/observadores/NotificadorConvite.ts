import type { Projeto } from '../dominio/Projeto';
import type { EventoRecomendacao } from './EventoRecomendacao';
import { enviarPorConsole, type EnviarEmail } from './NotificadorEmail';
import type { Observador } from './Observador';

/** Convite aos profissionais. Cada família acrescenta os detalhes do seu tipo. */
export class NotificadorConvite<P extends Projeto = Projeto> implements Observador {
  constructor(private readonly enviar: EnviarEmail = enviarPorConsole) {}

  atualizar(evento: EventoRecomendacao): void {
    if (evento.tipo !== 'recomendacao_gerada' && evento.tipo !== 'membro_substituido') return;

    // A fábrica só usa este notificador com projetos da própria família.
    const projeto = evento.projeto as P;
    const detalhes = this.detalhes(projeto);
    for (const e of evento.dados.envolvidos) {
      const convite = `Um produtor tem interesse em você como ${e.papel} no projeto ${projeto.nome}.`;
      this.enviar({
        para: e.profissionalId,
        assunto: `Convite: ${projeto.nome}`,
        corpo: detalhes ? `${convite} ${detalhes}` : convite,
      });
    }
  }

  protected detalhes(_projeto: P): string {
    return '';
  }
}
