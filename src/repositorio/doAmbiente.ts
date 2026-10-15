import { profissionaisIniciais } from '../dados/profissionais';
import { criarPrisma } from './prisma';
import { RepositorioComReserva } from './RepositorioComReserva';
import { RepositorioProfissionaisMemoria, type RepositorioProfissionais } from './RepositorioProfissionais';
import { RepositorioProfissionaisPostgres } from './RepositorioProfissionaisPostgres';

/** Com DATABASE_URL usa o PostgreSQL, com a memória de reserva. Sem ela, só a memória. */
export function repositorioDoAmbiente(url = process.env.DATABASE_URL): RepositorioProfissionais {
  const memoria = new RepositorioProfissionaisMemoria(profissionaisIniciais());
  if (!url) return memoria;
  return new RepositorioComReserva(new RepositorioProfissionaisPostgres(criarPrisma(url)), memoria);
}
