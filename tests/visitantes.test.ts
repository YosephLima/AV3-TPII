import { describe, expect, it } from 'vitest';
import { Equipe, MembroEquipe } from '../src/dominio/Equipe';
import { Papel } from '../src/dominio/Papel';
import { Profissional } from '../src/dominio/Profissional';
import { CalculadorCompatibilidade } from '../src/visitantes/CalculadorCompatibilidade';
import { GeradorRelatorio } from '../src/visitantes/GeradorRelatorio';
import { ValidadorConsistencia } from '../src/visitantes/ValidadorConsistencia';
import { criarProjeto, PRAZO, profissional, servico, servicos } from './fixtures';

/** Projeto pequeno com equipe montada à mão: diretor e editor. */
function projetoComEquipe(diretor = 'p02', editor = 'p09') {
  const projeto = criarProjeto({
    servicoPrincipal: servicos(servico(Papel.DIRETOR, 2, ['documentario', 9]), servico(Papel.EDITOR, 1, ['montagem', 9])),
    restricoes: { orcamento: 30_000, prazo: PRAZO, localizacao: 'Recife' },
  });
  projeto.definirEquipe(
    new Equipe([
      new MembroEquipe(Papel.DIRETOR, profissional(diretor)),
      new MembroEquipe(Papel.EDITOR, profissional(editor)),
    ]),
  );
  return projeto;
}

describe('Visitor', () => {
  it('três operações diferentes sobre a mesma estrutura de projeto', () => {
    const projeto = projetoComEquipe();

    expect(projeto.aceitar(new ValidadorConsistencia())).toBe(true);
    expect(projeto.aceitar(new CalculadorCompatibilidade())).toBeGreaterThan(0.5);
    expect(projeto.aceitar(new GeradorRelatorio())).toMatch(/DIRETOR \(serviços de R\$\s2,00\): Bruno Tavares/);
  });

  describe('ValidadorConsistencia', () => {
    it('aponta papel sem profissional e orçamento estourado', () => {
      const projeto = projetoComEquipe('p01', 'p09');
      projeto.equipe?.membros.pop();
      projeto.equipe?.substituir(Papel.SONOPLASTA, profissional('p07'));
      const comOrcamentoBaixo = criarProjeto({
        servicoPrincipal: projeto.servicoPrincipal.clonar(),
        restricoes: { orcamento: 10_000, prazo: PRAZO, localizacao: 'SP' },
      });
      if (projeto.equipe) comOrcamentoBaixo.definirEquipe(projeto.equipe);

      const validador = new ValidadorConsistencia();
      expect(comOrcamentoBaixo.aceitar(validador)).toBe(false);
      expect(validador.erros).toEqual([
        'Papel EDITOR sem profissional',
        'Custo da equipe (26000) excede o orçamento (10000)',
      ]);
    });

    it('sem equipe, valida só as restrições do projeto', () => {
      const validador = new ValidadorConsistencia();
      expect(criarProjeto().aceitar(validador)).toBe(true);

      const invalido = criarProjeto({
        duracao: 0,
        servicoPrincipal: servicos(servico(Papel.DIRETOR, 0)),
        restricoes: { orcamento: 0, prazo: PRAZO, localizacao: 'SP' },
      });
      expect(invalido.aceitar(validador)).toBe(false);
      expect(validador.erros).toEqual([
        'Orçamento deve ser positivo',
        'Duração deve ser positiva',
        'Projeto > DIRETOR: custo deve ser positivo',
      ]);
      expect(criarProjeto({ servicoPrincipal: servicos() }).aceitar(validador)).toBe(false);
      expect(validador.erros).toEqual(['Projeto: pacote vazio']);
    });

    it('aponta cadastro de profissional inconsistente', () => {
      const validador = new ValidadorConsistencia();

      const semPreco = new Profissional({
        id: 'x', nome: 'Sem Preço', especialidades: [Papel.EDITOR], competencias: [], precoMedio: 0,
        disponibilidade: { inicio: PRAZO, fim: PRAZO }, localizacao: 'SP',
      });
      expect(semPreco.aceitar(validador)).toBe(false);

      const projeto = projetoComEquipe();
      projeto.equipe?.substituir(Papel.EDITOR, semPreco);
      expect(projeto.aceitar(validador)).toBe(false);
      expect(validador.erros).toEqual(['Cadastro inconsistente: Sem Preço']);
    });
  });

  describe('CalculadorCompatibilidade', () => {
    it('equipe tecnicamente mais aderente tem compatibilidade maior', () => {
      const calculador = new CalculadorCompatibilidade();
      const boa = projetoComEquipe('p02', 'p09').aceitar(calculador);
      const fraca = projetoComEquipe('p03', 'p10').aceitar(calculador);
      expect(boa).toBeGreaterThan(fraca);
      expect(boa).toBeLessThanOrEqual(1);
    });

    it('sem equipe vale zero; para o profissional, é a reputação', () => {
      const calculador = new CalculadorCompatibilidade();
      expect(criarProjeto().aceitar(calculador)).toBe(0);
      expect(profissional('p09').aceitar(calculador)).toBe(1);
    });
  });

  describe('GeradorRelatorio', () => {
    it('resume projeto, equipe, custo e consistência', () => {
      const projeto = projetoComEquipe();
      projeto.aceitarRecomendacao(Papel.EDITOR, profissional('p09'));
      const relatorio = projeto.aceitar(new GeradorRelatorio());

      expect(relatorio).toContain('Projeto: Vozes do Sertão (documentario, drama social, 90 min)');
      expect(relatorio).toMatch(/EDITOR \(serviços de R\$\s1,00\): Isabela Rocha/);
      expect(relatorio).toContain('[confirmado]');
      expect(relatorio).toContain('Consistência: ok');
    });

    it('indica projeto ainda sem equipe e profissional sem avaliações', () => {
      expect(criarProjeto().aceitar(new GeradorRelatorio())).toContain('Equipe: ainda não recomendada');
      expect(profissional('p06').aceitar(new GeradorRelatorio())).toContain('sem avaliações');
    });
  });
});
