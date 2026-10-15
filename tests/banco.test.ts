import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { profissionaisIniciais } from '../src/dados/profissionais';
import { criarPrisma } from '../src/repositorio/prisma';
import { RepositorioProfissionaisPostgres } from '../src/repositorio/RepositorioProfissionaisPostgres';
import { semear } from '../src/repositorio/semear';

// Só roda com um PostgreSQL disponível (por exemplo, dentro do docker compose).
const url = process.env.DATABASE_URL;

describe.skipIf(!url)('PostgreSQL', () => {
  const prisma = criarPrisma(url ?? '');

  beforeAll(async () => {
    execSync('npx prisma migrate deploy', { stdio: 'ignore' });
    await semear(prisma);
  });

  afterAll(() => prisma.$disconnect());

  it('devolve o mesmo cadastro que a versão em memória', async () => {
    const doBanco = await new RepositorioProfissionaisPostgres(prisma).listar();
    const emMemoria = profissionaisIniciais();

    expect(doBanco.map((p) => p.id)).toEqual(emMemoria.map((p) => p.id));
    expect(doBanco.map((p) => p.notaMedia())).toEqual(emMemoria.map((p) => p.notaMedia()));
    expect(doBanco[13]?.vetorCompetencias()).toEqual(emMemoria[13]?.vetorCompetencias());
  });

  it('semear de novo não duplica nada', async () => {
    await semear(prisma);
    expect(await prisma.profissional.count()).toBe(16);
    expect(await prisma.competencia.count()).toBe(emMemoriaCompetencias());
  });
});

function emMemoriaCompetencias(): number {
  return profissionaisIniciais().reduce((soma, p) => soma + p.competencias.length, 0);
}
