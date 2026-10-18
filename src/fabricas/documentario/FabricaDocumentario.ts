import type { AjustesProjeto } from '../../dominio/Projeto';
import type { ProjetoDocumentario } from '../../dominio/ProjetoDocumentario';
import type { RecomendacaoStrategy } from '../../estrategias/RecomendacaoStrategy';
import type { EnviarEmail } from '../../observadores/NotificadorEmail';
import type { Observador } from '../../observadores/Observador';
import { modelosDocumentario } from '../../prototipos/modelos';
import type { ValidadorProjeto } from '../../visitantes/ValidadorConsistencia';
import { listaDeTextos, texto, type Detalhes } from '../detalhes';
import { FabricaProjetoBase } from '../FabricaProjeto';
import { NotificadorDocumentario } from './NotificadorDocumentario';
import { RecomendadorDocumentario } from './RecomendadorDocumentario';
import { ValidadorDocumentario } from './ValidadorDocumentario';

export class FabricaDocumentario extends FabricaProjetoBase<ProjetoDocumentario> {
  readonly tipo = 'documentario';

  constructor(enviar?: EnviarEmail, prototipos = modelosDocumentario()) {
    super(prototipos, enviar);
  }

  override criarValidador(): ValidadorProjeto {
    return new ValidadorDocumentario();
  }

  override criarRecomendador(): RecomendacaoStrategy {
    return new RecomendadorDocumentario();
  }

  override criarNotificador(): Observador {
    return new NotificadorDocumentario(this.enviar);
  }

  protected clonarModelo(modelo: ProjetoDocumentario, ajustes: AjustesProjeto, detalhes: Detalhes): ProjetoDocumentario {
    return modelo.clonar({
      ...ajustes,
      tema: texto(detalhes, 'tema'),
      entrevistados: listaDeTextos(detalhes, 'entrevistados'),
    });
  }
}
