import { profissionaisIniciais } from './dados/profissionais';
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
  enviarEmail?: EnviarEmail;
  escreverAuditoria?: (linha: string) => void;
}

/** Único lugar que escolhe as implementações concretas. */
export function criarSistema(dependencias: Dependencias = {}) {
  const repositorio = dependencias.repositorio ?? new RepositorioProfissionaisMemoria(profissionaisIniciais());
  const sistema = new SistemaRecomendacao(
    new OrquestradorPadrao(repositorio),
    dependencias.barramento ?? new BarramentoEmMemoria(),
  );

  const notificadorInterno = new NotificadorInterno();
  const auditoria = new AuditoriaRecomendacao(dependencias.escreverAuditoria);
  sistema.adicionarObservador(new NotificadorEmail(dependencias.enviarEmail));
  sistema.adicionarObservador(notificadorInterno);
  sistema.adicionarObservador(auditoria);

  return { sistema, repositorio, notificadorInterno, auditoria };
}
