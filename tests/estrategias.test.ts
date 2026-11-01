import { describe, expect, it } from 'vitest';
import { Papel } from '../src/dominio/Papel';
import { FiltragemColaborativa } from '../src/estrategias/FiltragemColaborativa';
import type { RecomendacaoStrategy } from '../src/estrategias/RecomendacaoStrategy';
import { RegrasOrcamento } from '../src/estrategias/RegrasOrcamento';
import { SimilaridadeCosseno } from '../src/estrategias/SimilaridadeCosseno';
import { criarProjeto, PRAZO, profissional, servico, servicos } from './fixtures';

// Ana: a mais bem avaliada e a mais cara. Bruno: o mais barato. Carla: especialista em animação.
const diretores = () => [profissional('p01'), profissional('p02'), profissional('p03')];

const projetoDeAnimacao = (orcamento: number) =>
  criarProjeto(
    {
      servicoPrincipal: servicos(servico(Papel.DIRETOR, 1, ['animacao', 8], ['storyboard', 7])),
      restricoes: { orcamento, prazo: PRAZO, localizacao: 'São Paulo' },
    },
    'animacao',
  );

const idsPara = (estrategia: RecomendacaoStrategy, orcamento = 16_000) =>
  (estrategia.recomendar(projetoDeAnimacao(orcamento), diretores()).get(Papel.DIRETOR) ?? []).map((p) => p.id);

describe('Strategy', () => {
  it('similaridade de cosseno prioriza quem tem as competências pedidas', () => {
    expect(idsPara(new SimilaridadeCosseno())[0]).toBe('p03');
  });

  it('filtragem colaborativa prioriza o histórico de avaliações', () => {
    expect(idsPara(new FiltragemColaborativa())).toEqual(['p01', 'p03', 'p02']);
  });

  it('regras de orçamento só aceitam quem cabe na fatia do papel, do mais barato ao mais caro', () => {
    expect(idsPara(new RegrasOrcamento())).toEqual(['p02', 'p03']);
    expect(idsPara(new RegrasOrcamento(), 10_000)).toEqual([]);
  });

  it('trocar a estratégia altera o resultado para o mesmo projeto e o mesmo cadastro', () => {
    const primeiros = [new SimilaridadeCosseno(), new FiltragemColaborativa(), new RegrasOrcamento()].map(
      (e) => idsPara(e)[0],
    );
    expect(primeiros).toEqual(['p03', 'p01', 'p02']);
  });

  it('a fatia do orçamento de cada papel é proporcional ao peso', () => {
    const projeto = criarProjeto({
      servicoPrincipal: servicos(servico(Papel.DIRETOR, 3), servico(Papel.EDITOR, 1)),
      restricoes: { orcamento: 40_000, prazo: PRAZO, localizacao: 'SP' },
    });
    expect(projeto.tetoPorPapel(Papel.DIRETOR)).toBe(30_000);
    expect(projeto.tetoPorPapel(Papel.EDITOR)).toBe(10_000);
    expect(projeto.tetoPorPapel(Papel.SONOPLASTA)).toBe(0);
  });

  it('só recomenda profissionais da especialidade do papel', () => {
    const recomendacoes = new SimilaridadeCosseno().recomendar(criarProjeto(), [profissional('p07'), profissional('p09')]);
    expect(recomendacoes.get(Papel.SONOPLASTA)?.map((p) => p.id)).toEqual(['p07']);
    expect(recomendacoes.get(Papel.DIRETOR)).toEqual([]);
  });
});
