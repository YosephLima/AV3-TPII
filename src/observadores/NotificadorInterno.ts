import type { EventoRecomendacao } from './EventoRecomendacao';
import type { Observador } from './Observador';

export class NotificadorInterno implements Observador {
  private readonly caixas = new Map<string, string[]>();

  atualizar(evento: EventoRecomendacao): void {
    const { projetoNome, produtor, envolvidos } = evento.dados;
    for (const e of envolvidos) {
      this.entregar(e.profissionalId, `[${evento.tipo}] ${projetoNome}: ${e.papel}`);
    }
    this.entregar(produtor, `[${evento.tipo}] ${projetoNome}: ${envolvidos.length} profissional(is) envolvido(s)`);
  }

  mensagensDe(destinatario: string): string[] {
    return [...(this.caixas.get(destinatario) ?? [])];
  }

  private entregar(destinatario: string, mensagem: string): void {
    const caixa = this.caixas.get(destinatario) ?? [];
    caixa.push(mensagem);
    this.caixas.set(destinatario, caixa);
  }
}
