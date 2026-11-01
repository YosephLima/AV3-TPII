import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { criarSistema, fabricasPadrao } from '../src/composicao';
import { Papel } from '../src/dominio/Papel';
import { ProjetoAnimacao } from '../src/dominio/ProjetoAnimacao';
import { ProjetoDocumentario } from '../src/dominio/ProjetoDocumentario';
import { ProjetoFiccao } from '../src/dominio/ProjetoFiccao';
import { ProjetoPublicitario } from '../src/dominio/ProjetoPublicitario';
import { construirApp } from '../src/http/app';
import type { Email } from '../src/observadores/NotificadorEmail';
import { OrquestradorPadrao } from '../src/orquestracao/OrquestradorPadrao';
import type { SolicitacaoRecomendacao } from '../src/SistemaRecomendacao';
import { PRAZO, servico, servicos } from './fixtures';
import { FabricaRealidadeVirtual, ProjetoRealidadeVirtual } from './realidadeVirtual';

function sistemaCapturandoEmails(comRealidadeVirtual = false) {
  const emails: Email[] = [];
  const enviarEmail = (e: Email) => emails.push(e);
  const fabricas = fabricasPadrao(enviarEmail);
  if (comRealidadeVirtual) fabricas.registrar(new FabricaRealidadeVirtual(enviarEmail));
  const contexto = criarSistema({ fabricas, enviarEmail, escreverAuditoria: () => {} });
  return { ...contexto, emails };
}

const comum = { nome: 'Projeto X', produtor: 'produtora@exemplo.com', restricoes: { prazo: PRAZO } };

/** A mesma solicitação para cada tipo; só mudam o tipo e os detalhes que ele exige. */
const solicitacoes: [SolicitacaoRecomendacao, Function, string, string][] = [
  [{ ...comum, tipo: 'documentario', detalhes: { tema: 'Rios urbanos', entrevistados: ['Ana'] } }, ProjetoDocumentario, 'documentario', 'Documentário sobre "Rios urbanos"'],
  [{ ...comum, tipo: 'animacao', detalhes: { tecnica: '3d', quadrosPorSegundo: 24 } }, ProjetoAnimacao, 'animacao', 'Animação 3d a 24 fps'],
  [{ ...comum, tipo: 'publicitario', detalhes: { cliente: 'Café Aurora' } }, ProjetoPublicitario, 'publicitario', 'Campanha para Café Aurora'],
  [{ ...comum, tipo: 'ficcao' }, ProjetoFiccao, 'cosseno', 'no projeto Projeto X.'],
];

describe('Integração: alternar fábricas produz ecossistemas coerentes com o tipo', () => {
  it.each(solicitacoes)('%o', async (solicitacao, classe, estrategia, trechoDoConvite) => {
    const { sistema, emails } = sistemaCapturandoEmails();

    const { projeto, equipe } = await sistema.recomendar(solicitacao);
    const avaliacao = sistema.avaliar(projeto);

    expect(projeto).toBeInstanceOf(classe);
    expect(sistema.estrategiaPara(projeto).nome).toBe(estrategia);
    expect(equipe.membros.length).toBe(projeto.papeis.length);
    expect(avaliacao.consistente).toBe(true);
    expect(emails).toHaveLength(equipe.membros.length);
    expect(emails.every((e) => e.corpo.includes(trechoDoConvite))).toBe(true);
  });

  it('só o relatório de animação traz métricas de renderização', async () => {
    const { sistema } = sistemaCapturandoEmails();
    const relatorios = await Promise.all(
      solicitacoes.map(async ([s]) => sistema.avaliar((await sistema.recomendar(s)).projeto).relatorio),
    );
    expect(relatorios.map((r) => r.includes('quadros por dia'))).toEqual([false, true, false, false]);
  });

  it('o mesmo OrquestradorPadrao ranqueia de forma diferente conforme a fábrica recebida', async () => {
    const { adaptadores, fabricas } = sistemaCapturandoEmails();
    const servicoPrincipal = servicos(servico(Papel.DIRETOR_FOTOGRAFIA, 1, ['iluminacao', 8], ['camera', 8]));
    const prazo = new Date('2027-12-01');
    const fotografoPara = async (tipo: string, detalhes = {}) => {
      const fabrica = fabricas.para(tipo);
      const projeto = fabrica.criarProjeto({ ...comum, servicoPrincipal, restricoes: { prazo }, detalhes });
      const equipe = await new OrquestradorPadrao(fabrica, adaptadores.profissional).orquestrar(projeto);
      return equipe.membro(Papel.DIRETOR_FOTOGRAFIA)?.profissional.id;
    };

    // Ficção usa só aderência técnica; publicidade pesa também a reputação.
    expect(await fotografoPara('ficcao')).toBe('p06');
    expect(await fotografoPara('publicitario', { cliente: 'Café Aurora' })).toBe('p04');
  });

  it('substituição e convites seguem a família do projeto até o fim do fluxo', async () => {
    const { sistema, emails } = sistemaCapturandoEmails();
    const { projeto } = await sistema.recomendar(solicitacoes[1]![0]);
    emails.length = 0;

    await sistema.responderConvite(projeto, Papel.EFEITOS_VISUAIS, false);

    const convite = emails.find((e) => e.assunto.startsWith('Convite'));
    expect(convite?.corpo).toContain('Animação 3d a 24 fps');
    expect(sistema.avaliar(projeto).consistente).toBe(true);
  });
});

describe('Extensibilidade: tipo novo (realidade virtual) sem tocar no orquestrador nem no sistema', () => {
  it('basta registrar a fábrica: o fluxo completo funciona, inclusive pela API', async () => {
    const { sistema, adaptadores, emails } = sistemaCapturandoEmails(true);
    const app = construirApp({ sistema });

    const resposta = await app.inject({
      method: 'POST',
      url: '/recomendacoes',
      payload: { tipo: 'realidade-virtual', nome: 'Museu Imersivo', produtor: 'estudio@exemplo.com', detalhes: { plataforma: 'Meta Quest' } },
    });
    await app.close();

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().estrategia).toBe('animacao');
    expect(resposta.json().equipe.membros.find((m: { papel: string }) => m.papel === 'EFEITOS_VISUAIS').profissional.id).toBe('p14');
    expect(emails[0]?.corpo).toContain('Experiência imersiva para Meta Quest.');
  });

  it('as regras do tipo novo valem, e sem a fábrica registrada o tipo é recusado', async () => {
    const comRv = sistemaCapturandoEmails(true);
    await expect(comRv.sistema.recomendar({ ...comum, tipo: 'realidade-virtual' })).rejects.toThrow('sem plataforma');
    expect(comRv.sistema.criarProjeto({ ...comum, tipo: 'realidade-virtual' })).toBeInstanceOf(ProjetoRealidadeVirtual);

    const semRv = sistemaCapturandoEmails();
    expect(() => semRv.sistema.criarProjeto({ ...comum, tipo: 'realidade-virtual' })).toThrow('Tipo de projeto desconhecido');
  });
});

describe('Guarda: o núcleo não conhece nenhum tipo de projeto', () => {
  const nucleo = [
    'src/SistemaRecomendacao.ts',
    'src/http/app.ts',
    ...readdirSync('src/orquestracao').map((f) => join('src/orquestracao', f)),
  ];
  const tipos = [...fabricasPadrao().tipos(), 'realidade-virtual'];

  it.each(nucleo)('%s não menciona tipos de projeto', (arquivo) => {
    const codigo = readFileSync(arquivo, 'utf8');
    for (const tipo of tipos) expect(codigo).not.toContain(`'${tipo}'`);
    expect(codigo).not.toMatch(/instanceof Projeto(Documentario|Animacao|Publicitario|Ficcao|RealidadeVirtual)/);
  });
});
