import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import { Competencia } from '../dominio/Competencia';
import type { Equipe } from '../dominio/Equipe';
import { Papel } from '../dominio/Papel';
import { Projeto, type TipoCaptacao } from '../dominio/Projeto';
import { FiltragemColaborativa } from '../estrategias/FiltragemColaborativa';
import type { RecomendacaoStrategy } from '../estrategias/RecomendacaoStrategy';
import { RegrasOrcamento } from '../estrategias/RegrasOrcamento';
import { SimilaridadeCosseno } from '../estrategias/SimilaridadeCosseno';
import { ProjetoInvalidoError } from '../orquestracao/OrquestradorEquipe';
import type { RepositorioProfissionais } from '../repositorio/RepositorioProfissionais';
import type { SistemaRecomendacao } from '../SistemaRecomendacao';
import { CalculadorCompatibilidade } from '../visitantes/CalculadorCompatibilidade';
import { GeradorRelatorio } from '../visitantes/GeradorRelatorio';
import { ValidadorConsistencia } from '../visitantes/ValidadorConsistencia';

const ESTRATEGIAS = {
  cosseno: () => new SimilaridadeCosseno(),
  colaborativa: () => new FiltragemColaborativa(),
  orcamento: () => new RegrasOrcamento(),
} satisfies Record<string, () => RecomendacaoStrategy>;

type NomeEstrategia = keyof typeof ESTRATEGIAS;

interface CorpoRecomendacao {
  nome: string;
  produtor: string;
  genero: string;
  duracao: number;
  tipoCaptacao: TipoCaptacao;
  orcamento: number;
  prazo: string;
  localizacao: string;
  papeis: { papel: Papel; peso: number; competencias?: { nome: string; nivel: number }[] }[];
  estrategia?: NomeEstrategia;
}

const esquemaCorpo = {
  type: 'object',
  additionalProperties: false,
  required: ['nome', 'produtor', 'genero', 'duracao', 'tipoCaptacao', 'orcamento', 'prazo', 'localizacao', 'papeis'],
  properties: {
    nome: { type: 'string', minLength: 1 },
    produtor: { type: 'string', minLength: 1 },
    genero: { type: 'string', minLength: 1 },
    duracao: { type: 'number', exclusiveMinimum: 0 },
    tipoCaptacao: { enum: ['documentario', 'ficcao', 'animacao'] },
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
    estrategia: { enum: Object.keys(ESTRATEGIAS) },
  },
} as const;

export interface DependenciasHttp {
  sistema: SistemaRecomendacao;
  repositorio: RepositorioProfissionais;
}

export function construirApp({ sistema, repositorio }: DependenciasHttp, opcoes: FastifyServerOptions = {}) {
  const app = Fastify(opcoes);

  app.setErrorHandler<FastifyError>((erro, _requisicao, resposta) => {
    if (erro instanceof ProjetoInvalidoError) return resposta.status(422).send({ erro: erro.message });
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

  app.post<{ Body: CorpoRecomendacao }>('/recomendacoes', { schema: { body: esquemaCorpo } }, async (requisicao) => {
    const corpo = requisicao.body;
    const projeto = new Projeto({
      nome: corpo.nome,
      produtor: corpo.produtor,
      genero: corpo.genero,
      duracao: corpo.duracao,
      tipoCaptacao: corpo.tipoCaptacao,
      papeis: corpo.papeis.map((r) => ({
        papel: r.papel,
        peso: r.peso,
        competenciasDesejadas: (r.competencias ?? []).map((comp) => new Competencia(comp.nome, comp.nivel)),
      })),
      restricoes: { orcamento: corpo.orcamento, prazo: new Date(corpo.prazo), localizacao: corpo.localizacao },
      ...(corpo.estrategia && { estrategia: ESTRATEGIAS[corpo.estrategia]() }),
    });

    const equipe = await sistema.executarRecomendacao(projeto);
    const validador = new ValidadorConsistencia();
    return {
      projetoId: projeto.id,
      estrategia: sistema.estrategiaPara(projeto).nome,
      equipe: serializarEquipe(equipe),
      compatibilidade: Number(projeto.aceitar(new CalculadorCompatibilidade()).toFixed(3)),
      consistente: projeto.aceitar(validador),
      erros: validador.erros,
      relatorio: projeto.aceitar(new GeradorRelatorio()),
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
