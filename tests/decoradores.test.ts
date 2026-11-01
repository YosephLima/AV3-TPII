import { performance } from 'node:perf_hooks';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { AdaptadorS3 } from '../src/adaptadores/armazenamento/AdaptadorS3';
import { criarSistema } from '../src/composicao';
import { profissionaisIniciais } from '../src/dados/profissionais';
import { AuditoriaDecorator, RegistroChamadas, type Relogio } from '../src/decoradores/AuditoriaDecorator';
import { ArmazemCache, CacheDecorator } from '../src/decoradores/CacheDecorator';
import { CompressaoDecorator, serializarRecomendacoes, type CanalSaida, type InfoEnvio } from '../src/decoradores/CompressaoDecorator';
import { descreverPilha } from '../src/decoradores/DecoradorRecomendacao';
import { PilhaInvalidaError, pilhaDoTexto } from '../src/decoradores/PoliticaDecoradores';
import { Avaliacao } from '../src/dominio/Avaliacao';
import type { Recomendacoes } from '../src/dominio/Equipe';
import type { Profissional } from '../src/dominio/Profissional';
import type { Projeto } from '../src/dominio/Projeto';
import { S3Simulado } from '../src/externos/S3Simulado';
import { RecomendadorBase } from '../src/estrategias/RecomendadorBase';
import type { RecomendacaoStrategy } from '../src/estrategias/RecomendacaoStrategy';
import { construirApp } from '../src/http/app';
import { criarProjeto } from './fixtures';

const ATRASO_MS = 30;

/** O RecomendadorBase de verdade, mais um atraso fixo (como uma consulta cara) e um contador de chamadas. */
class RecomendadorLento implements RecomendacaoStrategy {
  readonly nome = 'base';
  chamadas = 0;
  private readonly base = new RecomendadorBase();

  recomendar(projeto: Projeto, profissionais: Profissional[]): Recomendacoes {
    this.chamadas += 1;
    const ate = performance.now() + ATRASO_MS;
    while (performance.now() < ate);
    return this.base.recomendar(projeto, profissionais);
  }
}

class Falha implements RecomendacaoStrategy {
  readonly nome = 'falha';
  recomendar(): Recomendacoes {
    throw new Error('serviço fora do ar');
  }
}

class Coletor implements CanalSaida {
  readonly envios: { conteudo: Buffer; info: InfoEnvio }[] = [];
  enviar(conteudo: Buffer, info: InfoEnvio): void {
    this.envios.push({ conteudo, info });
  }
}

function cronometrar<T>(executar: () => T): { resultado: T; ms: number } {
  const inicio = performance.now();
  const resultado = executar();
  return { resultado, ms: performance.now() - inicio };
}

const relogioFalso = (passoMs: number): Relogio => {
  let agora = 0;
  return { agora: () => new Date('2026-11-01T12:00:00Z'), medir: () => (agora += passoMs) };
};

const candidatos = () => profissionaisIniciais();

describe('Decorator', () => {
  describe('CacheDecorator', () => {
    it('a repetição do pedido fica bem mais rápida e o recomendador não é chamado de novo', () => {
      const lento = new RecomendadorLento();
      const comCache = new CacheDecorator(lento);
      const projeto = criarProjeto();

      const primeira = cronometrar(() => comCache.recomendar(projeto, candidatos()));
      const segunda = cronometrar(() => comCache.recomendar(projeto, candidatos()));

      expect(primeira.ms).toBeGreaterThanOrEqual(ATRASO_MS);
      expect(segunda.ms).toBeLessThan(ATRASO_MS / 3);
      expect(segunda.resultado).toEqual(primeira.resultado);
      expect(lento.chamadas).toBe(1);
    });

    it('projetos parecidos aproveitam o cache; mudar o que afeta o resultado, não', () => {
      const lento = new RecomendadorLento();
      const comCache = new CacheDecorator(lento);

      comCache.recomendar(criarProjeto({ nome: 'A' }), candidatos());
      comCache.recomendar(criarProjeto({ nome: 'B', produtor: 'outra@exemplo.com' }), candidatos());
      expect(lento.chamadas).toBe(1);

      comCache.recomendar(criarProjeto({ restricoes: { orcamento: 50_000, prazo: new Date('2027-03-30'), localizacao: 'SP' } }), candidatos());
      const avaliados = candidatos();
      avaliados[0]?.avaliacoes.push(new Avaliacao(1, 'atrasou', new Date()));
      comCache.recomendar(criarProjeto(), avaliados);
      expect(lento.chamadas).toBe(3);
    });

    it('respeita validade e capacidade, e quem recebe o resultado não estraga o que está guardado', () => {
      let agora = 0;
      const armazem = new ArmazemCache({ capacidade: 1, validadeMs: 1_000, agora: () => agora });
      const lento = new RecomendadorLento();
      const comCache = new CacheDecorator(lento, armazem);
      const projeto = criarProjeto();

      comCache.recomendar(projeto, candidatos()).clear();
      expect(comCache.recomendar(projeto, candidatos()).size).toBe(5);
      agora = 1_000;
      comCache.recomendar(projeto, candidatos());
      expect(lento.chamadas).toBe(2);

      comCache.recomendar(criarProjeto({ duracao: 1, restricoes: { orcamento: 1, prazo: new Date('2027-03-30'), localizacao: 'SP' } }), candidatos());
      expect(armazem.tamanho).toBe(1);
    });
  });

  describe('AuditoriaDecorator', () => {
    it('registra cada chamada com o tempo de resposta e o tamanho do resultado', () => {
      const linhas: string[] = [];
      const registro = new RegistroChamadas((linha) => linhas.push(linha));
      const auditada = new AuditoriaDecorator(new RecomendadorBase(), registro, relogioFalso(7));
      const projeto = criarProjeto();

      auditada.recomendar(projeto, candidatos());
      auditada.recomendar(projeto, candidatos());

      expect(registro.todas()).toHaveLength(2);
      expect(registro.todas()[0]).toMatchObject({ estrategia: 'base', projetoId: projeto.id, candidatos: 16, duracaoMs: 7 });
      expect(registro.todas()[0]?.resultado).toMatchObject({ DIRETOR: expect.any(Number), EDITOR: expect.any(Number) });
      expect(linhas).toHaveLength(2);
    });

    it('registra também as chamadas que falham, e o erro continua subindo', () => {
      const registro = new RegistroChamadas(() => {});
      const auditada = new AuditoriaDecorator(new Falha(), registro);

      expect(() => auditada.recomendar(criarProjeto(), candidatos())).toThrow('serviço fora do ar');
      expect(registro.todas()[0]).toMatchObject({ estrategia: 'falha', erro: 'serviço fora do ar', resultado: {} });
    });

    it('guarda só as últimas chamadas', () => {
      const registro = new RegistroChamadas(() => {}, 3);
      const auditada = new AuditoriaDecorator(new RecomendadorBase(), registro);
      for (let i = 0; i < 5; i++) auditada.recomendar(criarProjeto({ nome: `P${i}` }), candidatos());
      expect(registro.todas()).toHaveLength(3);
    });
  });

  describe('CompressaoDecorator', () => {
    it('o que sai pelo canal é menor que o JSON original e volta igual ao descomprimir', () => {
      const canal = new Coletor();
      const base = new RecomendadorBase();
      const projeto = criarProjeto();
      const resultado = new CompressaoDecorator(base, canal).recomendar(projeto, candidatos());

      const [envio] = canal.envios;
      const json = JSON.stringify(serializarRecomendacoes(resultado));
      expect(envio?.info).toMatchObject({ projetoId: projeto.id, codificacao: 'gzip', tamanhoOriginal: Buffer.byteLength(json) });
      expect(envio?.conteudo.byteLength).toBeLessThan(Buffer.byteLength(json) / 2);
      expect(gunzipSync(envio!.conteudo).toString()).toBe(json);
      expect(resultado).toEqual(base.recomendar(projeto, candidatos()));
    });

    it('um nível maior comprime mais; abaixo do tamanho mínimo vai sem compressão', () => {
      const canal = new Coletor();
      new CompressaoDecorator(new RecomendadorBase(), canal, 1).recomendar(criarProjeto(), candidatos());
      new CompressaoDecorator(new RecomendadorBase(), canal, 9).recomendar(criarProjeto(), candidatos());
      new CompressaoDecorator(new RecomendadorBase(), canal, 6, 1_000_000).recomendar(criarProjeto(), candidatos());

      const [nivel1, nivel9, pequeno] = canal.envios.map((e) => e.info);
      expect(nivel9!.tamanhoEnviado).toBeLessThanOrEqual(nivel1!.tamanhoEnviado);
      expect(pequeno).toMatchObject({ codificacao: 'identity' });
      expect(pequeno!.tamanhoEnviado).toBe(pequeno!.tamanhoOriginal);
      expect(() => new CompressaoDecorator(new RecomendadorBase(), canal, 10)).toThrow(RangeError);
    });
  });

  describe('pilhas combinadas', () => {
    it('a ordem importa: a auditoria por fora vê os acertos do cache, por dentro só as chamadas reais', () => {
      const projeto = criarProjeto();
      const deFora = new RegistroChamadas(() => {});
      const deDentro = new RegistroChamadas(() => {});
      const auditoriaPorFora = new AuditoriaDecorator(new CacheDecorator(new RecomendadorBase()), deFora);
      const auditoriaPorDentro = new CacheDecorator(new AuditoriaDecorator(new RecomendadorBase(), deDentro));

      for (let i = 0; i < 3; i++) {
        auditoriaPorFora.recomendar(projeto, candidatos());
        auditoriaPorDentro.recomendar(projeto, candidatos());
      }

      expect(deFora.todas()).toHaveLength(3);
      expect(deDentro.todas()).toHaveLength(1);
      expect(descreverPilha(auditoriaPorFora)).toBe('auditoria(cache(base))');
    });

    it('qualquer pilha devolve o mesmo resultado do RecomendadorBase sozinho', () => {
      const projeto = criarProjeto();
      const esperado = new RecomendadorBase().recomendar(projeto, candidatos());
      const pilha = new CompressaoDecorator(
        new AuditoriaDecorator(new CacheDecorator(new RecomendadorBase()), new RegistroChamadas(() => {})),
        new Coletor(),
      );
      expect(pilha.recomendar(projeto, candidatos())).toEqual(esperado);
      expect(pilha.nome).toBe('base');
    });
  });

  describe('pilha montada em tempo de execução, sem mudar o SistemaRecomendacao', () => {
    const solicitacao = { tipo: 'documentario', nome: 'Rios', produtor: 'p@exemplo.com', detalhes: { tema: 'Rios', entrevistados: ['Ana'] } };
    const silencioso = { enviarEmail: () => {}, escreverAuditoria: () => {} };

    it('a política configurada vale para todos; a preferência do produtor vale para o projeto dele', async () => {
      const { sistema, politica, chamadas, cache } = criarSistema({ ...silencioso, decoradores: ['auditoria', 'cache'] });

      const padrao = await sistema.recomendar(solicitacao);
      expect(descreverPilha(sistema.estrategiaPara(padrao.projeto))).toBe('auditoria(cache(documentario))');

      const doProdutor = await sistema.recomendar({ ...solicitacao, decoradores: ['cache', 'auditoria'] });
      expect(descreverPilha(sistema.estrategiaPara(doProdutor.projeto))).toBe('cache(auditoria(documentario))');
      // Mesmo pedido: o cache compartilhado acertou, então a auditoria de dentro não foi chamada.
      expect(chamadas.todas()).toHaveLength(1);
      expect(cache.acertos).toBe(1);

      politica.definirPadrao([]);
      expect(descreverPilha(sistema.estrategiaPara(padrao.projeto))).toBe('documentario');
      expect(() => politica.definirPadrao(['cache', 'cache'])).toThrow(PilhaInvalidaError);
      expect(() => pilhaDoTexto('auditoria, zip')).toThrow(PilhaInvalidaError);
      expect(pilhaDoTexto(' auditoria , cache ')).toEqual(['auditoria', 'cache']);
    });

    it('com compressão na pilha, o ranking chega comprimido ao armazenamento', async () => {
      const s3 = new S3Simulado();
      const { sistema, canal } = criarSistema({
        ...silencioso,
        decoradores: ['compressao'],
        adaptadores: { armazenamento: new AdaptadorS3(s3, 'cinebridge') },
      });

      const { projeto } = await sistema.recomendar(solicitacao);
      await canal.aguardar();

      const { Body, Metadata } = await s3.getObject({ Bucket: 'cinebridge', Key: `rankings/${projeto.id}.json.gz` });
      expect(Body.byteLength).toBeLessThan(Number(Metadata.tamanhoOriginal));
      expect(JSON.parse(gunzipSync(Body).toString())).toHaveProperty('DIRETOR');
    });
  });

  it('pela API: o produtor escolhe a pilha e a resposta vem comprimida se o cliente aceitar', async () => {
    const { sistema } = criarSistema({ enviarEmail: () => {}, escreverAuditoria: () => {} });
    const app = construirApp({ sistema });
    const corpo = { tipo: 'ficcao', nome: 'Longa', produtor: 'p@exemplo.com', decoradores: ['auditoria', 'cache'] };

    const simples = await app.inject({ method: 'POST', url: '/recomendacoes', payload: corpo });
    const gzip = await app.inject({ method: 'POST', url: '/recomendacoes', payload: corpo, headers: { 'accept-encoding': 'gzip' } });

    expect(simples.json().pilha).toBe('auditoria(cache(cosseno))');
    expect(gzip.headers['content-encoding']).toBe('gzip');
    expect(gzip.rawPayload.byteLength).toBeLessThan(simples.rawPayload.byteLength);
    expect((await app.inject({ method: 'POST', url: '/recomendacoes', payload: { ...corpo, decoradores: ['zip'] } })).statusCode).toBe(400);
    await app.close();
  });
});
