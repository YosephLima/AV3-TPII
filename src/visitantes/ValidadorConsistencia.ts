import type { Equipe } from '../dominio/Equipe';
import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';
import type { VisitanteProjeto } from './VisitanteProjeto';

export interface ValidadorProjeto extends VisitanteProjeto<boolean> {
  readonly erros: string[];
}

/** Valida o projeto e, se já houver equipe, a equipe também. As famílias estendem com regras próprias. */
export class ValidadorConsistencia implements ValidadorProjeto {
  private _erros: string[] = [];

  get erros(): string[] {
    return [...this._erros];
  }

  visitarProjeto(projeto: Projeto): boolean {
    this._erros = [];
    this.validarRestricoes(projeto);
    this.validarTipo(projeto);
    if (projeto.equipe) this.validarEquipe(projeto, projeto.equipe);
    return this._erros.length === 0;
  }

  visitarProfissional(profissional: Profissional): boolean {
    return (
      profissional.precoMedio > 0 &&
      profissional.especialidades.length > 0 &&
      profissional.disponibilidade.inicio <= profissional.disponibilidade.fim
    );
  }

  protected validarRestricoes(projeto: Projeto): void {
    if (projeto.orcamento <= 0) this.registrarErro('Orçamento deve ser positivo');
    if (projeto.duracao <= 0) this.registrarErro('Duração deve ser positiva');
    if (projeto.papeis.length === 0) this.registrarErro('Projeto sem papéis técnicos');
    for (const { papel, peso } of projeto.papeis) {
      if (peso <= 0) this.registrarErro(`Papel ${papel} sem peso`);
    }
  }

  /** Cada família sobrescreve com as suas regras. */
  protected validarTipo(_projeto: Projeto): void {}

  protected validarEquipe(projeto: Projeto, equipe: Equipe): void {
    for (const { papel } of projeto.papeis) {
      const membro = equipe.membro(papel);
      if (!membro) this.registrarErro(`Papel ${papel} sem profissional`);
      else if (!membro.profissional.aceitar(this)) this.registrarErro(`Cadastro inconsistente: ${membro.profissional.nome}`);
    }

    const custo = equipe.custoTotal();
    if (custo > projeto.orcamento) {
      this.registrarErro(`Custo da equipe (${custo}) excede o orçamento (${projeto.orcamento})`);
    }
  }

  protected registrarErro(mensagem: string): void {
    this._erros.push(mensagem);
  }
}
