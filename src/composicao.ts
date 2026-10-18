import { profissionaisIniciais } from './dados/profissionais';
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
import { SistemaRecomendacao } from './SistemaRecomendacao';

export interface Dependencias {
  repositorio?: RepositorioProfissionais;
  barramento?: BarramentoEventos;
  fabricas?: RegistroFabricas;
  enviarEmail?: EnviarEmail;
  escreverAuditoria?: (linha: string) => void;
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
  const sistema = new SistemaRecomendacao(
    fabricas,
    (fabrica) => new OrquestradorPadrao(fabrica, repositorio),
    dependencias.barramento ?? new BarramentoEmMemoria(),
  );

  const notificadorInterno = new NotificadorInterno();
  const auditoria = new AuditoriaRecomendacao(dependencias.escreverAuditoria);
  sistema.adicionarObservador(new NotificadorEmail(dependencias.enviarEmail));
  sistema.adicionarObservador(notificadorInterno);
  sistema.adicionarObservador(auditoria);

  return { sistema, repositorio, fabricas, notificadorInterno, auditoria };
}
