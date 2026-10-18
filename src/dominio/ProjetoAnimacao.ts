import { Projeto, type AjustesProjeto, type DadosProjeto } from './Projeto';

export interface DadosAnimacao extends DadosProjeto {
  /** 2d, 3d, stop-motion... */
  tecnica: string;
  quadrosPorSegundo: number;
}

export type AjustesAnimacao = AjustesProjeto & Partial<Pick<DadosAnimacao, 'tecnica' | 'quadrosPorSegundo'>>;

export class ProjetoAnimacao extends Projeto {
  readonly tipo = 'animacao';
  readonly tecnica: string;
  readonly quadrosPorSegundo: number;

  constructor(dados: DadosAnimacao) {
    super(dados);
    this.tecnica = dados.tecnica;
    this.quadrosPorSegundo = dados.quadrosPorSegundo;
  }

  get totalDeQuadros(): number {
    return Math.round(this.duracao * 60 * this.quadrosPorSegundo);
  }

  clonar(ajustes: AjustesAnimacao = {}): ProjetoAnimacao {
    return new ProjetoAnimacao({
      ...this.dadosClonados(ajustes),
      tecnica: ajustes.tecnica ?? this.tecnica,
      quadrosPorSegundo: ajustes.quadrosPorSegundo ?? this.quadrosPorSegundo,
    });
  }
}
