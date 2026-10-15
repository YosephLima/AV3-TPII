import type { Papel } from '../dominio/Papel';

export type TipoEvento =
  | 'recomendacao_gerada'
  | 'membro_substituido'
  | 'convite_aceito'
  | 'convite_recusado'
  | 'reavaliacao_solicitada'
  | 'equipe_formada';

export interface Envolvido {
  profissionalId: string;
  nome: string;
  papel: Papel;
}

export interface DadosEvento {
  projetoId: string;
  projetoNome: string;
  produtor: string;
  envolvidos: Envolvido[];
}

export class EventoRecomendacao {
  readonly data = new Date();

  constructor(
    readonly tipo: TipoEvento,
    readonly dados: DadosEvento,
    readonly origem: string,
  ) {}
}
