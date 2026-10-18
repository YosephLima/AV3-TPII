import { describe, expect, it, vi } from 'vitest';
import { Papel } from '../src/dominio/Papel';
import { AuditoriaRecomendacao } from '../src/observadores/AuditoriaRecomendacao';
import { BarramentoEmMemoria } from '../src/observadores/BarramentoEventos';
import { EventoRecomendacao, type TipoEvento } from '../src/observadores/EventoRecomendacao';
import { NotificadorConvite } from '../src/observadores/NotificadorConvite';
import { NotificadorEmail, type Email } from '../src/observadores/NotificadorEmail';
import { NotificadorInterno } from '../src/observadores/NotificadorInterno';
import { criarProjeto } from './fixtures';

const projeto = criarProjeto({ id: 'proj-1' });

const evento = (tipo: TipoEvento) =>
  new EventoRecomendacao(
    tipo,
    projeto,
    [
      { profissionalId: 'p01', nome: 'Ana Ribeiro', papel: Papel.DIRETOR },
      { profissionalId: 'p07', nome: 'Gabriela Souza', papel: Papel.SONOPLASTA },
    ],
    'teste',
  );

describe('Observer', () => {
  it('cada observador reage ao mesmo evento do seu jeito', () => {
    const emails: Email[] = [];
    const linhas: string[] = [];
    const barramento = new BarramentoEmMemoria();
    const convite = new NotificadorConvite((e) => emails.push(e));
    const interno = new NotificadorInterno();
    const auditoria = new AuditoriaRecomendacao((l) => linhas.push(l));
    for (const o of [convite, interno, auditoria]) barramento.inscrever((e) => o.atualizar(e));

    barramento.publicar(evento('recomendacao_gerada'));

    expect(emails.map((e) => e.para)).toEqual(['p01', 'p07']);
    expect(interno.mensagensDe('p01')).toEqual(['[recomendacao_gerada] Vozes do Sertão: DIRETOR']);
    expect(interno.mensagensDe('produtora@exemplo.com')).toHaveLength(1);
    expect(JSON.parse(linhas[0] ?? '')).toMatchObject({
      evento: 'recomendacao_gerada',
      projetoId: 'proj-1',
      profissionais: ['p01', 'p07'],
    });
  });

  it('a falha de um observador não impede os outros de serem notificados', () => {
    const aoFalhar = vi.fn();
    const barramento = new BarramentoEmMemoria(aoFalhar);
    const interno = new NotificadorInterno();
    barramento.inscrever(() => {
      throw new Error('servidor de e-mail fora do ar');
    });
    barramento.inscrever((e) => interno.atualizar(e));

    barramento.publicar(evento('recomendacao_gerada'));

    expect(aoFalhar).toHaveBeenCalledOnce();
    expect(interno.mensagensDe('p01')).toHaveLength(1);
  });

  it('convites só saem quando há profissionais a convidar', () => {
    const emails: Email[] = [];
    const convite = new NotificadorConvite((e) => emails.push(e));

    convite.atualizar(evento('membro_substituido'));
    convite.atualizar(evento('convite_aceito'));
    convite.atualizar(evento('equipe_formada'));

    expect(emails).toHaveLength(2);
    expect(emails[0]?.corpo).toBe('Um produtor tem interesse em você como DIRETOR no projeto Vozes do Sertão.');
  });

  it('respostas a convites e equipe formada são avisadas ao produtor', () => {
    const emails: Email[] = [];
    const notificador = new NotificadorEmail((e) => emails.push(e));

    for (const tipo of ['recomendacao_gerada', 'convite_aceito', 'convite_recusado', 'equipe_formada'] as const) {
      notificador.atualizar(evento(tipo));
    }
    notificador.atualizar(evento('reavaliacao_solicitada'));

    expect(emails.every((e) => e.para === 'produtora@exemplo.com')).toBe(true);
    expect(emails.map((e) => e.corpo)).toEqual([
      'Ana Ribeiro aceitou o convite para DIRETOR.',
      'Gabriela Souza aceitou o convite para SONOPLASTA.',
      'Ana Ribeiro recusou o convite para DIRETOR.',
      'Gabriela Souza recusou o convite para SONOPLASTA.',
      'Todos confirmaram.',
    ]);
  });

  it('a auditoria guarda todos os registros em ordem', () => {
    const auditoria = new AuditoriaRecomendacao(() => {});
    auditoria.atualizar(evento('recomendacao_gerada'));
    auditoria.atualizar(evento('convite_aceito'));
    expect(auditoria.registros.map((r) => r.evento)).toEqual(['recomendacao_gerada', 'convite_aceito']);
  });
});
