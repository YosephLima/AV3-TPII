import { EventEmitter } from 'node:events';
import type { EventoRecomendacao } from './EventoRecomendacao';

/** O sistema só conhece esta interface, então dá para trocar por uma fila (RabbitMQ) sem mexer nele. */
export interface BarramentoEventos {
  publicar(evento: EventoRecomendacao): void;
  inscrever(ouvinte: (evento: EventoRecomendacao) => void): void;
}

export class BarramentoEmMemoria implements BarramentoEventos {
  private static readonly CANAL = 'recomendacao';
  private readonly emissor = new EventEmitter();

  constructor(private readonly aoFalhar: (erro: unknown) => void = (erro) => console.error(erro)) {}

  publicar(evento: EventoRecomendacao): void {
    this.emissor.emit(BarramentoEmMemoria.CANAL, evento);
  }

  /** Um ouvinte com erro não impede os outros de receber o evento. */
  inscrever(ouvinte: (evento: EventoRecomendacao) => void): void {
    this.emissor.on(BarramentoEmMemoria.CANAL, (evento: EventoRecomendacao) => {
      try {
        ouvinte(evento);
      } catch (erro) {
        this.aoFalhar(erro);
      }
    });
  }
}
