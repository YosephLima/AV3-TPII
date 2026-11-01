import { randomUUID } from 'node:crypto';
import type { RecomendacaoStrategy } from '../estrategias/RecomendacaoStrategy';
import type { VisitanteProjeto } from '../visitantes/VisitanteProjeto';
import type { ServicoProjeto } from '../servicos/ServicoProjeto';
import { Competencia } from './Competencia';
import type { Equipe } from './Equipe';
import type { Papel } from './Papel';
import type { Profissional } from './Profissional';

/**
 * O que o projeto pede de um papel, resumido das folhas da árvore de serviços: o custo somado dos serviços
 * do papel e o maior nível pedido de cada competência.
 */
export interface RequisitoPapel {
  papel: Papel;
  custo: number;
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
  servicoPrincipal: ServicoProjeto;
  restricoes: Restricoes;
  estrategia?: RecomendacaoStrategy;
  /** Preferência do produtor para a pilha de decoradores (de fora para dentro). */
  decoradores?: string[];
}

/** As restrições podem ser ajustadas campo a campo. */
export type AjustesProjeto = Partial<Omit<DadosProjeto, 'restricoes'>> & { restricoes?: Partial<Restricoes> };

export abstract class Projeto {
  /** Chave usada para achar a fábrica. */
  abstract readonly tipo: string;
  readonly id: string;
  readonly nome: string;
  readonly produtor: string;
  readonly genero: string;
  /** Em minutos. */
  readonly duracao: number;
  /** Composite: substitui a antiga lista de papéis. */
  readonly servicoPrincipal: ServicoProjeto;
  readonly restricoes: Restricoes;
  /** Definida pelo produtor na criação, se ele quiser. */
  readonly estrategia: RecomendacaoStrategy | undefined;
  readonly decoradores: string[] | undefined;
  private _equipe: Equipe | undefined;

  constructor(dados: DadosProjeto) {
    this.id = dados.id ?? randomUUID();
    this.nome = dados.nome;
    this.produtor = dados.produtor;
    this.genero = dados.genero;
    this.duracao = dados.duracao;
    this.servicoPrincipal = dados.servicoPrincipal;
    this.restricoes = dados.restricoes;
    this.estrategia = dados.estrategia;
    this.decoradores = dados.decoradores;
  }

  /** Prototype: cópia profunda da mesma subclasse. O clone ganha outro id e vem sem equipe. */
  abstract clonar(ajustes?: AjustesProjeto): Projeto;

  get orcamento(): number {
    return this.restricoes.orcamento;
  }

  get prazo(): Date {
    return this.restricoes.prazo;
  }

  get equipe(): Equipe | undefined {
    return this._equipe;
  }

  /** Um requisito por papel, na ordem em que o papel aparece pela primeira vez na árvore. */
  get papeis(): RequisitoPapel[] {
    const porPapel = new Map<Papel, { custo: number; niveis: Map<string, number> }>();
    for (const servico of this.servicoPrincipal.servicosAtomicos()) {
      const atual = porPapel.get(servico.papelNecessario) ?? { custo: 0, niveis: new Map<string, number>() };
      atual.custo += servico.custoBase;
      for (const { nome, nivel } of servico.competenciasDesejadas) {
        atual.niveis.set(nome, Math.max(nivel, atual.niveis.get(nome) ?? 0));
      }
      porPapel.set(servico.papelNecessario, atual);
    }
    return [...porPapel].map(([papel, { custo, niveis }]) => ({
      papel,
      custo,
      competenciasDesejadas: [...niveis].map(([nome, nivel]) => new Competencia(nome, nivel)),
    }));
  }

  requisito(papel: Papel): RequisitoPapel | undefined {
    return this.papeis.find((r) => r.papel === papel);
  }

  /** Custo estimado dos serviços; a árvore faz a soma. */
  calcularCustoTotal(): number {
    return this.servicoPrincipal.calcularCusto();
  }

  /** Fatia do orçamento proporcional ao custo dos serviços do papel. */
  tetoPorPapel(papel: Papel): number {
    const custoTotal = this.calcularCustoTotal();
    const custo = this.requisito(papel)?.custo ?? 0;
    return custoTotal === 0 ? 0 : (this.orcamento * custo) / custoTotal;
  }

  validarEstrutura(): boolean {
    return this.problemasEstrutura().length === 0;
  }

  /** Valida a árvore inteira e confere prazos e custos contra a entrega e o orçamento. */
  problemasEstrutura(): string[] {
    const problemas = this.servicoPrincipal.problemas();
    const atomicos = this.servicoPrincipal.servicosAtomicos();
    const repetidos = new Set(atomicos.filter((s, i) => atomicos.indexOf(s) !== i));
    for (const servico of repetidos) problemas.push(`O serviço ${servico.nome} aparece mais de uma vez`);

    for (const servico of atomicos) {
      if (servico.prazoBase > this.prazo) problemas.push(`O serviço ${servico.nome} termina depois da entrega`);
    }
    const custo = this.calcularCustoTotal();
    if (custo > this.orcamento) {
      problemas.push(`Custo estimado dos serviços (${custo}) excede o orçamento (${this.orcamento})`);
    }
    return problemas;
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

  /**
   * Copia a árvore de serviços e as restrições sem compartilhar referências. Se só a entrega mudar, os
   * prazos dos serviços acompanham a nova data.
   */
  protected dadosClonados(ajustes: AjustesProjeto): DadosProjeto {
    const prazo = new Date(ajustes.restricoes?.prazo ?? this.prazo);
    const deslocamento = prazo.getTime() - this.prazo.getTime();
    return {
      id: ajustes.id,
      nome: ajustes.nome ?? this.nome,
      produtor: ajustes.produtor ?? this.produtor,
      genero: ajustes.genero ?? this.genero,
      duracao: ajustes.duracao ?? this.duracao,
      servicoPrincipal: ajustes.servicoPrincipal?.clonar() ?? this.servicoPrincipal.clonar(deslocamento),
      restricoes: {
        orcamento: ajustes.restricoes?.orcamento ?? this.orcamento,
        prazo,
        localizacao: ajustes.restricoes?.localizacao ?? this.restricoes.localizacao,
      },
      // Estratégias não guardam estado, então podem ser compartilhadas entre clones.
      estrategia: ajustes.estrategia ?? this.estrategia,
      decoradores: (ajustes.decoradores ?? this.decoradores)?.slice(),
    };
  }

  private equipeAtual(): Equipe {
    if (!this._equipe) throw new Error(`O projeto ${this.nome} ainda não tem equipe recomendada`);
    return this._equipe;
  }
}
