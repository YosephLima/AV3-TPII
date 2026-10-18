import { Projeto, type AjustesProjeto, type DadosProjeto } from './Projeto';

export interface DadosDocumentario extends DadosProjeto {
  tema: string;
  entrevistados: string[];
}

export type AjustesDocumentario = AjustesProjeto & Partial<Pick<DadosDocumentario, 'tema' | 'entrevistados'>>;

export class ProjetoDocumentario extends Projeto {
  readonly tipo = 'documentario';
  readonly tema: string;
  readonly entrevistados: string[];

  constructor(dados: DadosDocumentario) {
    super(dados);
    this.tema = dados.tema;
    this.entrevistados = dados.entrevistados;
  }

  clonar(ajustes: AjustesDocumentario = {}): ProjetoDocumentario {
    return new ProjetoDocumentario({
      ...this.dadosClonados(ajustes),
      tema: ajustes.tema ?? this.tema,
      entrevistados: [...(ajustes.entrevistados ?? this.entrevistados)],
    });
  }
}
