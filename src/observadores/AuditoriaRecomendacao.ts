import type { EventoRecomendacao, TipoEvento } from './EventoRecomendacao';
import type { Observador } from './Observador';

export interface RegistroAuditoria {
  data: string;
  evento: TipoEvento;
  origem: string;
  projetoId: string;
  produtor: string;
  profissionais: string[];
}

/** Uma linha JSON por evento. */
export class AuditoriaRecomendacao implements Observador {
  readonly registros: RegistroAuditoria[] = [];

  constructor(private readonly escrever: (linha: string) => void = (linha) => console.log(linha)) {}

  atualizar(evento: EventoRecomendacao): void {
    const registro: RegistroAuditoria = {
      data: evento.data.toISOString(),
      evento: evento.tipo,
      origem: evento.origem,
      projetoId: evento.dados.projetoId,
      produtor: evento.dados.produtor,
      profissionais: evento.dados.envolvidos.map((e) => e.profissionalId),
    };
    this.registros.push(registro);
    this.escrever(JSON.stringify(registro));
  }
}
