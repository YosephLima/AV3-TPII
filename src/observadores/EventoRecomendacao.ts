import type { Papel } from '../dominio/Papel';
import type { Projeto } from '../dominio/Projeto';

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
  /** O que vai para auditoria e mensagens. */
  readonly dados: DadosEvento;

  constructor(
    readonly tipo: TipoEvento,
    /** Para quem precisa dos atributos do tipo. */
    readonly projeto: Projeto,
    envolvidos: Envolvido[],
    readonly origem: string,
  ) {
    this.dados = { projetoId: projeto.id, projetoNome: projeto.nome, produtor: projeto.produtor, envolvidos };
  }
}
