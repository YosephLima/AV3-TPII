import { AdaptadorS3 } from './adaptadores/armazenamento/AdaptadorS3';
import { AdaptadorStripe } from './adaptadores/pagamento/AdaptadorStripe';
import { AdaptadorInterno } from './adaptadores/profissionais/AdaptadorInterno';
import { profissionaisIniciais } from './dados/profissionais';
import { AuditoriaDecorator, RegistroChamadas } from './decoradores/AuditoriaDecorator';
import { ArmazemCache, CacheDecorator } from './decoradores/CacheDecorator';
import { CanalArmazenamento, CompressaoDecorator, validarNivelCompressao } from './decoradores/CompressaoDecorator';
import { PoliticaDecoradores } from './decoradores/PoliticaDecoradores';
import { S3Simulado } from './externos/S3Simulado';
import { StripeSimulado } from './externos/StripeSimulado';
import { FabricaAnimacao } from './fabricas/animacao/FabricaAnimacao';
import { FabricaDocumentario } from './fabricas/documentario/FabricaDocumentario';
import { FabricaFiccao } from './fabricas/ficcao/FabricaFiccao';
import { FabricaPublicitario } from './fabricas/publicitario/FabricaPublicitario';
import { RegistroFabricas } from './fabricas/RegistroFabricas';
import { AuditoriaRecomendacao } from './observadores/AuditoriaRecomendacao';
import { BarramentoEmMemoria, type BarramentoEventos } from './observadores/BarramentoEventos';
import { NotificadorEmail, type EnviarEmail } from './observadores/NotificadorEmail';
import { NotificadorInterno } from './observadores/NotificadorInterno';
import { OrquestradorPadrao } from './orquestracao/OrquestradorPadrao';
import { RepositorioProfissionaisMemoria, type RepositorioProfissionais } from './repositorio/RepositorioProfissionais';
import { SistemaRecomendacao, type Adaptadores } from './SistemaRecomendacao';

export interface Dependencias {
  repositorio?: RepositorioProfissionais;
  /** Os que faltarem usam o cadastro interno e os simuladores em memória. */
  adaptadores?: Partial<Adaptadores>;
  barramento?: BarramentoEventos;
  fabricas?: RegistroFabricas;
  enviarEmail?: EnviarEmail;
  escreverAuditoria?: (linha: string) => void;
  /** Pilha padrão de decoradores, de fora para dentro. */
  decoradores?: string[];
  nivelCompressao?: number;
  cache?: ArmazemCache;
}

/** Um tipo novo é mais uma linha aqui. */
export function fabricasPadrao(enviarEmail?: EnviarEmail): RegistroFabricas {
  return new RegistroFabricas()
    .registrar(new FabricaDocumentario(enviarEmail))
    .registrar(new FabricaAnimacao(enviarEmail))
    .registrar(new FabricaPublicitario(enviarEmail))
    .registrar(new FabricaFiccao(enviarEmail));
}

/** Único lugar que escolhe as implementações concretas. */
export function criarSistema(dependencias: Dependencias = {}) {
  const repositorio = dependencias.repositorio ?? new RepositorioProfissionaisMemoria(profissionaisIniciais());
  const fabricas = dependencias.fabricas ?? fabricasPadrao(dependencias.enviarEmail);
  const adaptadores: Adaptadores = {
    armazenamento: new AdaptadorS3(new S3Simulado(), 'cinebridge'),
    pagamento: new AdaptadorStripe(new StripeSimulado()),
    profissional: new AdaptadorInterno(repositorio),
    ...dependencias.adaptadores,
  };

  // O estado dos decoradores fica aqui, compartilhado: a pilha pode ser remontada a cada pedido sem perder
  // o cache nem o histórico da auditoria.
  const nivelCompressao = validarNivelCompressao(dependencias.nivelCompressao ?? 6);
  const cache = dependencias.cache ?? new ArmazemCache();
  const chamadas = new RegistroChamadas(dependencias.escreverAuditoria);
  const canal = new CanalArmazenamento(() => sistema.adaptadores.armazenamento);
  const politica = new PoliticaDecoradores(
    {
      auditoria: (interno) => new AuditoriaDecorator(interno, chamadas),
      cache: (interno) => new CacheDecorator(interno, cache),
      compressao: (interno) => new CompressaoDecorator(interno, canal, nivelCompressao),
    },
    dependencias.decoradores,
  );

  const sistema: SistemaRecomendacao = new SistemaRecomendacao(
    fabricas,
    (fabrica, profissionais) => new OrquestradorPadrao(fabrica, profissionais),
    adaptadores,
    dependencias.barramento ?? new BarramentoEmMemoria(),
    politica.paraProjeto,
  );

  const notificadorInterno = new NotificadorInterno();
  const auditoria = new AuditoriaRecomendacao(dependencias.escreverAuditoria);
  sistema.adicionarObservador(new NotificadorEmail(dependencias.enviarEmail));
  sistema.adicionarObservador(notificadorInterno);
  sistema.adicionarObservador(auditoria);

  return { sistema, repositorio, adaptadores, fabricas, notificadorInterno, auditoria, politica, cache, chamadas, canal };
}
