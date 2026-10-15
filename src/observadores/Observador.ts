import type { EventoRecomendacao } from './EventoRecomendacao';

export interface Observador {
  atualizar(evento: EventoRecomendacao): void;
}
