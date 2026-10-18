import type { AjustesProjeto } from '../../dominio/Projeto';
import type { ProjetoFiccao } from '../../dominio/ProjetoFiccao';
import type { EnviarEmail } from '../../observadores/NotificadorEmail';
import { modelosFiccao } from '../../prototipos/modelos';
import { FabricaProjetoBase } from '../FabricaProjeto';

/** Sem regras próprias: usa tudo o que a fábrica base oferece. */
export class FabricaFiccao extends FabricaProjetoBase<ProjetoFiccao> {
  readonly tipo = 'ficcao';

  constructor(enviar?: EnviarEmail, prototipos = modelosFiccao()) {
    super(prototipos, enviar);
  }

  protected clonarModelo(modelo: ProjetoFiccao, ajustes: AjustesProjeto): ProjetoFiccao {
    return modelo.clonar(ajustes);
  }
}
