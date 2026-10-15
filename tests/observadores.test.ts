import { describe, expect, it, vi } from 'vitest';
import { Papel } from '../src/dominio/Papel';
import { AuditoriaRecomendacao } from '../src/observadores/AuditoriaRecomendacao';
import { BarramentoEmMemoria } from '../src/observadores/BarramentoEventos';
import { EventoRecomendacao, type TipoEvento } from '../src/observadores/EventoRecomendacao';
import { NotificadorEmail, type Email } from '../src/observadores/NotificadorEmail';
import { NotificadorInterno } from '../src/observadores/NotificadorInterno';

const evento = (tipo: TipoEvento) =>
  new EventoRecomendacao(
    tipo,
    {
      projetoId: 'proj-1',
      projetoNome: 'Vozes do Sertão',
      produtor: 'produtora@exemplo.com',
      envolvidos: [
        { profissionalId: 'p01', nome: 'Ana Ribeiro', papel: Papel.DIRETOR },
        { profissionalId: 'p07', nome: 'Gabriela Souza', papel: Papel.SONOPLASTA },
      ],
    },
    'teste',
  );

describe('Observer', () => {
  it('cada observador reage ao mesmo evento do seu jeito', () => {
    const emails: Email[] = [];
    const linhas: string[] = [];
    const barramento = new BarramentoEmMemoria();
    const email = new NotificadorEmail((e) => emails.push(e));
    const interno = new NotificadorInterno();
    const auditoria = new AuditoriaRecomendacao((l) => linhas.push(l));
    for (const o of [email, interno, auditoria]) barramento.inscrever((e) => o.atualizar(e));

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

  it('respostas a convites e equipe formada são avisadas ao produtor', () => {
    const emails: Email[] = [];
    const notificador = new NotificadorEmail((e) => emails.push(e));

    notificador.atualizar(evento('convite_aceito'));
    notificador.atualizar(evento('convite_recusado'));
    notificador.atualizar(evento('equipe_formada'));
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
