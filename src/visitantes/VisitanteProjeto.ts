import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';

/** Visitor: operações sobre projeto e profissionais fora das classes de domínio. */
export interface VisitanteProjeto<R> {
  visitarProjeto(projeto: Projeto): R;
  visitarProfissional(profissional: Profissional): R;
}
