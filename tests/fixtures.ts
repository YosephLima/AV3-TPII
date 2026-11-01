import { criarSistema } from '../src/composicao';
import { profissionaisIniciais } from '../src/dados/profissionais';
import { Competencia } from '../src/dominio/Competencia';
import { Papel } from '../src/dominio/Papel';
import type { Profissional } from '../src/dominio/Profissional';
import type { DadosProjeto, Projeto } from '../src/dominio/Projeto';
import { ProjetoAnimacao } from '../src/dominio/ProjetoAnimacao';
import { ProjetoDocumentario } from '../src/dominio/ProjetoDocumentario';
import { ProjetoFiccao } from '../src/dominio/ProjetoFiccao';
import { ProjetoPublicitario } from '../src/dominio/ProjetoPublicitario';
import type { Email } from '../src/observadores/NotificadorEmail';
import { PacoteServico } from '../src/servicos/PacoteServico';
import { ServicoAtomico } from '../src/servicos/ServicoAtomico';
import type { ServicoProjeto } from '../src/servicos/ServicoProjeto';

export const PRAZO = new Date('2027-03-30');

const DIA_EM_MS = 86_400_000;

/** Serviço com o nome do papel, pronto dez dias antes da entrega padrão. */
export const servico = (papel: Papel, custo: number, ...competencias: [string, number][]): ServicoAtomico =>
  new ServicoAtomico({
    nome: papel,
    custoBase: custo,
    prazoBase: new Date(PRAZO.getTime() - 10 * DIA_EM_MS),
    papelNecessario: papel,
    competenciasDesejadas: competencias.map(([nome, nivel]) => new Competencia(nome, nivel)),
  });

export const servicos = (...filhos: ServicoProjeto[]): PacoteServico => new PacoteServico('Projeto', filhos);

const construtores = {
  documentario: (dados) => new ProjetoDocumentario({ ...dados, tema: 'Migração no sertão', entrevistados: ['Dona Socorro'] }),
  animacao: (dados) => new ProjetoAnimacao({ ...dados, tecnica: '3d', quadrosPorSegundo: 24 }),
  publicitario: (dados) => new ProjetoPublicitario({ ...dados, cliente: 'Café Aurora', veiculacao: 'tv' }),
  ficcao: (dados) => new ProjetoFiccao(dados),
} satisfies Record<string, (dados: DadosProjeto) => Projeto>;

export type TipoDeTeste = keyof typeof construtores;

/** Documentário por padrão; qualquer campo pode ser sobrescrito. */
export function criarProjeto(dados: Partial<DadosProjeto> = {}, tipo: TipoDeTeste = 'documentario'): Projeto {
  return construtores[tipo]({
    nome: 'Vozes do Sertão',
    produtor: 'produtora@exemplo.com',
    genero: 'drama social',
    duracao: 90,
    servicoPrincipal: servicos(
      servico(Papel.DIRETOR, 5, ['documentario', 9], ['narrativa', 8]),
      servico(Papel.DIRETOR_FOTOGRAFIA, 3, ['camera', 8]),
      servico(Papel.SONOPLASTA, 2, ['captacao de som', 8]),
      servico(Papel.EDITOR, 3, ['montagem', 8]),
      servico(Papel.ROTEIRISTA, 4, ['pesquisa', 9]),
    ),
    restricoes: { orcamento: 120_000, prazo: PRAZO, localizacao: 'Recife' },
    ...dados,
  });
}

export function profissional(id: string): Profissional {
  const encontrado = profissionaisIniciais().find((p) => p.id === id);
  if (!encontrado) throw new Error(`Profissional ${id} não existe no cadastro inicial`);
  return encontrado;
}

/** E-mails e auditoria ficam capturados em memória. */
export function sistemaDeTeste() {
  const emails: Email[] = [];
  const linhasAuditoria: string[] = [];
  const contexto = criarSistema({
    enviarEmail: (email) => emails.push(email),
    escreverAuditoria: (linha) => linhasAuditoria.push(linha),
  });
  return { ...contexto, emails, linhasAuditoria };
}
