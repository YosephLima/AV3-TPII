import { performance } from 'node:perf_hooks';
import type { Recomendacoes } from '../dominio/Equipe';
import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';
import type { RecomendacaoStrategy } from '../estrategias/RecomendacaoStrategy';
import { DecoradorRecomendacao, descreverPilha } from './DecoradorRecomendacao';

export interface ChamadaAuditada {
  data: string;
  estrategia: string;
  projetoId: string;
  candidatos: number;
  /** Quantos profissionais voltaram em cada papel. */
  resultado: Record<string, number>;
  duracaoMs: number;
  erro?: string;
}

/** Guarda as últimas chamadas (com limite) e escreve cada uma no log. Fica fora do decorador, como o cache. */
export class RegistroChamadas {
  private readonly chamadas: ChamadaAuditada[] = [];

  constructor(
    private readonly escrever: (linha: string) => void = (linha) => console.log(linha),
    private readonly limite = 1_000,
  ) {}

  registrar(chamada: ChamadaAuditada): void {
    this.chamadas.push(chamada);
    if (this.chamadas.length > this.limite) this.chamadas.shift();
    this.escrever(JSON.stringify(chamada));
  }

  todas(): ChamadaAuditada[] {
    return [...this.chamadas];
  }
}

export interface Relogio {
  agora(): Date;
  /** Em milissegundos, para medir duração. */
  medir(): number;
}

const relogioDoSistema: Relogio = { agora: () => new Date(), medir: () => performance.now() };

/** Registra toda chamada, inclusive as que falham, com o tempo de resposta. */
export class AuditoriaDecorator extends DecoradorRecomendacao {
  protected readonly camada = 'auditoria';

  constructor(
    recomendador: RecomendacaoStrategy,
    private readonly registro: RegistroChamadas = new RegistroChamadas(),
    private readonly relogio: Relogio = relogioDoSistema,
  ) {
    super(recomendador);
  }

  recomendar(projeto: Projeto, profissionais: Profissional[]): Recomendacoes {
    const inicio = this.relogio.medir();
    let resultado: Recomendacoes | undefined;
    let erro: string | undefined;
    try {
      resultado = this.recomendador.recomendar(projeto, profissionais);
      return resultado;
    } catch (falha) {
      erro = falha instanceof Error ? falha.message : String(falha);
      throw falha;
    } finally {
      this.registro.registrar({
        data: this.relogio.agora().toISOString(),
        estrategia: descreverPilha(this.recomendador),
        projetoId: projeto.id,
        candidatos: profissionais.length,
        resultado: Object.fromEntries([...(resultado ?? [])].map(([papel, ranking]) => [papel, ranking.length])),
        duracaoMs: Number((this.relogio.medir() - inicio).toFixed(3)),
        ...(erro === undefined ? {} : { erro }),
      });
    }
  }
}
