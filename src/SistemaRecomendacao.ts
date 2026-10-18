import type { Equipe, MembroEquipe } from './dominio/Equipe';
import type { Papel } from './dominio/Papel';
import type { Projeto } from './dominio/Projeto';
import type { RecomendacaoStrategy } from './estrategias/RecomendacaoStrategy';
import type { DadosCriacao, FabricaProjeto } from './fabricas/FabricaProjeto';
import type { RegistroFabricas } from './fabricas/RegistroFabricas';
import { BarramentoEmMemoria, type BarramentoEventos } from './observadores/BarramentoEventos';
import { EventoRecomendacao, type TipoEvento } from './observadores/EventoRecomendacao';
import type { Observador } from './observadores/Observador';
import type { OrquestradorEquipe } from './orquestracao/OrquestradorEquipe';
import { CalculadorCompatibilidade } from './visitantes/CalculadorCompatibilidade';

export class SemCandidatoError extends Error {
  constructor(papel: Papel) {
    super(`Não há outro profissional disponível para ${papel}`);
    this.name = 'SemCandidatoError';
  }
}

export type SolicitacaoRecomendacao = DadosCriacao & { tipo: string };

export interface Avaliacao {
  consistente: boolean;
  erros: string[];
  compatibilidade: number;
  relatorio: string;
}

/** Ponto de entrada: escolhe a fábrica pelo tipo do projeto e usa os objetos dela em todo o fluxo. */
export class SistemaRecomendacao {
  private static readonly ORIGEM = 'sistema-recomendacao';

  private readonly observadores: Observador[] = [];
  private estrategiaAtual: RecomendacaoStrategy | undefined;

  constructor(
    private readonly fabricas: RegistroFabricas,
    private readonly criarOrquestrador: (fabrica: FabricaProjeto) => OrquestradorEquipe,
    private readonly barramento: BarramentoEventos = new BarramentoEmMemoria(),
  ) {}

  /** Vale para todos os projetos, menos os que já vieram com estratégia própria. */
  definirEstrategia(estrategia: RecomendacaoStrategy): void {
    this.estrategiaAtual = estrategia;
  }

  adicionarObservador(observador: Observador): void {
    this.observadores.push(observador);
    this.barramento.inscrever((evento) => observador.atualizar(evento));
  }

  notificarObservadores(evento: EventoRecomendacao): void {
    this.barramento.publicar(evento);
  }

  catalogo(): { tipo: string; modelos: string[] }[] {
    return this.fabricas.todas().map((f) => ({ tipo: f.tipo, modelos: f.modelos() }));
  }

  criarProjeto({ tipo, ...dados }: SolicitacaoRecomendacao): Projeto {
    return this.fabricas.para(tipo).criarProjeto(dados);
  }

  async recomendar(solicitacao: SolicitacaoRecomendacao): Promise<{ projeto: Projeto; equipe: Equipe }> {
    const projeto = this.criarProjeto(solicitacao);
    return { projeto, equipe: await this.executarRecomendacao(projeto) };
  }

  async executarRecomendacao(projeto: Projeto): Promise<Equipe> {
    const fabrica = this.fabricaDe(projeto);
    const equipe = await this.criarOrquestrador(fabrica).orquestrar(projeto, this.estrategiaPara(projeto));
    projeto.definirEquipe(equipe);
    this.notificar('recomendacao_gerada', projeto, equipe.membros);
    return equipe;
  }

  /** Refaz só o papel rejeitado; o resto da equipe fica igual. */
  async substituirMembro(projeto: Projeto, papel: Papel): Promise<MembroEquipe> {
    const equipe = this.equipeDe(projeto);
    const excluir = [...equipe.membros.map((m) => m.profissional.id), ...equipe.substituidos];
    const rodada = await this.criarOrquestrador(this.fabricaDe(projeto)).orquestrar(projeto, this.estrategiaPara(projeto), {
      papeis: [papel],
      excluir,
    });

    const candidato = rodada.membro(papel);
    if (!candidato) throw new SemCandidatoError(papel);
    projeto.substituirMembro(papel, candidato.profissional);

    const novo = equipe.membro(papel) ?? candidato;
    this.notificar('membro_substituido', projeto, [novo]);
    return novo;
  }

  /** Se o profissional recusar, já busca outro para o papel. */
  async responderConvite(projeto: Projeto, papel: Papel, aceito: boolean): Promise<void> {
    const equipe = this.equipeDe(projeto);
    const membro = equipe.membro(papel);
    if (!membro) throw new Error(`Não há convite pendente para ${papel}`);

    if (!aceito) {
      this.notificar('convite_recusado', projeto, [membro]);
      await this.substituirMembro(projeto, papel);
      return;
    }

    projeto.aceitarRecomendacao(papel, membro.profissional);
    this.notificar('convite_aceito', projeto, [membro]);
    if (equipe.status === 'formada') this.notificar('equipe_formada', projeto, equipe.membros);
  }

  /** Para mudanças grandes de orçamento ou prazo. */
  async reavaliar(projeto: Projeto): Promise<Equipe> {
    this.notificar('reavaliacao_solicitada', projeto, projeto.equipe?.membros ?? []);
    projeto.solicitarReavaliacao();
    return this.executarRecomendacao(projeto);
  }

  avaliar(projeto: Projeto): Avaliacao {
    const fabrica = this.fabricaDe(projeto);
    const validador = fabrica.criarValidador();
    return {
      consistente: projeto.aceitar(validador),
      erros: validador.erros,
      compatibilidade: projeto.aceitar(new CalculadorCompatibilidade()),
      relatorio: projeto.aceitar(fabrica.criarRelatorio()),
    };
  }

  estrategiaPara(projeto: Projeto): RecomendacaoStrategy {
    return projeto.estrategia ?? this.estrategiaAtual ?? this.fabricaDe(projeto).criarRecomendador();
  }

  private fabricaDe(projeto: Projeto): FabricaProjeto {
    return this.fabricas.para(projeto.tipo);
  }

  private equipeDe(projeto: Projeto): Equipe {
    if (!projeto.equipe) throw new Error(`O projeto ${projeto.nome} ainda não tem equipe recomendada`);
    return projeto.equipe;
  }

  /** Observadores gerais e o notificador da família do projeto. */
  private notificar(tipo: TipoEvento, projeto: Projeto, membros: MembroEquipe[]): void {
    const envolvidos = membros.map((m) => ({
      profissionalId: m.profissional.id,
      nome: m.profissional.nome,
      papel: m.papel,
    }));
    const evento = new EventoRecomendacao(tipo, projeto, envolvidos, SistemaRecomendacao.ORIGEM);
    this.notificarObservadores(evento);
    try {
      this.fabricaDe(projeto).criarNotificador().atualizar(evento);
    } catch (erro) {
      console.error(erro);
    }
  }
}
