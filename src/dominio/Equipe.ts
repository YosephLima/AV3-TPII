import { randomUUID } from 'node:crypto';
import type { Papel } from './Papel';
import type { Profissional } from './Profissional';

export type Recomendacoes = Map<Papel, Profissional[]>;

export class MembroEquipe {
  private _confirmado = false;
  /** Id do pagamento no provedor, depois que a equipe é formada. */
  pagamentoId: string | undefined;

  constructor(
    readonly papel: Papel,
    readonly profissional: Profissional,
  ) {}

  get confirmado(): boolean {
    return this._confirmado;
  }

  confirmar(): void {
    this._confirmado = true;
  }
}

export type StatusEquipe = 'proposta' | 'formada' | 'descartada';

export class Equipe {
  readonly id: string;
  readonly dataFormacao: Date;
  status: StatusEquipe = 'proposta';
  /** Quem já foi substituído não volta nas próximas rodadas. */
  readonly substituidos = new Set<string>();

  /** O ranking guarda a lista completa de cada papel, para mostrar alternativas. */
  constructor(
    readonly membros: MembroEquipe[],
    readonly ranking: Recomendacoes = new Map(),
    id: string = randomUUID(),
    dataFormacao: Date = new Date(),
  ) {
    this.id = id;
    this.dataFormacao = dataFormacao;
  }

  membro(papel: Papel): MembroEquipe | undefined {
    return this.membros.find((m) => m.papel === papel);
  }

  custoTotal(): number {
    return this.membros.reduce((soma, m) => soma + m.profissional.precoMedio, 0);
  }

  todosConfirmados(): boolean {
    return this.membros.length > 0 && this.membros.every((m) => m.confirmado);
  }

  substituir(papel: Papel, profissional: Profissional): MembroEquipe {
    const indice = this.membros.findIndex((m) => m.papel === papel);
    const novo = new MembroEquipe(papel, profissional);
    const anterior = this.membros[indice];
    if (anterior) {
      this.substituidos.add(anterior.profissional.id);
      this.membros[indice] = novo;
    } else {
      this.membros.push(novo);
    }
    this.status = 'proposta';
    return novo;
  }

  descartar(): void {
    this.status = 'descartada';
  }
}
