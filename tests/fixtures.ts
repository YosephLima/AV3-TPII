import { criarSistema } from '../src/composicao';
import { profissionaisIniciais } from '../src/dados/profissionais';
import { Competencia } from '../src/dominio/Competencia';
import { Papel } from '../src/dominio/Papel';
import type { Profissional } from '../src/dominio/Profissional';
import { Projeto, type DadosProjeto, type RequisitoPapel } from '../src/dominio/Projeto';
import type { Email } from '../src/observadores/NotificadorEmail';

export const PRAZO = new Date('2027-03-30');

export const requisito = (papel: Papel, peso: number, ...competencias: [string, number][]): RequisitoPapel => ({
  papel,
  peso,
  competenciasDesejadas: competencias.map(([nome, nivel]) => new Competencia(nome, nivel)),
});

/** Documentário com os cinco papéis mais comuns; qualquer campo pode ser sobrescrito. */
export function criarProjeto(dados: Partial<DadosProjeto> = {}): Projeto {
  return new Projeto({
    nome: 'Vozes do Sertão',
    produtor: 'produtora@exemplo.com',
    genero: 'drama social',
    duracao: 90,
    tipoCaptacao: 'documentario',
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
