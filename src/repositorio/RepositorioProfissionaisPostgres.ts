import { Avaliacao } from '../dominio/Avaliacao';
import { Competencia } from '../dominio/Competencia';
import { Papel } from '../dominio/Papel';
import { Profissional } from '../dominio/Profissional';
import type { PrismaClient } from '../../generated/prisma/client';
import type { RepositorioProfissionais } from './RepositorioProfissionais';

type ClientePrisma = Pick<PrismaClient, 'profissional'>;

export class RepositorioProfissionaisPostgres implements RepositorioProfissionais {
  constructor(private readonly prisma: ClientePrisma) {}

  async listar(): Promise<Profissional[]> {
    const registros = await this.prisma.profissional.findMany({
      include: { competencias: true, avaliacoes: true },
      orderBy: { id: 'asc' },
    });

    return registros.map(
      (r) =>
        new Profissional({
          id: r.id,
          nome: r.nome,
          especialidades: r.especialidades.map((e) => Papel[e]),
          competencias: r.competencias.map((c) => new Competencia(c.nome, c.nivel)),
          avaliacoes: r.avaliacoes.map((a) => new Avaliacao(a.nota, a.comentario, a.data)),
          precoMedio: r.precoMedio,
          disponibilidade: { inicio: r.disponivelDe, fim: r.disponivelAte },
          localizacao: r.localizacao,
          projetosAnteriores: r.projetosAnteriores,
        }),
    );
  }
}
