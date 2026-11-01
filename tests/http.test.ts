import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { construirApp } from '../src/http/app';
import { sistemaDeTeste } from './fixtures';

const { sistema, linhasAuditoria } = sistemaDeTeste();
const app = construirApp({ sistema });
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
  servico: {
    nome: 'Curta de Animação',
    servicos: [
      {
        nome: 'Pré-produção',
        servicos: [
          {
            nome: 'Direção e storyboard',
            papel: 'DIRETOR',
            custo: 18_000,
            prazo: '2026-12-15',
            competencias: [{ nome: 'animacao', nivel: 9 }, { nome: 'storyboard', nivel: 8 }],
          },
        ],
      },
      {
        nome: 'Produção',
        servicos: [
          {
            nome: 'Modelagem 3D',
            papel: 'EFEITOS_VISUAIS',
            custo: 24_000,
            prazo: '2027-02-15',
            competencias: [{ nome: 'modelagem 3d', nivel: 9 }, { nome: 'blender', nivel: 8 }],
          },
        ],
      },
      { nome: 'Pós-produção', servicos: [{ nome: 'Montagem', papel: 'EDITOR', custo: 6_000, prazo: '2027-03-20' }] },
    ],
  },
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
    expect(dados.custoEstimado).toBe(48_000);
    expect(dados.servicos).toMatchObject({
      nome: 'Curta de Animação',
      custo: 48_000,
      prazo: '2027-03-20',
      servicos: [
        { nome: 'Pré-produção', servicos: [{ nome: 'Direção e storyboard', papel: 'DIRETOR', responsavel: 'Carla Mendes' }] },
        { nome: 'Produção', custo: 24_000 },
        { nome: 'Pós-produção', prazo: '2027-03-20' },
      ],
    });
    expect(linhasAuditoria.length).toBeGreaterThan(0);
  });

  it('GET /recomendacoes/:id lê o resultado guardado no armazenamento', async () => {
    const { projetoId, equipe } = (await post(corpo)).json();
    const consulta = await app.inject({ method: 'GET', url: `/recomendacoes/${projetoId}` });

    expect(consulta.statusCode).toBe(200);
    expect(consulta.json()).toMatchObject({ projetoId, tipo: 'animacao', custoEstimado: 48_000 });
    expect(consulta.json().equipe.map((m: { profissionalId: string }) => m.profissionalId)).toEqual(
      equipe.membros.map((m: { profissional: { id: string } }) => m.profissional.id),
    );
    expect((await app.inject({ method: 'GET', url: `/recomendacoes/${crypto.randomUUID()}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/recomendacoes/..%2F..%2Fsegredo' })).statusCode).toBe(400);
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
      'DIRETOR_FOTOGRAFIA',
      'EDITOR',
    ]);
  });

  it('422 com os motivos quando o projeto não atende às regras da família', async () => {
    const resposta = await post({ tipo: 'publicitario', nome: 'Sem cliente', produtor: 'agencia@exemplo.com' });
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json().motivos).toEqual(['Peça publicitária sem cliente']);

    const semVfx = await post({ ...corpo, servico: { nome: 'Direção', papel: 'DIRETOR', custo: 1_000, prazo: '2027-03-01' } });
    expect(semVfx.statusCode).toBe(422);
    expect(semVfx.json().erro).toContain('não atende');
  });

  it('422 apontando o caminho até o serviço com problema', async () => {
    const atrasado = { nome: 'Mixagem', papel: 'SONOPLASTA', custo: 5_000, prazo: '2027-05-01' };
    const servico = { ...corpo.servico, servicos: [...corpo.servico.servicos, { nome: 'Som', servicos: [atrasado] }] };
    const resposta = await post({ ...corpo, servico });

    expect(resposta.statusCode).toBe(422);
    expect(resposta.json().motivos).toEqual(['O serviço Mixagem termina depois da entrega']);

    const caro = await post({ ...corpo, orcamento: 40_000 });
    expect(caro.json().motivos).toEqual(['Custo estimado dos serviços (48000) excede o orçamento (40000)']);
  });

  it('422 para modelo inexistente ou detalhe com tipo errado; 400 para corpo inválido', async () => {
    expect((await post({ tipo: 'documentario', modelo: 'nao-existe', nome: 'x', produtor: 'y' })).statusCode).toBe(422);
    expect((await post({ ...corpo, detalhes: { quadrosPorSegundo: 'muitos' } })).statusCode).toBe(422);
    expect((await post({ nome: 'x' })).statusCode).toBe(400);
    expect((await post({ ...corpo, tipo: 'realidade-virtual' })).statusCode).toBe(400);
    expect((await post({ ...corpo, servico: { nome: 'Vazio', servicos: [] } })).statusCode).toBe(400);
    expect((await post({ ...corpo, servico: { nome: 'x', papel: 'PRODUTOR', custo: 1, prazo: '2027-01-01' } })).statusCode).toBe(400);
  });

  it('as requisições de exemplo da coleção do Postman respondem como o nome diz', async () => {
    const colecao = JSON.parse(readFileSync('exemplos/cinebridge.postman_collection.json', 'utf8')) as {
      item: { name: string; request: { method: string; body?: { raw: string } } }[];
    };
    const posts = colecao.item.filter((i) => i.request.method === 'POST');
    expect(posts.length).toBeGreaterThanOrEqual(6);
    for (const { name, request } of posts) {
      const resposta = await post(JSON.parse(request.body?.raw ?? '{}'));
      expect(resposta.statusCode, name).toBe(name.startsWith('Erro 422') ? 422 : 200);
    }
  });
});
