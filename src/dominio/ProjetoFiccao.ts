import { Projeto, type AjustesProjeto } from './Projeto';

export class ProjetoFiccao extends Projeto {
  readonly tipo = 'ficcao';

  clonar(ajustes: AjustesProjeto = {}): ProjetoFiccao {
    return new ProjetoFiccao(this.dadosClonados(ajustes));
  }
}
