import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ArquivoNaoEncontradoError, type AdaptadorArmazenamento } from '../src/adaptadores/armazenamento/AdaptadorArmazenamento';
import { AdaptadorGoogleCloud } from '../src/adaptadores/armazenamento/AdaptadorGoogleCloud';
import { AdaptadorLocal } from '../src/adaptadores/armazenamento/AdaptadorLocal';
import { AdaptadorS3 } from '../src/adaptadores/armazenamento/AdaptadorS3';
import { adaptadoresDoAmbiente, ConfiguracaoInvalidaError } from '../src/adaptadores/doAmbiente';
import { PagamentoInvalidoError, PagamentoNaoEncontradoError, type AdaptadorPagamento } from '../src/adaptadores/pagamento/AdaptadorPagamento';
import { AdaptadorPagSeguro } from '../src/adaptadores/pagamento/AdaptadorPagSeguro';
import { AdaptadorStripe } from '../src/adaptadores/pagamento/AdaptadorStripe';
import { AdaptadorInterno } from '../src/adaptadores/profissionais/AdaptadorInterno';
import { AdaptadorLinkedIn } from '../src/adaptadores/profissionais/AdaptadorLinkedIn';
import { ProfissionalNaoEncontradoError, type AdaptadorProfissional } from '../src/adaptadores/profissionais/AdaptadorProfissional';
import { criarSistema } from '../src/composicao';
import { profissionaisIniciais } from '../src/dados/profissionais';
import { Avaliacao } from '../src/dominio/Avaliacao';
import { Papel } from '../src/dominio/Papel';
import { GoogleCloudStorageSimulado } from '../src/externos/GoogleCloudStorageSimulado';
import { LinkedInSimulado, perfisIniciais } from '../src/externos/LinkedInSimulado';
import { PagSeguroSimulado } from '../src/externos/PagSeguroSimulado';
import { S3Simulado } from '../src/externos/S3Simulado';
import { StripeSimulado } from '../src/externos/StripeSimulado';
import { RepositorioProfissionaisMemoria } from '../src/repositorio/RepositorioProfissionais';
import type { SistemaRecomendacao } from '../src/SistemaRecomendacao';

const diretorios: string[] = [];
afterAll(() => Promise.all(diretorios.map((d) => rm(d, { recursive: true, force: true }))));

async function diretorioTemporario(): Promise<string> {
  const diretorio = await mkdtemp(join(tmpdir(), 'cinebridge-'));
  diretorios.push(diretorio);
  return diretorio;
}

const PRODUTOR_SEM_SALDO = 'sem-saldo@exemplo.com';

const armazenamentos: [string, () => Promise<AdaptadorArmazenamento>][] = [
  ['S3', async () => new AdaptadorS3(new S3Simulado(), 'teste')],
  ['Google Cloud', async () => new AdaptadorGoogleCloud(new GoogleCloudStorageSimulado(), 'teste')],
  ['local', async () => new AdaptadorLocal(await diretorioTemporario())],
];

const pagamentos: [string, () => AdaptadorPagamento][] = [
  ['Stripe', () => new AdaptadorStripe(new StripeSimulado([PRODUTOR_SEM_SALDO]))],
  ['PagSeguro', () => new AdaptadorPagSeguro(new PagSeguroSimulado([PRODUTOR_SEM_SALDO]))],
];

const fontesDeProfissionais: [string, () => AdaptadorProfissional, string][] = [
  ['interno', () => new AdaptadorInterno(new RepositorioProfissionaisMemoria(profissionaisIniciais())), 'p04'],
  ['LinkedIn', () => new AdaptadorLinkedIn(new LinkedInSimulado()), 'urn:li:person:rf01'],
];

describe('Adapter: o mesmo contrato para todos os provedores', () => {
  describe.each(armazenamentos)('armazenamento %s', (_, criar) => {
    it('salva, recupera e lista por prefixo', async () => {
      const adaptador = await criar();
      const id = await adaptador.salvarArquivo(Buffer.from('roteiro v1'), { caminho: 'projetos/1/roteiro.txt', tipoConteudo: 'text/plain' });
      await adaptador.salvarArquivo(Buffer.from([0, 1, 2]), { caminho: 'projetos/1/storyboard.png' });
      await adaptador.salvarArquivo(Buffer.from('outro'), { caminho: 'projetos/2/roteiro.txt' });

      expect(id).toBe('projetos/1/roteiro.txt');
      expect((await adaptador.recuperarArquivo(id)).toString()).toBe('roteiro v1');
      expect(await adaptador.recuperarArquivo('projetos/1/storyboard.png')).toEqual(Buffer.from([0, 1, 2]));
      expect(await adaptador.listarArquivos('projetos/1/')).toEqual(['projetos/1/roteiro.txt', 'projetos/1/storyboard.png']);
      expect(await adaptador.listarArquivos('nada/')).toEqual([]);
    });

    it('arquivo inexistente vira o mesmo erro, qualquer que seja o provedor', async () => {
      await expect((await criar()).recuperarArquivo('nao/existe.txt')).rejects.toThrow(ArquivoNaoEncontradoError);
    });
  });

  describe.each(pagamentos)('pagamento %s', (_, criar) => {
    it('paga, consulta e cancela com os status padronizados', async () => {
      const adaptador = criar();
      const id = await adaptador.efetuarPagamento(12_345.5, 'produtora@exemplo.com', 'p04');

      expect(await adaptador.verificarPagamento(id)).toBe('aprovado');
      expect(await adaptador.cancelarPagamento(id)).toBe(true);
      expect(await adaptador.verificarPagamento(id)).toBe('cancelado');
      expect(await adaptador.cancelarPagamento(id)).toBe(false);
    });

    it('pagamento recusado, inexistente ou com valor inválido', async () => {
      const adaptador = criar();
      const recusado = await adaptador.efetuarPagamento(100, PRODUTOR_SEM_SALDO, 'p04');

      expect(await adaptador.verificarPagamento(recusado)).toBe('recusado');
      expect(await adaptador.cancelarPagamento(recusado)).toBe(false);
      expect(await adaptador.cancelarPagamento('nao-existe')).toBe(false);
      await expect(adaptador.verificarPagamento('nao-existe')).rejects.toThrow(PagamentoNaoEncontradoError);
      await expect(adaptador.efetuarPagamento(0, 'produtora@exemplo.com', 'p04')).rejects.toThrow(PagamentoInvalidoError);
    });
  });

  describe.each(fontesDeProfissionais)('profissionais %s', (_, criar, idFotografo) => {
    it('lista por papel e cidade e detalha pelo id', async () => {
      const adaptador = criar();
      const fotografos = await adaptador.listarProfissionais({ papeis: [Papel.DIRETOR_FOTOGRAFIA] });
      const emSaoPaulo = await adaptador.listarProfissionais({ papeis: [Papel.DIRETOR_FOTOGRAFIA], localizacao: 'São Paulo' });

      expect(fotografos.length).toBeGreaterThan(0);
      expect(fotografos.every((p) => p.atuaComo(Papel.DIRETOR_FOTOGRAFIA))).toBe(true);
      expect(emSaoPaulo.every((p) => p.localizacao === 'São Paulo')).toBe(true);
      expect((await adaptador.detalharProfissional(idFotografo)).atuaComo(Papel.DIRETOR_FOTOGRAFIA)).toBe(true);
    });

    it('registra avaliação e recusa id desconhecido', async () => {
      const adaptador = criar();
      const antes = (await adaptador.detalharProfissional(idFotografo)).avaliacoes.length;
      await adaptador.registrarAvaliacao(idFotografo, new Avaliacao(5, 'impecável', new Date()));

      expect((await adaptador.detalharProfissional(idFotografo)).avaliacoes).toHaveLength(antes + 1);
      await expect(adaptador.detalharProfissional('ninguem')).rejects.toThrow(ProfissionalNaoEncontradoError);
      await expect(adaptador.registrarAvaliacao('ninguem', new Avaliacao(5, '', new Date()))).rejects.toThrow(
        ProfissionalNaoEncontradoError,
      );
    });
  });
});

describe('Adapter: a tradução de cada provedor', () => {
  it('Stripe recebe centavos e PagSeguro recebe texto com duas casas', async () => {
    const stripe = new StripeSimulado();
    const idStripe = await new AdaptadorStripe(stripe).efetuarPagamento(12_345.5, 'produtora@exemplo.com', 'p04');
    expect((await stripe.paymentIntents.retrieve(idStripe)).amount).toBe(1_234_550);
    expect(idStripe).toMatch(/^pi_/);

    const pagseguro = new PagSeguroSimulado();
    const codigo = await new AdaptadorPagSeguro(pagseguro).efetuarPagamento(12_345.5, 'produtora@exemplo.com', 'p04');
    expect((await pagseguro.consultar(codigo))?.valor).toBe('12345.50');
  });

  it('o perfil do LinkedIn vira um Profissional do domínio', async () => {
    const renata = await new AdaptadorLinkedIn(new LinkedInSimulado()).detalharProfissional('urn:li:person:rf01');

    expect(renata.nome).toBe('Renata Freitas');
    expect(renata.especialidades).toEqual([Papel.DIRETOR_FOTOGRAFIA]);
    expect(renata.vetorCompetencias()).toEqual(new Map([['iluminacao', 10], ['camera', 9], ['drone', 4]]));
    expect(renata.precoMedio).toBe(13_000);
    expect(renata.notaMedia()).toBe(4.5);
    expect(renata.disponibilidade.inicio).toEqual(new Date('2026-09-01'));
  });

  it('o LinkedIn guarda a nota na escala dele (1 a 10)', async () => {
    const linkedin = new LinkedInSimulado();
    await new AdaptadorLinkedIn(linkedin).registrarAvaliacao('urn:li:person:ro06', new Avaliacao(3.5, 'bom', new Date()));
    expect((await linkedin.getProfile('urn:li:person:ro06')).recommendations.map((r) => r.rating)).toEqual([7]);
  });

  it('as listagens paginadas do S3 e do LinkedIn chegam inteiras', async () => {
    const s3 = new AdaptadorS3(new S3Simulado(), 'teste');
    for (let i = 0; i < 1_005; i++) await s3.salvarArquivo(Buffer.from('x'), { caminho: `lote/${String(i).padStart(4, '0')}` });
    expect(await s3.listarArquivos('lote/')).toHaveLength(1_005);

    const [modelo] = perfisIniciais();
    const muitos = Array.from({ length: 120 }, (_, i) => ({ ...structuredClone(modelo!), urn: `urn:li:person:x${i}` }));
    expect(await new AdaptadorLinkedIn(new LinkedInSimulado(muitos)).listarProfissionais()).toHaveLength(120);
  });

  it('o armazenamento local não deixa sair do diretório', async () => {
    const local = new AdaptadorLocal(await diretorioTemporario());
    await expect(local.salvarArquivo(Buffer.from('x'), { caminho: '../fora.txt' })).rejects.toThrow(/fora do armazenamento/);
  });
});

describe('Adapter: provedor escolhido pelo ambiente', () => {
  const repositorio = new RepositorioProfissionaisMemoria(profissionaisIniciais());

  it('cada variável escolhe um adaptador, e o padrão é local, Stripe e cadastro interno', () => {
    const padrao = adaptadoresDoAmbiente(repositorio, {});
    expect([padrao.armazenamento, padrao.pagamento, padrao.profissional].map((a) => a.provedor)).toEqual(['local', 'stripe', 'interno']);

    const outros = adaptadoresDoAmbiente(repositorio, { ARMAZENAMENTO: 'gcs', PAGAMENTO: 'pagseguro', PROFISSIONAIS: 'linkedin' });
    expect([outros.armazenamento, outros.pagamento, outros.profissional].map((a) => a.provedor)).toEqual(['gcs', 'pagseguro', 'linkedin']);
  });

  it('valor desconhecido é recusado já na inicialização', () => {
    expect(() => adaptadoresDoAmbiente(repositorio, { PAGAMENTO: 'boleto' })).toThrow(ConfiguracaoInvalidaError);
    expect(() => adaptadoresDoAmbiente(repositorio, { PAGAMENTO: 'boleto' })).toThrow('stripe, pagseguro');
  });
});

describe('Adapter no SistemaRecomendacao: trocar o provedor não muda a lógica', () => {
  const silencioso = { enviarEmail: () => {}, escreverAuditoria: () => {} };
  const solicitacao = {
    tipo: 'documentario',
    nome: 'Rios Urbanos',
    produtor: 'produtora@exemplo.com',
    detalhes: { tema: 'Rios urbanos', entrevistados: ['Ana'] },
  };

  /** Recomenda, todos aceitam (a equipe é paga) e depois o produtor pede reavaliação (os pagamentos são estornados). */
  async function fluxoCompleto(sistema: SistemaRecomendacao) {
    const { projeto, equipe } = await sistema.recomendar(solicitacao);
    for (const membro of equipe.membros) await sistema.responderConvite(projeto, membro.papel, true);
    const pagamentos = equipe.membros.map((m) => m.pagamentoId ?? '');
    await sistema.reavaliar(projeto);
    return { projeto, pagamentos };
  }

  const combinacoes = armazenamentos.flatMap(([nomeA, criarA]) => pagamentos.map(([nomeP, criarP]) => [`${nomeA} + ${nomeP}`, criarA, criarP] as const));

  it.each(combinacoes)('%s', async (_, criarArmazenamento, criarPagamento) => {
    const armazenamento = await criarArmazenamento();
    const pagamento = criarPagamento();
    const { sistema } = criarSistema({ ...silencioso, adaptadores: { armazenamento, pagamento } });

    const { projeto, pagamentos: ids } = await fluxoCompleto(sistema);

    // A reavaliação gera outra equipe e sobrescreve o arquivo do projeto.
    const arquivada = await sistema.consultarRecomendacao(projeto.id);
    expect(arquivada.equipe.map((m) => m.profissionalId)).toEqual(projeto.equipe?.membros.map((m) => m.profissional.id));
    expect(await armazenamento.listarArquivos('recomendacoes/')).toEqual([`recomendacoes/${projeto.id}.json`]);
    expect(ids).toHaveLength(5);
    for (const id of ids) expect(await pagamento.verificarPagamento(id)).toBe('cancelado');
  });

  it('com o LinkedIn como fonte, a equipe sai dos perfis de lá', async () => {
    const { sistema } = criarSistema({ ...silencioso, adaptadores: { profissional: new AdaptadorLinkedIn(new LinkedInSimulado()) } });
    const { equipe } = await sistema.recomendar(solicitacao);

    expect(equipe.membros).toHaveLength(5);
    expect(equipe.membros.every((m) => m.profissional.id.startsWith('urn:li:person:'))).toBe(true);
  });

  it('configurarAdaptadores troca o provedor em tempo de execução', async () => {
    const s3 = new AdaptadorS3(new S3Simulado(), 'antes');
    const gcs = new AdaptadorGoogleCloud(new GoogleCloudStorageSimulado(), 'depois');
    const pagseguro = new AdaptadorPagSeguro(new PagSeguroSimulado());
    const { sistema, adaptadores } = criarSistema({ ...silencioso, adaptadores: { armazenamento: s3 } });

    const primeiro = await sistema.recomendar(solicitacao);
    sistema.configurarAdaptadores(gcs, pagseguro, adaptadores.profissional);
    const segundo = await sistema.recomendar(solicitacao);
    for (const membro of segundo.equipe.membros) await sistema.responderConvite(segundo.projeto, membro.papel, true);

    expect(await s3.listarArquivos('recomendacoes/')).toEqual([`recomendacoes/${primeiro.projeto.id}.json`]);
    expect(await gcs.listarArquivos('recomendacoes/')).toEqual([`recomendacoes/${segundo.projeto.id}.json`]);
    expect(segundo.equipe.membros.every((m) => m.pagamentoId?.startsWith('COB-'))).toBe(true);
  });
});
