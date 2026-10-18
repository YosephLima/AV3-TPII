import type { AjustesProjeto } from '../../dominio/Projeto';
import type { ProjetoAnimacao } from '../../dominio/ProjetoAnimacao';
import type { RecomendacaoStrategy } from '../../estrategias/RecomendacaoStrategy';
import type { EnviarEmail } from '../../observadores/NotificadorEmail';
import type { Observador } from '../../observadores/Observador';
import { modelosAnimacao } from '../../prototipos/modelos';
import type { ValidadorProjeto } from '../../visitantes/ValidadorConsistencia';
import type { VisitanteProjeto } from '../../visitantes/VisitanteProjeto';
import { numero, texto, type Detalhes } from '../detalhes';
import { FabricaProjetoBase } from '../FabricaProjeto';
import { NotificadorAnimacao } from './NotificadorAnimacao';
import { RecomendadorAnimacao } from './RecomendadorAnimacao';
import { RelatorioAnimacao } from './RelatorioAnimacao';
import { ValidadorAnimacao } from './ValidadorAnimacao';

export class FabricaAnimacao extends FabricaProjetoBase<ProjetoAnimacao> {
  readonly tipo = 'animacao';

  constructor(enviar?: EnviarEmail, prototipos = modelosAnimacao()) {
    super(prototipos, enviar);
  }

  override criarValidador(): ValidadorProjeto {
    return new ValidadorAnimacao();
  }

  override criarRecomendador(): RecomendacaoStrategy {
    return new RecomendadorAnimacao();
  }

  override criarNotificador(): Observador {
    return new NotificadorAnimacao(this.enviar);
  }

  override criarRelatorio(): VisitanteProjeto<string> {
    return new RelatorioAnimacao(this.criarValidador());
  }

  protected clonarModelo(modelo: ProjetoAnimacao, ajustes: AjustesProjeto, detalhes: Detalhes): ProjetoAnimacao {
    return modelo.clonar({
      ...ajustes,
      tecnica: texto(detalhes, 'tecnica'),
      quadrosPorSegundo: numero(detalhes, 'quadrosPorSegundo'),
    });
  }
}
