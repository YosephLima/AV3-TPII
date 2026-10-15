import type { VisitanteProjeto } from '../visitantes/VisitanteProjeto';
import type { Avaliacao } from './Avaliacao';
import { vetorDe, type Competencia, type VetorCompetencia } from './Competencia';
import type { Papel } from './Papel';

export interface Intervalo {
  inicio: Date;
  fim: Date;
}

export interface DadosProfissional {
  id: string;
  nome: string;
  especialidades: Papel[];
  competencias: Competencia[];
  avaliacoes?: Avaliacao[];
  precoMedio: number;
  disponibilidade: Intervalo;
  localizacao: string;
  projetosAnteriores?: string[];
}

export class Profissional {
  readonly id: string;
  readonly nome: string;
  readonly especialidades: Papel[];
  readonly competencias: Competencia[];
  readonly avaliacoes: Avaliacao[];
  readonly precoMedio: number;
  readonly disponibilidade: Intervalo;
  readonly localizacao: string;
  readonly projetosAnteriores: string[];

  constructor(dados: DadosProfissional) {
    this.id = dados.id;
    this.nome = dados.nome;
    this.especialidades = dados.especialidades;
    this.competencias = dados.competencias;
    this.avaliacoes = dados.avaliacoes ?? [];
    this.precoMedio = dados.precoMedio;
    this.disponibilidade = dados.disponibilidade;
    this.localizacao = dados.localizacao;
    this.projetosAnteriores = dados.projetosAnteriores ?? [];
  }

  atuaComo(papel: Papel): boolean {
    return this.especialidades.includes(papel);
  }

  notaMedia(): number {
    if (this.avaliacoes.length === 0) return 0;
    return this.avaliacoes.reduce((soma, a) => soma + a.nota, 0) / this.avaliacoes.length;
  }

  vetorCompetencias(): VetorCompetencia {
    return vetorDe(this.competencias);
  }

  podeIniciarAte(data: Date): boolean {
    return this.disponibilidade.inicio <= data;
  }

  aceitar<R>(visitante: VisitanteProjeto<R>): R {
    return visitante.visitarProfissional(this);
  }
}
