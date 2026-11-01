import { randomUUID } from 'node:crypto';
import { Competencia } from '../dominio/Competencia';
import { Papel } from '../dominio/Papel';
import { descreverCaminho, type ServicoProjeto } from './ServicoProjeto';

export interface DadosServicoAtomico {
  id?: string;
  nome: string;
  custoBase: number;
  /** Data em que o serviço precisa estar pronto. */
  prazoBase: Date;
  papelNecessario: Papel;
  competenciasDesejadas?: Competencia[];
}

const PAPEIS_VALIDOS: readonly string[] = Object.values(Papel);

/** Folha da árvore: um serviço feito por um profissional de um papel, como montagem ou mixagem. */
export class ServicoAtomico implements ServicoProjeto {
  readonly id: string;
  readonly nome: string;
  readonly custoBase: number;
  readonly prazoBase: Date;
  readonly papelNecessario: Papel;
  readonly competenciasDesejadas: Competencia[];

  constructor(dados: DadosServicoAtomico) {
    this.id = dados.id ?? randomUUID();
    this.nome = dados.nome;
    this.custoBase = dados.custoBase;
    this.prazoBase = dados.prazoBase;
    this.papelNecessario = dados.papelNecessario;
    this.competenciasDesejadas = dados.competenciasDesejadas ?? [];
  }

  calcularCusto(): number {
    return this.custoBase;
  }

  listarSubservicos(): ServicoProjeto[] {
    return [];
  }

  obterPrazo(): Date {
    return this.prazoBase;
  }

  validar(): boolean {
    return this.problemas().length === 0;
  }

  problemas(caminho: string[] = []): string[] {
    const onde = descreverCaminho([...caminho, this.nome]);
    const problemas: string[] = [];
    if (!this.nome.trim()) problemas.push(`${onde}: serviço sem nome`);
    if (!PAPEIS_VALIDOS.includes(this.papelNecessario)) problemas.push(`${onde}: papel inválido (${this.papelNecessario})`);
    if (!Number.isFinite(this.custoBase) || this.custoBase <= 0) problemas.push(`${onde}: custo deve ser positivo`);
    if (Number.isNaN(this.prazoBase.getTime())) problemas.push(`${onde}: prazo inválido`);
    return problemas;
  }

  servicosAtomicos(): ServicoAtomico[] {
    return [this];
  }

  contem(servico: ServicoProjeto): boolean {
    return servico === this;
  }

  clonar(deslocamento = 0): ServicoAtomico {
    return new ServicoAtomico({
      nome: this.nome,
      custoBase: this.custoBase,
      prazoBase: new Date(this.prazoBase.getTime() + deslocamento),
      papelNecessario: this.papelNecessario,
      competenciasDesejadas: this.competenciasDesejadas.map((c) => new Competencia(c.nome, c.nivel)),
    });
  }
}
