import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

export function criarPrisma(url: string): PrismaClient {
  // Sem timeout, o pg fica esperando um banco fora do ar e a reserva nunca entra.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 2000 }) });
}
