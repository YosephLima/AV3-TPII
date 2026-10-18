import type { AjustesProjeto, Projeto } from '../dominio/Projeto';
import type { RecomendacaoStrategy } from '../estrategias/RecomendacaoStrategy';
import { SimilaridadeCosseno } from '../estrategias/SimilaridadeCosseno';
import { NotificadorConvite } from '../observadores/NotificadorConvite';
import { enviarPorConsole, type EnviarEmail } from '../observadores/NotificadorEmail';
import type { Observador } from '../observadores/Observador';
import type { RegistroPrototipos } from '../prototipos/RegistroPrototipos';
import { GeradorRelatorio } from '../visitantes/GeradorRelatorio';
import { ValidadorConsistencia, type ValidadorProjeto } from '../visitantes/ValidadorConsistencia';
import type { VisitanteProjeto } from '../visitantes/VisitanteProjeto';
import type { Detalhes } from './detalhes';

/** Modelo de partida, ajustes comuns e atributos do tipo. */
export type DadosCriacao = AjustesProjeto & {
  modelo?: string;
  detalhes?: Detalhes;
};

/** Abstract Factory: cria a família inteira de um tipo de projeto. */
export interface FabricaProjeto {
  readonly tipo: string;
  modelos(): string[];
  criarProjeto(dados?: DadosCriacao): Projeto;
  criarValidador(): ValidadorProjeto;
  criarRecomendador(): RecomendacaoStrategy;
  criarNotificador(): Observador;
  criarRelatorio(): VisitanteProjeto<string>;
}

/**
 * Os métodos criar* são Factory Methods: têm uma versão genérica aqui e cada família sobrescreve os que
 * precisa. O projeto nasce clonando um modelo.
 */
export abstract class FabricaProjetoBase<P extends Projeto> implements FabricaProjeto {
  abstract readonly tipo: string;

  constructor(
    protected readonly prototipos: RegistroPrototipos<P>,
    protected readonly enviar: EnviarEmail = enviarPorConsole,
  ) {}

  modelos(): string[] {
    return this.prototipos.nomes();
  }

  criarProjeto(dados: DadosCriacao = {}): P {
    const modelo = this.prototipos.modelo(dados.modelo ?? 'padrao');
    return this.clonarModelo(modelo, dados, dados.detalhes ?? {});
  }

  criarValidador(): ValidadorProjeto {
    return new ValidadorConsistencia();
  }

  criarRecomendador(): RecomendacaoStrategy {
    return new SimilaridadeCosseno();
  }

  criarNotificador(): Observador {
    return new NotificadorConvite(this.enviar);
  }

  criarRelatorio(): VisitanteProjeto<string> {
    return new GeradorRelatorio(this.criarValidador());
  }

  protected abstract clonarModelo(modelo: P, ajustes: AjustesProjeto, detalhes: Detalhes): P;
}
