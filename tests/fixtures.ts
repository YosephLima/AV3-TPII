import { criarSistema } from '../src/composicao';
import { profissionaisIniciais } from '../src/dados/profissionais';
import { Competencia } from '../src/dominio/Competencia';
import { Papel } from '../src/dominio/Papel';
import type { Profissional } from '../src/dominio/Profissional';
import type { DadosProjeto, Projeto, RequisitoPapel } from '../src/dominio/Projeto';
import { ProjetoAnimacao } from '../src/dominio/ProjetoAnimacao';
import { ProjetoDocumentario } from '../src/dominio/ProjetoDocumentario';
import { ProjetoFiccao } from '../src/dominio/ProjetoFiccao';
import { ProjetoPublicitario } from '../src/dominio/ProjetoPublicitario';
import type { Email } from '../src/observadores/NotificadorEmail';

export const PRAZO = new Date('2027-03-30');

export const requisito = (papel: Papel, peso: number, ...competencias: [string, number][]): RequisitoPapel => ({
  papel,
  peso,
  competenciasDesejadas: competencias.map(([nome, nivel]) => new Competencia(nome, nivel)),
});

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
    papeis: [
      requisito(Papel.DIRETOR, 5, ['documentario', 9], ['narrativa', 8]),
      requisito(Papel.DIRETOR_FOTOGRAFIA, 3, ['camera', 8]),
      requisito(Papel.SONOPLASTA, 2, ['captacao de som', 8]),
      requisito(Papel.EDITOR, 3, ['montagem', 8]),
      requisito(Papel.ROTEIRISTA, 4, ['pesquisa', 9]),
    ],
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
