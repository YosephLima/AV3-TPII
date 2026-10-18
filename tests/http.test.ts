import { afterAll, describe, expect, it } from 'vitest';
import { construirApp } from '../src/http/app';
import { sistemaDeTeste } from './fixtures';

const { sistema, repositorio, linhasAuditoria } = sistemaDeTeste();
const app = construirApp({ sistema, repositorio });
afterAll(() => app.close());

const corpo = {
  tipo: 'animacao',
  nome: 'Curta de Animação',
  produtor: 'estudio@exemplo.com',
  genero: 'fantasia',
  duracao: 15,
  orcamento: 80_000,
  prazo: '2027-03-30',
  localizacao: 'São Paulo',
  papeis: [
    { papel: 'DIRETOR', peso: 3, competencias: [{ nome: 'animacao', nivel: 9 }, { nome: 'storyboard', nivel: 8 }] },
    { papel: 'EFEITOS_VISUAIS', peso: 4, competencias: [{ nome: 'modelagem 3d', nivel: 9 }, { nome: 'blender', nivel: 8 }] },
    { papel: 'EDITOR', peso: 1 },
  ],
  detalhes: { tecnica: '3d', quadrosPorSegundo: 24 },
};

const post = (payload: object) => app.inject({ method: 'POST', url: '/recomendacoes', payload });

describe('API HTTP', () => {
  it('GET /saude e GET /profissionais', async () => {
    expect((await app.inject({ method: 'GET', url: '/saude' })).json()).toEqual({ status: 'ok' });
    const profissionais = (await app.inject({ method: 'GET', url: '/profissionais' })).json<unknown[]>();
    expect(profissionais).toHaveLength(16);
  });

  it('GET /modelos lista os tipos e os modelos de cada um', async () => {
    const modelos = (await app.inject({ method: 'GET', url: '/modelos' })).json();
    expect(modelos).toEqual([
      { tipo: 'documentario', modelos: ['padrao', 'entrevistas'] },
      { tipo: 'animacao', modelos: ['padrao', 'curta-2d'] },
      { tipo: 'publicitario', modelos: ['padrao', 'digital'] },
      { tipo: 'ficcao', modelos: ['padrao'] },
    ]);
  });

  it('POST /recomendacoes usa a família do tipo: recomendador, validador e relatório', async () => {
    const resposta = await post(corpo);
    const dados = resposta.json();

    expect(resposta.statusCode).toBe(200);
    expect(dados.tipo).toBe('animacao');
    expect(dados.estrategia).toBe('animacao');
    expect(dados.equipe.membros.map((m: { profissional: { id: string } }) => m.profissional.id)).toEqual([
      'p03',
      'p14',
      'p09',
    ]);
    expect(dados.consistente).toBe(true);
    expect(dados.relatorio).toContain('21600 quadros');
    expect(linhasAuditoria.length).toBeGreaterThan(0);
  });

  it('respeita a estratégia escolhida pelo produtor', async () => {
    expect((await post({ ...corpo, estrategia: 'orcamento' })).json().estrategia).toBe('orcamento');
  });

  it('cria o projeto a partir de um modelo, só com tipo, nome, produtor e os detalhes do tipo', async () => {
    const resposta = await post({
      tipo: 'publicitario',
      modelo: 'digital',
      nome: 'Lançamento',
      produtor: 'agencia@exemplo.com',
      detalhes: { cliente: 'Café Aurora' },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().equipe.membros.map((m: { papel: string }) => m.papel)).toEqual([
      'DIRETOR',
      'EDITOR',
      'DIRETOR_FOTOGRAFIA',
    ]);
  });

  it('422 com os motivos quando o projeto não atende às regras da família', async () => {
    const resposta = await post({ tipo: 'publicitario', nome: 'Sem cliente', produtor: 'agencia@exemplo.com' });
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json().motivos).toEqual(['Peça publicitária sem cliente']);

    const semVfx = await post({ ...corpo, papeis: [{ papel: 'DIRETOR', peso: 1 }] });
    expect(semVfx.statusCode).toBe(422);
    expect(semVfx.json().erro).toContain('não atende');
  });

  it('422 para modelo inexistente ou detalhe com tipo errado; 400 para corpo inválido', async () => {
    expect((await post({ tipo: 'documentario', modelo: 'nao-existe', nome: 'x', produtor: 'y' })).statusCode).toBe(422);
    expect((await post({ ...corpo, detalhes: { quadrosPorSegundo: 'muitos' } })).statusCode).toBe(422);
    expect((await post({ nome: 'x' })).statusCode).toBe(400);
    expect((await post({ ...corpo, tipo: 'realidade-virtual' })).statusCode).toBe(400);
  });
});
