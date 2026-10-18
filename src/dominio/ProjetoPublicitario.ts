import { Projeto, type AjustesProjeto, type DadosProjeto } from './Projeto';

export interface DadosPublicitario extends DadosProjeto {
  cliente: string;
  /** tv, internet, cinema... */
  veiculacao: string;
}

export type AjustesPublicitario = AjustesProjeto & Partial<Pick<DadosPublicitario, 'cliente' | 'veiculacao'>>;

export class ProjetoPublicitario extends Projeto {
  readonly tipo = 'publicitario';
  readonly cliente: string;
  readonly veiculacao: string;

  constructor(dados: DadosPublicitario) {
    super(dados);
    this.cliente = dados.cliente;
    this.veiculacao = dados.veiculacao;
  }

  clonar(ajustes: AjustesPublicitario = {}): ProjetoPublicitario {
    return new ProjetoPublicitario({
      ...this.dadosClonados(ajustes),
      cliente: ajustes.cliente ?? this.cliente,
      veiculacao: ajustes.veiculacao ?? this.veiculacao,
    });
  }
}
