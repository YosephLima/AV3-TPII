import { describe, expect, it, vi } from 'vitest';
import { profissionaisIniciais } from '../src/dados/profissionais';
import { Avaliacao } from '../src/dominio/Avaliacao';
import { Papel } from '../src/dominio/Papel';
import { RepositorioComReserva } from '../src/repositorio/RepositorioComReserva';
import { RepositorioProfissionaisMemoria, type RepositorioProfissionais } from '../src/repositorio/RepositorioProfissionais';
import { RepositorioProfissionaisPostgres } from '../src/repositorio/RepositorioProfissionaisPostgres';
import { repositorioDoAmbiente } from '../src/repositorio/doAmbiente';

const registroDoBanco = {
  id: 'p99',
  nome: 'Rita Lopes',
  especialidades: ['EDITOR', 'EFEITOS_VISUAIS'],
  precoMedio: 7000,
  disponivelDe: new Date('2026-01-01'),
  disponivelAte: new Date('2027-12-31'),
  localizacao: 'Salvador',
  projetosAnteriores: ['Curta A'],
  competencias: [{ nome: 'montagem', nivel: 8 }],
  avaliacoes: [{ nota: 4, comentario: 'pontual', data: new Date('2025-05-01') }],
};

describe('Repositórios de profissionais', () => {
  it('converte os registros do banco em objetos do domínio', async () => {
    const findMany = vi.fn().mockResolvedValue([registroDoBanco]);
    const repositorio = new RepositorioProfissionaisPostgres({ profissional: { findMany } } as never);

    const [rita] = await repositorio.listar();

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ include: { competencias: true, avaliacoes: true } }));
    expect(rita?.especialidades).toEqual([Papel.EDITOR, Papel.EFEITOS_VISUAIS]);
    expect(rita?.vetorCompetencias().get('montagem')).toBe(8);
    expect(rita?.notaMedia()).toBe(4);
    expect(rita?.disponibilidade.fim).toEqual(new Date('2027-12-31'));
  });

  it('usa o cadastro reserva quando o principal falha', async () => {
    const aoFalhar = vi.fn();
    const recusar = () => Promise.reject(new Error('conexão recusada'));
    const foraDoAr: RepositorioProfissionais = { listar: recusar, registrarAvaliacao: recusar };
    const reserva = new RepositorioProfissionaisMemoria(profissionaisIniciais());
    const comReserva = new RepositorioComReserva(foraDoAr, reserva, aoFalhar);

    expect(await comReserva.listar()).toHaveLength(16);
    await comReserva.registrarAvaliacao('p06', new Avaliacao(5, 'ótimo', new Date()));

    expect((await reserva.listar()).find((p) => p.id === 'p06')?.notaMedia()).toBe(5);
    expect(aoFalhar).toHaveBeenCalledTimes(2);
  });

  it('grava a avaliação no PostgreSQL', async () => {
    const create = vi.fn().mockResolvedValue({});
    const data = new Date('2026-11-01');
    await new RepositorioProfissionaisPostgres({ avaliacao: { create } } as never).registrarAvaliacao('p01', new Avaliacao(4, 'pontual', data));
    expect(create).toHaveBeenCalledWith({ data: { profissionalId: 'p01', nota: 4, comentario: 'pontual', data } });
  });

  it('sem DATABASE_URL o cadastro fica só em memória', async () => {
    const repositorio = repositorioDoAmbiente('');
    expect(repositorio).toBeInstanceOf(RepositorioProfissionaisMemoria);
    expect(await repositorio.listar()).toHaveLength(16);
  });

  it('com DATABASE_URL e banco fora do ar, a recomendação continua pelo cadastro reserva', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const repositorio = repositorioDoAmbiente('postgresql://ninguem:nada@127.0.0.1:1/inexistente');

    expect(repositorio).toBeInstanceOf(RepositorioComReserva);
    expect(await repositorio.listar()).toHaveLength(16);
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });
});
