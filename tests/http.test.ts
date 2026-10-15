import { afterAll, describe, expect, it } from 'vitest';
import { construirApp } from '../src/http/app';
import { sistemaDeTeste } from './fixtures';

const { sistema, repositorio, linhasAuditoria } = sistemaDeTeste();
const app = construirApp({ sistema, repositorio });
afterAll(() => app.close());

const corpo = {
  nome: 'Curta de Animação',
  produtor: 'estudio@exemplo.com',
  genero: 'fantasia',
  duracao: 15,
  tipoCaptacao: 'animacao',
  orcamento: 80_000,
  prazo: '2027-03-30',
  localizacao: 'São Paulo',
  papeis: [
    { papel: 'DIRETOR', peso: 3, competencias: [{ nome: 'animacao', nivel: 9 }, { nome: 'storyboard', nivel: 8 }] },
    { papel: 'EFEITOS_VISUAIS', peso: 4, competencias: [{ nome: 'modelagem 3d', nivel: 9 }, { nome: 'blender', nivel: 8 }] },
    { papel: 'EDITOR', peso: 1 },
  ],
};

describe('API HTTP', () => {
  it('GET /saude e GET /profissionais', async () => {
    expect((await app.inject({ method: 'GET', url: '/saude' })).json()).toEqual({ status: 'ok' });
    const profissionais = (await app.inject({ method: 'GET', url: '/profissionais' })).json<unknown[]>();
    expect(profissionais).toHaveLength(16);
  });

  it('POST /recomendacoes devolve equipe, métricas e relatório, e gera auditoria', async () => {
    const resposta = await app.inject({ method: 'POST', url: '/recomendacoes', payload: corpo });
    const dados = resposta.json();

    expect(resposta.statusCode).toBe(200);
    expect(dados.estrategia).toBe('cosseno');
    expect(dados.equipe.membros.map((m: { profissional: { id: string } }) => m.profissional.id)).toEqual([
      'p03',
      'p14',
      'p09',
    ]);
    expect(dados.consistente).toBe(true);
    expect(dados.relatorio).toContain('Curta de Animação');
    expect(linhasAuditoria.length).toBeGreaterThan(0);
  });

  it('respeita a estratégia escolhida pelo produtor', async () => {
    const resposta = await app.inject({ method: 'POST', url: '/recomendacoes', payload: { ...corpo, estrategia: 'orcamento' } });
    expect(resposta.json().estrategia).toBe('orcamento');
  });

  it('400 para corpo inválido e 422 para projeto que não atende às restrições', async () => {
    const invalido = await app.inject({ method: 'POST', url: '/recomendacoes', payload: { nome: 'x' } });
    expect(invalido.statusCode).toBe(400);

    const semVfx = { ...corpo, papeis: [{ papel: 'DIRETOR', peso: 1 }] };
    const restrito = await app.inject({ method: 'POST', url: '/recomendacoes', payload: semVfx });
    expect(restrito.statusCode).toBe(422);
    expect(restrito.json().erro).toContain('não atende');
  });
});
