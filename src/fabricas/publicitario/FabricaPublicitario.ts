import type { AjustesProjeto } from '../../dominio/Projeto';
import type { ProjetoPublicitario } from '../../dominio/ProjetoPublicitario';
import type { RecomendacaoStrategy } from '../../estrategias/RecomendacaoStrategy';
import type { EnviarEmail } from '../../observadores/NotificadorEmail';
import type { Observador } from '../../observadores/Observador';
import { modelosPublicitario } from '../../prototipos/modelos';
import type { ValidadorProjeto } from '../../visitantes/ValidadorConsistencia';
import { texto, type Detalhes } from '../detalhes';
import { FabricaProjetoBase } from '../FabricaProjeto';
import { NotificadorPublicitario } from './NotificadorPublicitario';
import { RecomendadorPublicitario } from './RecomendadorPublicitario';
import { ValidadorPublicitario } from './ValidadorPublicitario';

export class FabricaPublicitario extends FabricaProjetoBase<ProjetoPublicitario> {
  readonly tipo = 'publicitario';

  constructor(enviar?: EnviarEmail, prototipos = modelosPublicitario()) {
    super(prototipos, enviar);
  }

  override criarValidador(): ValidadorProjeto {
    return new ValidadorPublicitario();
  }

  override criarRecomendador(): RecomendacaoStrategy {
    return new RecomendadorPublicitario();
  }

  override criarNotificador(): Observador {
    return new NotificadorPublicitario(this.enviar);
  }

  protected clonarModelo(modelo: ProjetoPublicitario, ajustes: AjustesProjeto, detalhes: Detalhes): ProjetoPublicitario {
    return modelo.clonar({
      ...ajustes,
      cliente: texto(detalhes, 'cliente'),
      veiculacao: texto(detalhes, 'veiculacao'),
    });
  }
}
