import type { EventoRecomendacao } from './EventoRecomendacao';
import type { Observador } from './Observador';

export interface Email {
  para: string;
  assunto: string;
  corpo: string;
}

export type EnviarEmail = (email: Email) => void;

/** Convida os profissionais recomendados e avisa o produtor sobre as respostas. */
export class NotificadorEmail implements Observador {
  constructor(private readonly enviar: EnviarEmail = (e) => console.log(`[email] ${e.para}: ${e.assunto}`)) {}

  atualizar(evento: EventoRecomendacao): void {
    const { projetoNome, produtor, envolvidos } = evento.dados;

    switch (evento.tipo) {
      case 'recomendacao_gerada':
      case 'membro_substituido':
        for (const e of envolvidos) {
          this.enviar({
            para: e.profissionalId,
            assunto: `Convite: ${projetoNome}`,
            corpo: `Um produtor tem interesse em você como ${e.papel} no projeto ${projetoNome}.`,
          });
        }
        break;
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
      case 'reavaliacao_solicitada':
        break;
    }
  }
}
