import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';
import type { VisitanteProjeto } from './VisitanteProjeto';

/** Confere se todos os papéis estão preenchidos e se a equipe cabe no orçamento. */
export class ValidadorConsistencia implements VisitanteProjeto<boolean> {
  private _erros: string[] = [];

  get erros(): string[] {
    return [...this._erros];
  }

  visitarProjeto(projeto: Projeto): boolean {
    this._erros = [];
    const equipe = projeto.equipe;
    if (!equipe) {
      this._erros.push('Projeto sem equipe recomendada');
      return false;
    }

    for (const { papel } of projeto.papeis) {
      const membro = equipe.membro(papel);
      if (!membro) this._erros.push(`Papel ${papel} sem profissional`);
      else if (!membro.profissional.aceitar(this)) this._erros.push(`Cadastro inconsistente: ${membro.profissional.nome}`);
    }

    const custo = equipe.custoTotal();
    if (custo > projeto.orcamento) {
      this._erros.push(`Custo da equipe (${custo}) excede o orçamento (${projeto.orcamento})`);
    }
    return this._erros.length === 0;
  }

  visitarProfissional(profissional: Profissional): boolean {
    return (
      profissional.precoMedio > 0 &&
      profissional.especialidades.length > 0 &&
      profissional.disponibilidade.inicio <= profissional.disponibilidade.fim
    );
  }
}
