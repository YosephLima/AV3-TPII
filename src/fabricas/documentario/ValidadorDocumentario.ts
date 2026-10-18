import type { ProjetoDocumentario } from '../../dominio/ProjetoDocumentario';
import { ValidadorConsistencia } from '../../visitantes/ValidadorConsistencia';

export class ValidadorDocumentario extends ValidadorConsistencia {
  protected override validarTipo(projeto: ProjetoDocumentario): void {
    if (!projeto.tema.trim()) this.registrarErro('Documentário sem tema definido');
    if (projeto.entrevistados.length === 0) this.registrarErro('Documentário sem entrevistados previstos');
  }
}
