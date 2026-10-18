import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
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
import type { RepositorioProfissionais } from '../repositorio/RepositorioProfissionais';
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
  papeis?: { papel: Papel; peso: number; competencias?: { nome: string; nivel: number }[] }[];
  estrategia?: string;
  /** Tema, técnica, cliente... conforme o tipo. */
  detalhes?: Record<string, unknown>;
}

const ERROS_DE_NEGOCIO = [ProjetoInvalidoError, ModeloDesconhecidoError, DetalheInvalidoError, TipoDesconhecidoError];

/** Os tipos vêm das fábricas registradas, então um tipo novo não mexe na rota. */
function esquemaCorpo(tipos: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['tipo', 'nome', 'produtor'],
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
      papeis: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['papel', 'peso'],
          properties: {
            papel: { enum: Object.values(Papel) },
            peso: { type: 'number', exclusiveMinimum: 0 },
            competencias: {
              type: 'array',
              items: {
                type: 'object',
                required: ['nome', 'nivel'],
                properties: { nome: { type: 'string' }, nivel: { type: 'number', minimum: 0, maximum: 10 } },
              },
            },
          },
        },
      },
      estrategia: { enum: [...ESTRATEGIAS.keys()] },
      detalhes: { type: 'object' },
    },
  };
}

export interface DependenciasHttp {
  sistema: SistemaRecomendacao;
  repositorio: RepositorioProfissionais;
}

export function construirApp({ sistema, repositorio }: DependenciasHttp, opcoes: FastifyServerOptions = {}) {
  const app = Fastify(opcoes);
  const tipos = sistema.catalogo().map((c) => c.tipo);

  app.setErrorHandler<FastifyError>((erro, _requisicao, resposta) => {
    if (ERROS_DE_NEGOCIO.some((classe) => erro instanceof classe)) {
      const motivos = erro instanceof ProjetoInvalidoError ? erro.motivos : [];
      return resposta.status(422).send({ erro: erro.message, motivos });
    }
    const status = erro.statusCode ?? 500;
    return resposta.status(status).send({ erro: status === 500 ? 'Erro interno' : erro.message });
  });

  app.get('/saude', async () => ({ status: 'ok' }));

  app.get('/profissionais', async () =>
    (await repositorio.listar()).map((p) => ({
      id: p.id,
      nome: p.nome,
      especialidades: p.especialidades,
      precoMedio: p.precoMedio,
      notaMedia: Number(p.notaMedia().toFixed(2)),
      localizacao: p.localizacao,
    })),
  );

  app.get('/modelos', async () => sistema.catalogo());

  app.post<{ Body: CorpoRecomendacao }>('/recomendacoes', { schema: { body: esquemaCorpo(tipos) } }, async (requisicao) => {
    const corpo = requisicao.body;
    const { projeto, equipe } = await sistema.recomendar({
      tipo: corpo.tipo,
      modelo: corpo.modelo,
      detalhes: corpo.detalhes,
      nome: corpo.nome,
      produtor: corpo.produtor,
      genero: corpo.genero,
      duracao: corpo.duracao,
      papeis: corpo.papeis?.map((r) => ({
        papel: r.papel,
        peso: r.peso,
        competenciasDesejadas: (r.competencias ?? []).map((comp) => new Competencia(comp.nome, comp.nivel)),
      })),
      restricoes: {
        orcamento: corpo.orcamento,
        prazo: corpo.prazo === undefined ? undefined : new Date(corpo.prazo),
        localizacao: corpo.localizacao,
      },
      estrategia: corpo.estrategia === undefined ? undefined : ESTRATEGIAS.get(corpo.estrategia),
    });

    const avaliacao = sistema.avaliar(projeto);
    return {
      projetoId: projeto.id,
      tipo: projeto.tipo,
      estrategia: sistema.estrategiaPara(projeto).nome,
      equipe: serializarEquipe(equipe),
      compatibilidade: Number(avaliacao.compatibilidade.toFixed(3)),
      consistente: avaliacao.consistente,
      erros: avaliacao.erros,
      relatorio: avaliacao.relatorio,
    };
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
