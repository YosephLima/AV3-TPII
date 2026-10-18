import type { ProjetoPublicitario } from '../../dominio/ProjetoPublicitario';
import { ValidadorConsistencia } from '../../visitantes/ValidadorConsistencia';

export class ValidadorPublicitario extends ValidadorConsistencia {
  /** Em minutos. */
  static readonly DURACAO_MAXIMA = 3;

  protected override validarTipo(projeto: ProjetoPublicitario): void {
    if (!projeto.cliente.trim()) this.registrarErro('Peça publicitária sem cliente');
    if (!projeto.veiculacao.trim()) this.registrarErro('Peça publicitária sem meio de veiculação');
    if (projeto.duracao > ValidadorPublicitario.DURACAO_MAXIMA) {
      this.registrarErro(`Peça publicitária acima de ${ValidadorPublicitario.DURACAO_MAXIMA} minutos`);
    }
  }
}
