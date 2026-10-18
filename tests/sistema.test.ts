import { describe, expect, it } from 'vitest';
import { Papel } from '../src/dominio/Papel';
import { RegrasOrcamento } from '../src/estrategias/RegrasOrcamento';
import { SimilaridadeCosseno } from '../src/estrategias/SimilaridadeCosseno';
import { SemCandidatoError } from '../src/SistemaRecomendacao';
import { criarProjeto, PRAZO, requisito, sistemaDeTeste } from './fixtures';

const eventos = (linhas: string[]) => linhas.map((l) => (JSON.parse(l) as { evento: string }).evento);

describe('SistemaRecomendacao', () => {
  describe('escolha da estratégia', () => {
    const { sistema } = sistemaDeTeste();

    it('sem escolha explícita, vem da família do projeto', () => {
      expect(sistema.estrategiaPara(criarProjeto({}, 'documentario')).nome).toBe('documentario');
      expect(sistema.estrategiaPara(criarProjeto({}, 'animacao')).nome).toBe('animacao');
      expect(sistema.estrategiaPara(criarProjeto({}, 'publicitario')).nome).toBe('publicitario');
      expect(sistema.estrategiaPara(criarProjeto({}, 'ficcao')).nome).toBe('cosseno');
    });

    it('a escolhida na criação do projeto vence a padrão do sistema, que vence a da família', () => {
      const { sistema: outro } = sistemaDeTeste();
      outro.definirEstrategia(new SimilaridadeCosseno());
      expect(outro.estrategiaPara(criarProjeto()).nome).toBe('cosseno');
      expect(outro.estrategiaPara(criarProjeto({ estrategia: new RegrasOrcamento() })).nome).toBe('orcamento');
    });
  });

  it('recomenda a equipe completa e avisa todos os observadores', async () => {
    const { sistema, emails, notificadorInterno, linhasAuditoria } = sistemaDeTeste();
    const projeto = criarProjeto();

    const equipe = await sistema.executarRecomendacao(projeto);

    expect(projeto.equipe).toBe(equipe);
    expect(equipe.membros.map((m) => m.papel)).toEqual(projeto.papeis.map((r) => r.papel));
    expect(emails).toHaveLength(5);
    expect(notificadorInterno.mensagensDe(projeto.produtor)).toHaveLength(1);
    expect(eventos(linhasAuditoria)).toEqual(['recomendacao_gerada']);
  });

  it('substituir um membro refaz só aquele papel e mantém as demais escolhas', async () => {
    const { sistema } = sistemaDeTeste();
    const projeto = criarProjeto();
    const equipe = await sistema.executarRecomendacao(projeto);
    const antes = new Map(equipe.membros.map((m) => [m.papel, m.profissional.id]));

    const novo = await sistema.substituirMembro(projeto, Papel.DIRETOR_FOTOGRAFIA);

    expect(novo.profissional.id).not.toBe(antes.get(Papel.DIRETOR_FOTOGRAFIA));
    for (const m of equipe.membros) {
      if (m.papel !== Papel.DIRETOR_FOTOGRAFIA) expect(m.profissional.id).toBe(antes.get(m.papel));
    }
  });

  it('quem já foi substituído não volta, e sem candidatos a substituição falha', async () => {
    const { sistema } = sistemaDeTeste();
    // Diretores de fotografia disponíveis até o prazo: Diego (p04) e Elisa (p05).
    const projeto = criarProjeto({ papeis: [requisito(Papel.DIRETOR_FOTOGRAFIA, 1, ['camera', 8])] });
    await sistema.executarRecomendacao(projeto);

    const segundo = await sistema.substituirMembro(projeto, Papel.DIRETOR_FOTOGRAFIA);
    expect(['p04', 'p05']).toContain(segundo.profissional.id);
    await expect(sistema.substituirMembro(projeto, Papel.DIRETOR_FOTOGRAFIA)).rejects.toThrow(SemCandidatoError);
  });

  it('convite recusado dispara substituição; todos aceitos formam a equipe', async () => {
    const { sistema, linhasAuditoria, emails } = sistemaDeTeste();
    const projeto = criarProjeto({ papeis: [requisito(Papel.DIRETOR, 2), requisito(Papel.SONOPLASTA, 1)] });
    await sistema.executarRecomendacao(projeto);
    const recusou = projeto.equipe?.membro(Papel.SONOPLASTA)?.profissional.id;

    await sistema.responderConvite(projeto, Papel.SONOPLASTA, false);
    expect(projeto.equipe?.membro(Papel.SONOPLASTA)?.profissional.id).not.toBe(recusou);

    await sistema.responderConvite(projeto, Papel.DIRETOR, true);
    expect(projeto.equipe?.status).toBe('proposta');
    await sistema.responderConvite(projeto, Papel.SONOPLASTA, true);

    expect(projeto.equipe?.status).toBe('formada');
    expect(eventos(linhasAuditoria)).toEqual([
      'recomendacao_gerada',
      'convite_recusado',
      'membro_substituido',
      'convite_aceito',
      'convite_aceito',
      'equipe_formada',
    ]);
    expect(emails.at(-1)?.assunto).toContain('Equipe formada');
  });

  it('mudança grande de orçamento pede reavaliação completa, e a nova equipe cabe no orçamento', async () => {
    const { sistema, linhasAuditoria } = sistemaDeTeste();
    const projeto = criarProjeto();
    const anterior = await sistema.executarRecomendacao(projeto);

    projeto.restricoes.orcamento = 40_000;
    const nova = await sistema.reavaliar(projeto);

    expect(anterior.status).toBe('descartada');
    expect(nova).not.toBe(anterior);
    expect(nova.custoTotal()).toBeLessThanOrEqual(40_000);
    expect(eventos(linhasAuditoria)).toEqual(['recomendacao_gerada', 'reavaliacao_solicitada', 'recomendacao_gerada']);
  });

  it('operações sobre a equipe exigem uma recomendação anterior', async () => {
    const { sistema } = sistemaDeTeste();
    const projeto = criarProjeto();
    await expect(sistema.substituirMembro(projeto, Papel.DIRETOR)).rejects.toThrow('ainda não tem equipe');
    await sistema.executarRecomendacao(projeto);
    await expect(sistema.responderConvite(projeto, Papel.EFEITOS_VISUAIS, true)).rejects.toThrow('Não há convite');
  });
});
