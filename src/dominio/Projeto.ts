import { randomUUID } from 'node:crypto';
import type { RecomendacaoStrategy } from '../estrategias/RecomendacaoStrategy';
import type { VisitanteProjeto } from '../visitantes/VisitanteProjeto';
import type { Competencia } from './Competencia';
import type { Equipe } from './Equipe';
import type { Papel } from './Papel';
import type { Profissional } from './Profissional';

export type TipoCaptacao = 'documentario' | 'ficcao' | 'animacao';

/** Papel exigido e o peso dele para o sucesso da obra. */
export interface RequisitoPapel {
  papel: Papel;
  peso: number;
  competenciasDesejadas: Competencia[];
}

export interface Restricoes {
  orcamento: number;
  prazo: Date;
  localizacao: string;
}

export interface DadosProjeto {
  id?: string;
  nome: string;
  produtor: string;
  genero: string;
  duracao: number;
  tipoCaptacao: TipoCaptacao;
  papeis: RequisitoPapel[];
  restricoes: Restricoes;
  estrategia?: RecomendacaoStrategy;
}

export class Projeto {
  readonly id: string;
  readonly nome: string;
  readonly produtor: string;
  readonly genero: string;
  /** Em minutos. */
  readonly duracao: number;
  readonly tipoCaptacao: TipoCaptacao;
  readonly papeis: RequisitoPapel[];
  readonly restricoes: Restricoes;
  /** Definida pelo produtor na criação, se ele quiser. */
  readonly estrategia: RecomendacaoStrategy | undefined;
  private _equipe: Equipe | undefined;

  constructor(dados: DadosProjeto) {
    this.id = dados.id ?? randomUUID();
    this.nome = dados.nome;
    this.produtor = dados.produtor;
    this.genero = dados.genero;
    this.duracao = dados.duracao;
    this.tipoCaptacao = dados.tipoCaptacao;
    this.papeis = dados.papeis;
    this.restricoes = dados.restricoes;
    this.estrategia = dados.estrategia;
  }

  get orcamento(): number {
    return this.restricoes.orcamento;
  }

  get prazo(): Date {
    return this.restricoes.prazo;
  }

  get equipe(): Equipe | undefined {
    return this._equipe;
  }

  requisito(papel: Papel): RequisitoPapel | undefined {
    return this.papeis.find((r) => r.papel === papel);
  }

  /** Fatia do orçamento proporcional ao peso do papel. */
  tetoPorPapel(papel: Papel): number {
    const pesoTotal = this.papeis.reduce((soma, r) => soma + r.peso, 0);
    const peso = this.requisito(papel)?.peso ?? 0;
    return pesoTotal === 0 ? 0 : (this.orcamento * peso) / pesoTotal;
  }

  definirEquipe(equipe: Equipe): void {
    this._equipe = equipe;
  }

  /** O profissional aceitou o convite. */
  aceitarRecomendacao(papel: Papel, profissional: Profissional): void {
    const membro = this.equipeAtual().membro(papel);
    if (!membro || membro.profissional.id !== profissional.id) {
      throw new Error(`${profissional.nome} não é o membro recomendado para ${papel}`);
    }
    membro.confirmar();
    if (this.equipeAtual().todosConfirmados()) this.equipeAtual().status = 'formada';
  }

  substituirMembro(papel: Papel, profissional: Profissional): void {
    this.equipeAtual().substituir(papel, profissional);
  }

  /** Descarta a equipe; depois disso é preciso recomendar de novo. */
  solicitarReavaliacao(): void {
    this._equipe?.descartar();
    this._equipe = undefined;
  }

  aceitar<R>(visitante: VisitanteProjeto<R>): R {
    return visitante.visitarProjeto(this);
  }

  private equipeAtual(): Equipe {
    if (!this._equipe) throw new Error(`O projeto ${this.nome} ainda não tem equipe recomendada`);
    return this._equipe;
  }
}
