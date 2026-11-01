import { describe, expect, it } from 'vitest';
import { Equipe, MembroEquipe } from '../src/dominio/Equipe';
import { Papel } from '../src/dominio/Papel';
import type { Profissional } from '../src/dominio/Profissional';
import type { Projeto } from '../src/dominio/Projeto';
import { ProjetoAnimacao } from '../src/dominio/ProjetoAnimacao';
import { ProjetoDocumentario } from '../src/dominio/ProjetoDocumentario';
import { ProjetoFiccao } from '../src/dominio/ProjetoFiccao';
import { ProjetoPublicitario } from '../src/dominio/ProjetoPublicitario';
import type { RecomendacaoStrategy } from '../src/estrategias/RecomendacaoStrategy';
import { SimilaridadeCosseno } from '../src/estrategias/SimilaridadeCosseno';
import { FabricaAnimacao } from '../src/fabricas/animacao/FabricaAnimacao';
import { NotificadorAnimacao } from '../src/fabricas/animacao/NotificadorAnimacao';
import { RecomendadorAnimacao } from '../src/fabricas/animacao/RecomendadorAnimacao';
import { RelatorioAnimacao } from '../src/fabricas/animacao/RelatorioAnimacao';
import { ValidadorAnimacao } from '../src/fabricas/animacao/ValidadorAnimacao';
import { DetalheInvalidoError } from '../src/fabricas/detalhes';
import { FabricaDocumentario } from '../src/fabricas/documentario/FabricaDocumentario';
import { NotificadorDocumentario } from '../src/fabricas/documentario/NotificadorDocumentario';
import { RecomendadorDocumentario } from '../src/fabricas/documentario/RecomendadorDocumentario';
import { ValidadorDocumentario } from '../src/fabricas/documentario/ValidadorDocumentario';
import type { FabricaProjeto } from '../src/fabricas/FabricaProjeto';
import { FabricaFiccao } from '../src/fabricas/ficcao/FabricaFiccao';
import { FabricaPublicitario } from '../src/fabricas/publicitario/FabricaPublicitario';
import { NotificadorPublicitario } from '../src/fabricas/publicitario/NotificadorPublicitario';
import { RecomendadorPublicitario } from '../src/fabricas/publicitario/RecomendadorPublicitario';
import { ValidadorPublicitario } from '../src/fabricas/publicitario/ValidadorPublicitario';
import { RegistroFabricas, TipoDesconhecidoError } from '../src/fabricas/RegistroFabricas';
import { EventoRecomendacao } from '../src/observadores/EventoRecomendacao';
import { NotificadorConvite } from '../src/observadores/NotificadorConvite';
import type { Email } from '../src/observadores/NotificadorEmail';
import { GeradorRelatorio } from '../src/visitantes/GeradorRelatorio';
import { ValidadorConsistencia } from '../src/visitantes/ValidadorConsistencia';
import { criarProjeto, PRAZO, profissional, servico, servicos } from './fixtures';

const base = { nome: 'Projeto', produtor: 'produtora@exemplo.com' };

describe('Abstract Factory: cada fábrica cria uma família coerente', () => {
  const familias: [FabricaProjeto, Function[]][] = [
    [new FabricaDocumentario(), [ProjetoDocumentario, ValidadorDocumentario, RecomendadorDocumentario, NotificadorDocumentario, GeradorRelatorio]],
    [new FabricaAnimacao(), [ProjetoAnimacao, ValidadorAnimacao, RecomendadorAnimacao, NotificadorAnimacao, RelatorioAnimacao]],
    [new FabricaPublicitario(), [ProjetoPublicitario, ValidadorPublicitario, RecomendadorPublicitario, NotificadorPublicitario, GeradorRelatorio]],
    [new FabricaFiccao(), [ProjetoFiccao, ValidadorConsistencia, SimilaridadeCosseno, NotificadorConvite, GeradorRelatorio]],
  ];

  it.each(familias)('%s', (fabrica, [projeto, validador, recomendador, notificador, relatorio]) => {
    const criado = fabrica.criarProjeto(base);
    expect(criado).toBeInstanceOf(projeto);
    expect(criado.tipo).toBe(fabrica.tipo);
    expect(fabrica.criarValidador().constructor).toBe(validador);
    expect(fabrica.criarRecomendador().constructor).toBe(recomendador);
    expect(fabrica.criarNotificador().constructor).toBe(notificador);
    expect(fabrica.criarRelatorio().constructor).toBe(relatorio);
  });

  it('o registro encontra a fábrica pelo tipo e recusa tipos desconhecidos', () => {
    const registro = new RegistroFabricas().registrar(new FabricaDocumentario()).registrar(new FabricaAnimacao());
    expect(registro.tipos()).toEqual(['documentario', 'animacao']);
    expect(registro.para('animacao')).toBeInstanceOf(FabricaAnimacao);
    expect(() => registro.para('realidade-virtual')).toThrow(TipoDesconhecidoError);
  });
});

describe('Factory Method criarProjeto: clona o modelo e aplica os atributos do tipo', () => {
  it('documentário: modelo escolhido, ajustes comuns e detalhes', () => {
    const fabrica = new FabricaDocumentario();
    const projeto = fabrica.criarProjeto({
      ...base,
      modelo: 'entrevistas',
      restricoes: { orcamento: 45_000 },
      detalhes: { tema: 'Memória operária', entrevistados: ['Dona Lúcia', 'Seu Zé'] },
    }) as ProjetoDocumentario;

    expect(fabrica.modelos()).toEqual(['padrao', 'entrevistas']);
    expect(projeto.papeis.map((r) => r.papel)).toEqual([Papel.DIRETOR, Papel.SONOPLASTA, Papel.EDITOR]);
    expect(projeto.orcamento).toBe(45_000);
    expect(projeto.tema).toBe('Memória operária');
    expect(projeto.entrevistados).toEqual(['Dona Lúcia', 'Seu Zé']);
  });

  it('animação e publicidade lêem seus próprios detalhes; o resto vem do modelo', () => {
    const animacao = new FabricaAnimacao().criarProjeto({ ...base, detalhes: { quadrosPorSegundo: 30 } }) as ProjetoAnimacao;
    expect([animacao.tecnica, animacao.quadrosPorSegundo]).toEqual(['3d', 30]);

    const peca = new FabricaPublicitario().criarProjeto({ ...base, detalhes: { cliente: 'Café Aurora' } }) as ProjetoPublicitario;
    expect([peca.cliente, peca.veiculacao]).toEqual(['Café Aurora', 'tv']);
  });

  it('projetos criados pela mesma fábrica são independentes entre si e do modelo', () => {
    const fabrica = new FabricaAnimacao();
    const a = fabrica.criarProjeto(base);
    const b = fabrica.criarProjeto(base);
    a.restricoes.orcamento = 1;

    expect(a.id).not.toBe(b.id);
    expect(b.orcamento).toBe(90_000);
    expect(fabrica.criarProjeto(base).orcamento).toBe(90_000);
  });

  it('detalhe com tipo errado é recusado', () => {
    expect(() => new FabricaAnimacao().criarProjeto({ ...base, detalhes: { quadrosPorSegundo: '24' } })).toThrow(DetalheInvalidoError);
    expect(() => new FabricaDocumentario().criarProjeto({ ...base, detalhes: { entrevistados: 'todos' } })).toThrow(DetalheInvalidoError);
    expect(() => new FabricaPublicitario().criarProjeto({ ...base, detalhes: { cliente: 42 } })).toThrow(DetalheInvalidoError);
  });
});

describe('Validadores das famílias', () => {
  const errosDe = (fabrica: FabricaProjeto, projeto: Projeto) => {
    const validador = fabrica.criarValidador();
    projeto.aceitar(validador);
    return validador.erros;
  };

  it('documentário exige tema e entrevistados', () => {
    expect(errosDe(new FabricaDocumentario(), new FabricaDocumentario().criarProjeto(base))).toEqual([
      'Documentário sem tema definido',
      'Documentário sem entrevistados previstos',
    ]);
  });

  it('animação exige efeitos visuais e quadros por segundo numa faixa válida', () => {
    const fabrica = new FabricaAnimacao();
    const projeto = (criarProjeto({}, 'animacao') as ProjetoAnimacao).clonar({ quadrosPorSegundo: 120 });
    expect(errosDe(fabrica, projeto)).toEqual([
      'Animação exige especialista em efeitos visuais',
      'Quadros por segundo fora da faixa 12 a 60',
    ]);
  });

  it('em animação 3D, o especialista de efeitos visuais precisa dominar software de modelagem', () => {
    const fabrica = new FabricaAnimacao();
    const projeto = fabrica.criarProjeto(base);
    const membros = (vfx: string) =>
      projeto.papeis.map((r) => new MembroEquipe(r.papel, profissional(r.papel === Papel.EFEITOS_VISUAIS ? vfx : 'p03')));

    projeto.definirEquipe(new Equipe(membros('p16')));
    expect(errosDe(fabrica, projeto)).toContain('Paulo Henrique não domina software de modelagem 3D');

    projeto.definirEquipe(new Equipe(membros('p14')));
    expect(errosDe(fabrica, projeto)).not.toContain('Nicolas Ferreira não domina software de modelagem 3D');
  });

  it('publicidade exige cliente, veiculação e no máximo 3 minutos', () => {
    const projeto = new FabricaPublicitario().criarProjeto({ ...base, duracao: 5, detalhes: { veiculacao: ' ' } });
    expect(errosDe(new FabricaPublicitario(), projeto)).toEqual([
      'Peça publicitária sem cliente',
      'Peça publicitária sem meio de veiculação',
      'Peça publicitária acima de 3 minutos',
    ]);
  });
});

describe('Recomendadores das famílias', () => {
  const primeiro = (estrategia: RecomendacaoStrategy, projeto: Projeto, candidatos: Profissional[], papel: Papel) =>
    estrategia.recomendar(projeto, candidatos).get(papel)?.[0]?.id;
  const comPapel = (orcamento: number, ...competencias: [string, number][]) => (papel: Papel) =>
    criarProjeto({ servicoPrincipal: servicos(servico(papel, 1, ...competencias)), restricoes: { orcamento, prazo: PRAZO, localizacao: 'SP' } });

  it('documentário valoriza experiência em documentário', () => {
    const projeto = comPapel(100_000, ['narrativa', 8])(Papel.DIRETOR);
    const diretores = ['p01', 'p02', 'p03'].map(profissional);
    expect(primeiro(new SimilaridadeCosseno(), projeto, diretores, Papel.DIRETOR)).toBe('p01');
    expect(primeiro(new RecomendadorDocumentario(), projeto, diretores, Papel.DIRETOR)).toBe('p02');
  });

  it('animação prioriza software de modelagem 3D', () => {
    const projeto = comPapel(100_000, ['composicao', 8])(Papel.EFEITOS_VISUAIS);
    const vfx = ['p11', 'p14', 'p15', 'p16'].map(profissional);
    const ranking = (e: RecomendacaoStrategy) => e.recomendar(projeto, vfx).get(Papel.EFEITOS_VISUAIS)?.map((p) => p.id) ?? [];

    expect(ranking(new SimilaridadeCosseno()).indexOf('p14')).toBeGreaterThan(ranking(new SimilaridadeCosseno()).indexOf('p11'));
    expect(ranking(new RecomendadorAnimacao()).indexOf('p14')).toBeLessThan(ranking(new RecomendadorAnimacao()).indexOf('p11'));
  });

  it('publicidade pesa a reputação tanto quanto a aderência', () => {
    // Fábio (p06) tem o perfil técnico exato, mas nenhuma avaliação; Diego (p04) é muito bem avaliado.
    const projeto = comPapel(100_000, ['iluminacao', 8], ['camera', 8])(Papel.DIRETOR_FOTOGRAFIA);
    const fotografos = ['p04', 'p05', 'p06'].map(profissional);
    expect(primeiro(new SimilaridadeCosseno(), projeto, fotografos, Papel.DIRETOR_FOTOGRAFIA)).toBe('p06');
    expect(primeiro(new RecomendadorPublicitario(), projeto, fotografos, Papel.DIRETOR_FOTOGRAFIA)).toBe('p04');
  });

  it('os recomendadores das famílias respeitam a fatia do orçamento de cada papel', () => {
    const projeto = comPapel(10_000, ['camera', 8])(Papel.DIRETOR_FOTOGRAFIA);
    const ranking = new RecomendadorPublicitario().recomendar(projeto, ['p04', 'p05', 'p06'].map(profissional));
    expect(ranking.get(Papel.DIRETOR_FOTOGRAFIA)?.map((p) => p.id).sort()).toEqual(['p05', 'p06']);
  });
});

describe('Notificadores e relatório das famílias', () => {
  const convite = (fabrica: FabricaProjeto, projeto: Projeto) => {
    const emails: Email[] = [];
    const notificador = new (fabrica.criarNotificador().constructor as new (enviar: (e: Email) => void) => NotificadorConvite)(
      (e) => emails.push(e),
    );
    const envolvidos = [{ profissionalId: 'p01', nome: 'Ana Ribeiro', papel: Papel.DIRETOR }];
    notificador.atualizar(new EventoRecomendacao('recomendacao_gerada', projeto, envolvidos, 'teste'));
    return emails[0]?.corpo ?? '';
  };

  it('cada família acrescenta ao convite o que importa no seu tipo', () => {
    expect(convite(new FabricaDocumentario(), criarProjeto({}, 'documentario'))).toContain(
      'Documentário sobre "Migração no sertão", com 1 entrevistado(s)',
    );
    expect(convite(new FabricaAnimacao(), criarProjeto({}, 'animacao'))).toContain('Animação 3d a 24 fps (129600 quadros)');
    expect(convite(new FabricaPublicitario(), criarProjeto({}, 'publicitario'))).toContain(
      'Campanha para Café Aurora, veiculação em tv, entrega em 2027-03-30',
    );
    expect(convite(new FabricaFiccao(), criarProjeto({}, 'ficcao'))).toBe(
      'Um produtor tem interesse em você como DIRETOR no projeto Vozes do Sertão.',
    );
  });

  it('o relatório de animação traz métricas de renderização', () => {
    const fabrica = new FabricaAnimacao();
    const projeto = fabrica.criarProjeto(base);
    expect(projeto.aceitar(fabrica.criarRelatorio())).not.toContain('Custo da equipe por quadro');

    projeto.definirEquipe(new Equipe([new MembroEquipe(Papel.EFEITOS_VISUAIS, profissional('p14'))]));
    const relatorio = projeto.aceitar(fabrica.criarRelatorio());
    expect(relatorio).toContain('Técnica: 3d, 24 fps, 17280 quadros');
    expect(relatorio).toMatch(/Ritmo necessário: \d+ quadros por dia/);
    expect(relatorio).toContain('Custo da equipe por quadro');

    const documentario = new FabricaDocumentario();
    expect(documentario.criarProjeto(base).aceitar(documentario.criarRelatorio())).not.toContain('quadros');
  });
});
