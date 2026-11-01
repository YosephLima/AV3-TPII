import compressao from '@fastify/compress';
import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import { ArquivoNaoEncontradoError } from '../adaptadores/armazenamento/AdaptadorArmazenamento';
import { descreverPilha } from '../decoradores/DecoradorRecomendacao';
import { DECORADORES, PilhaInvalidaError } from '../decoradores/PoliticaDecoradores';
import { Competencia } from '../dominio/Competencia';
import type { Equipe } from '../dominio/Equipe';
import { Papel } from '../dominio/Papel';
import { FiltragemColaborativa } from '../estrategias/FiltragemColaborativa';
import type { RecomendacaoStrategy } from '../estrategias/RecomendacaoStrategy';
import { RegrasOrcamento } from '../estrategias/RegrasOrcamento';
import { SimilaridadeCosseno } from '../estrategias/SimilaridadeCosseno';
import { DetalheInvalidoError } from '../fabricas/detalhes';
import { TipoDesconhecidoError } from '../fabricas/RegistroFabricas';
import { ProjetoInvalidoError } from '../orquestracao/OrquestradorEquipe';
import { ModeloDesconhecidoError } from '../prototipos/RegistroPrototipos';
import { PacoteServico } from '../servicos/PacoteServico';
import { ServicoAtomico } from '../servicos/ServicoAtomico';
import { ComposicaoInvalidaError, type ServicoProjeto } from '../servicos/ServicoProjeto';
import type { SistemaRecomendacao } from '../SistemaRecomendacao';

const ESTRATEGIAS = new Map<string, RecomendacaoStrategy>(
  [new SimilaridadeCosseno(), new FiltragemColaborativa(), new RegrasOrcamento()].map((e) => [e.nome, e]),
);

/** Só tipo, nome e produtor são obrigatórios; o resto vem do modelo. */
interface CorpoRecomendacao {
  tipo: string;
  modelo?: string;
  nome: string;
  produtor: string;
  genero?: string;
  duracao?: number;
  orcamento?: number;
  prazo?: string;
  localizacao?: string;
  /** Árvore de serviços; sem ela, vale a do modelo. */
  servico?: CorpoServico;
  estrategia?: string;
  /** Pilha de decoradores preferida pelo produtor, de fora para dentro. */
  decoradores?: string[];
  /** Tema, técnica, cliente... conforme o tipo. */
  detalhes?: Record<string, unknown>;
}

type CorpoServico =
  | { nome: string; servicos: CorpoServico[] }
  | { nome: string; papel: Papel; custo: number; prazo: string; competencias?: { nome: string; nivel: number }[] };

const ERROS_DE_NEGOCIO = [
  ProjetoInvalidoError,
  ModeloDesconhecidoError,
  DetalheInvalidoError,
  TipoDesconhecidoError,
  ComposicaoInvalidaError,
  PilhaInvalidaError,
];

/** Esquema recursivo: um pacote tem serviços, que podem ser atômicos ou outros pacotes. */
const ESQUEMA_SERVICO = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['nome', 'papel', 'custo', 'prazo'],
      properties: {
        nome: { type: 'string', minLength: 1 },
        papel: { enum: Object.values(Papel) },
        custo: { type: 'number', exclusiveMinimum: 0 },
        prazo: { type: 'string', format: 'date' },
        competencias: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['nome', 'nivel'],
            properties: { nome: { type: 'string' }, nivel: { type: 'number', minimum: 0, maximum: 10 } },
          },
        },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['nome', 'servicos'],
      properties: {
        nome: { type: 'string', minLength: 1 },
        servicos: { type: 'array', minItems: 1, items: { $ref: '#/definitions/servico' } },
      },
    },
  ],
};

/** Os tipos vêm das fábricas registradas, então um tipo novo não mexe na rota. */
function esquemaCorpo(tipos: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['tipo', 'nome', 'produtor'],
    definitions: { servico: ESQUEMA_SERVICO },
    properties: {
      tipo: { enum: tipos },
      modelo: { type: 'string', minLength: 1 },
      nome: { type: 'string', minLength: 1 },
      produtor: { type: 'string', minLength: 1 },
      genero: { type: 'string', minLength: 1 },
      duracao: { type: 'number', exclusiveMinimum: 0 },
      orcamento: { type: 'number', exclusiveMinimum: 0 },
      prazo: { type: 'string', format: 'date' },
      localizacao: { type: 'string' },
      servico: { $ref: '#/definitions/servico' },
      estrategia: { enum: [...ESTRATEGIAS.keys()] },
      decoradores: { type: 'array', uniqueItems: true, items: { enum: [...DECORADORES] } },
      detalhes: { type: 'object' },
    },
  };
}

export interface DependenciasHttp {
  sistema: SistemaRecomendacao;
}

/** Respostas abaixo disso vão sem compressão. */
const COMPRIMIR_A_PARTIR_DE = 1_024;

export function construirApp({ sistema }: DependenciasHttp, opcoes: FastifyServerOptions = {}) {
  const app = Fastify(opcoes);
  // Gzip ou brotli na resposta, se o cliente aceitar (Accept-Encoding).
  app.register(compressao, { threshold: COMPRIMIR_A_PARTIR_DE });
  const tipos = sistema.catalogo().map((c) => c.tipo);

  app.setErrorHandler<FastifyError>((erro, _requisicao, resposta) => {
    if (ERROS_DE_NEGOCIO.some((classe) => erro instanceof classe)) {
      const motivos = erro instanceof ProjetoInvalidoError ? erro.motivos : [];
      return resposta.status(422).send({ erro: erro.message, motivos });
    }
    if (erro instanceof ArquivoNaoEncontradoError) {
      return resposta.status(404).send({ erro: 'Recomendação não encontrada' });
    }
    const status = erro.statusCode ?? 500;
    return resposta.status(status).send({ erro: status === 500 ? 'Erro interno' : erro.message });
  });

  // As rotas ficam num plugin registrado depois da compressão, para que o gancho dela valha para todas.
  app.register(async (api) => {
    api.get('/saude', async () => ({ status: 'ok' }));

    api.get('/profissionais', async () =>
      (await sistema.adaptadores.profissional.listarProfissionais()).map((p) => ({
        id: p.id,
        nome: p.nome,
        especialidades: p.especialidades,
        precoMedio: p.precoMedio,
        notaMedia: Number(p.notaMedia().toFixed(2)),
        localizacao: p.localizacao,
      })),
    );

    api.get('/modelos', async () => sistema.catalogo());

    const esquema = { body: esquemaCorpo(tipos) };
    api.post<{ Body: CorpoRecomendacao }>('/recomendacoes', { schema: esquema }, async (requisicao) => {
      const corpo = requisicao.body;
      const { projeto, equipe } = await sistema.recomendar({
        tipo: corpo.tipo,
        modelo: corpo.modelo,
        detalhes: corpo.detalhes,
        nome: corpo.nome,
        produtor: corpo.produtor,
        genero: corpo.genero,
        duracao: corpo.duracao,
        servicoPrincipal: corpo.servico === undefined ? undefined : servicoDoCorpo(corpo.servico),
        restricoes: {
          orcamento: corpo.orcamento,
          prazo: corpo.prazo === undefined ? undefined : new Date(corpo.prazo),
          localizacao: corpo.localizacao,
        },
        estrategia: corpo.estrategia === undefined ? undefined : ESTRATEGIAS.get(corpo.estrategia),
        decoradores: corpo.decoradores,
      });

      const avaliacao = sistema.avaliar(projeto);
      return {
        projetoId: projeto.id,
        tipo: projeto.tipo,
        estrategia: sistema.estrategiaPara(projeto).nome,
        pilha: descreverPilha(sistema.estrategiaPara(projeto)),
        equipe: serializarEquipe(equipe),
        custoEstimado: projeto.calcularCustoTotal(),
        servicos: serializarServico(projeto.servicoPrincipal, equipe),
        compatibilidade: Number(avaliacao.compatibilidade.toFixed(3)),
        consistente: avaliacao.consistente,
        erros: avaliacao.erros,
        relatorio: avaliacao.relatorio,
      };
    });

    api.get<{ Params: { id: string } }>(
      '/recomendacoes/:id',
      { schema: { params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } } },
      async (requisicao) => sistema.consultarRecomendacao(requisicao.params.id),
    );
  });

  return app;
}

function serializarEquipe(equipe: Equipe) {
  return {
    id: equipe.id,
    status: equipe.status,
    custoTotal: equipe.custoTotal(),
    membros: equipe.membros.map((m) => ({
      papel: m.papel,
      profissional: { id: m.profissional.id, nome: m.profissional.nome, precoMedio: m.profissional.precoMedio },
      alternativas: (equipe.ranking.get(m.papel) ?? [])
        .filter((p) => p.id !== m.profissional.id)
        .map((p) => ({ id: p.id, nome: p.nome })),
    })),
  };
}

function servicoDoCorpo(corpo: CorpoServico): ServicoProjeto {
  if ('servicos' in corpo) return new PacoteServico(corpo.nome, corpo.servicos.map(servicoDoCorpo));
  return new ServicoAtomico({
    nome: corpo.nome,
    custoBase: corpo.custo,
    prazoBase: new Date(corpo.prazo),
    papelNecessario: corpo.papel,
    competenciasDesejadas: (corpo.competencias ?? []).map((c) => new Competencia(c.nome, c.nivel)),
  });
}

/** A árvore com custo e prazo de cada nó; nas folhas, quem foi escalado para o papel. */
function serializarServico(servico: ServicoProjeto, equipe: Equipe): unknown {
  const comum = {
    nome: servico.nome,
    custo: servico.calcularCusto(),
    prazo: servico.obterPrazo().toISOString().slice(0, 10),
  };
  if (servico instanceof ServicoAtomico) {
    const membro = equipe.membro(servico.papelNecessario);
    return { ...comum, papel: servico.papelNecessario, responsavel: membro?.profissional.nome ?? null };
  }
  return { ...comum, servicos: servico.listarSubservicos().map((s) => serializarServico(s, equipe)) };
}
