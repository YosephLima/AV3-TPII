import { profissionaisIniciais } from '../dados/profissionais';
import type { PrismaClient } from '../../generated/prisma/client';

/** Só cria quem ainda não existe, então pode rodar mais de uma vez. */
export async function semear(prisma: PrismaClient): Promise<void> {
  for (const p of profissionaisIniciais()) {
    await prisma.profissional.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        nome: p.nome,
        especialidades: p.especialidades,
        precoMedio: p.precoMedio,
        disponivelDe: p.disponibilidade.inicio,
        disponivelAte: p.disponibilidade.fim,
        localizacao: p.localizacao,
        projetosAnteriores: p.projetosAnteriores,
        competencias: { create: p.competencias.map((c) => ({ nome: c.nome, nivel: c.nivel })) },
        avaliacoes: { create: p.avaliacoes.map((a) => ({ nota: a.nota, comentario: a.comentario, data: a.data })) },
      },
    });
  }
}
