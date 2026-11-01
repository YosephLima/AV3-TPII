import type { ServicoAtomico } from './ServicoAtomico';
import { ComposicaoInvalidaError, descreverCaminho, type ServicoProjeto } from './ServicoProjeto';

/** Nó composto: pode conter serviços atômicos e outros pacotes, em qualquer profundidade. */
export class PacoteServico implements ServicoProjeto {
  private readonly servicos: ServicoProjeto[] = [];

  constructor(
    readonly nome: string,
    servicos: ServicoProjeto[] = [],
  ) {
    for (const servico of servicos) this.adicionarServico(servico);
  }

  /** Recusa o que criaria ciclo ou contaria o mesmo serviço duas vezes. */
  adicionarServico(servico: ServicoProjeto): this {
    if (servico.contem(this)) {
      throw new ComposicaoInvalidaError(`"${servico.nome}" contém "${this.nome}" e não pode ficar dentro dele`);
    }
    if (this.contem(servico) || servico.servicosAtomicos().some((atomico) => this.contem(atomico))) {
      throw new ComposicaoInvalidaError(`"${servico.nome}" já faz parte de "${this.nome}"`);
    }
    this.servicos.push(servico);
    return this;
  }

  removerServico(servico: ServicoProjeto): boolean {
    const indice = this.servicos.indexOf(servico);
    if (indice === -1) return false;
    this.servicos.splice(indice, 1);
    return true;
  }

  calcularCusto(): number {
    return this.servicos.reduce((soma, s) => soma + s.calcularCusto(), 0);
  }

  listarSubservicos(): ServicoProjeto[] {
    return [...this.servicos];
  }

  /** O pacote fica pronto quando o último dos seus serviços termina. Vazio, não tem prazo (data inválida). */
  obterPrazo(): Date {
    const prazos = this.servicos.map((s) => s.obterPrazo().getTime());
    return new Date(prazos.length === 0 ? Number.NaN : Math.max(...prazos));
  }

  validar(): boolean {
    return this.problemas().length === 0;
  }

  problemas(caminho: string[] = []): string[] {
    const aqui = [...caminho, this.nome];
    const problemas: string[] = [];
    if (!this.nome.trim()) problemas.push(`${descreverCaminho(aqui)}: pacote sem nome`);
    if (this.servicos.length === 0) problemas.push(`${descreverCaminho(aqui)}: pacote vazio`);
    for (const servico of this.servicos) problemas.push(...servico.problemas(aqui));
    return problemas;
  }

  servicosAtomicos(): ServicoAtomico[] {
    return this.servicos.flatMap((s) => s.servicosAtomicos());
  }

  contem(servico: ServicoProjeto): boolean {
    return servico === this || this.servicos.some((s) => s.contem(servico));
  }

  clonar(deslocamento = 0): PacoteServico {
    return new PacoteServico(
      this.nome,
      this.servicos.map((s) => s.clonar(deslocamento)),
    );
  }
}
