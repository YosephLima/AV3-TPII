import type { EventoRecomendacao } from './EventoRecomendacao';
import type { Observador } from './Observador';

export interface Email {
  para: string;
  assunto: string;
  corpo: string;
}

export type EnviarEmail = (email: Email) => void;

export const enviarPorConsole: EnviarEmail = (e) => console.log(`[email] ${e.para}: ${e.assunto}`);

/** Avisos ao produtor. Os convites aos profissionais saem pelo notificador de cada família. */
export class NotificadorEmail implements Observador {
  constructor(private readonly enviar: EnviarEmail = enviarPorConsole) {}

  atualizar(evento: EventoRecomendacao): void {
    const { projetoNome, produtor, envolvidos } = evento.dados;

    switch (evento.tipo) {
      case 'convite_aceito':
      case 'convite_recusado':
        for (const e of envolvidos) {
          const resposta = evento.tipo === 'convite_aceito' ? 'aceitou' : 'recusou';
          this.enviar({
            para: produtor,
            assunto: `Resposta ao convite: ${projetoNome}`,
            corpo: `${e.nome} ${resposta} o convite para ${e.papel}.`,
          });
        }
        break;
      case 'equipe_formada':
        this.enviar({ para: produtor, assunto: `Equipe formada: ${projetoNome}`, corpo: 'Todos confirmaram.' });
        break;
      case 'recomendacao_gerada':
      case 'membro_substituido':
      case 'reavaliacao_solicitada':
        break;
    }
  }
}
