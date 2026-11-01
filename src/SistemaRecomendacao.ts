import type { AdaptadorArmazenamento } from './adaptadores/armazenamento/AdaptadorArmazenamento';
import type { AdaptadorPagamento } from './adaptadores/pagamento/AdaptadorPagamento';
import type { AdaptadorProfissional } from './adaptadores/profissionais/AdaptadorProfissional';
import { ArquivoRecomendacoes, type RecomendacaoArquivada } from './contratacao/ArquivoRecomendacoes';
import { PagamentoEquipe } from './contratacao/PagamentoEquipe';
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

export interface Adaptadores {
  armazenamento: AdaptadorArmazenamento;
  pagamento: AdaptadorPagamento;
  profissional: AdaptadorProfissional;
}

export type CriarOrquestrador = (fabrica: FabricaProjeto, profissionais: AdaptadorProfissional) => OrquestradorEquipe;

/** Envolve a estratégia escolhida (com decoradores, por exemplo). O sistema não sabe quais são. */
export type DecorarEstrategia = (estrategia: RecomendacaoStrategy, projeto: Projeto) => RecomendacaoStrategy;

/**
 * Ponto de entrada: escolhe a fábrica pelo tipo do projeto e usa os objetos dela em todo o fluxo. Os
 * sistemas externos chegam como adaptadores, então nada aqui depende de um provedor específico.
 */
export class SistemaRecomendacao {
  private static readonly ORIGEM = 'sistema-recomendacao';

  private readonly observadores: Observador[] = [];
  private estrategiaAtual: RecomendacaoStrategy | undefined;
  private adaptadorArmazenamento: AdaptadorArmazenamento;
  private adaptadorPagamento: AdaptadorPagamento;
  private adaptadorProfissional: AdaptadorProfissional;

  constructor(
    private readonly fabricas: RegistroFabricas,
    private readonly criarOrquestrador: CriarOrquestrador,
    adaptadores: Adaptadores,
    private readonly barramento: BarramentoEventos = new BarramentoEmMemoria(),
    private readonly decorar: DecorarEstrategia = (estrategia) => estrategia,
  ) {
    this.adaptadorArmazenamento = adaptadores.armazenamento;
    this.adaptadorPagamento = adaptadores.pagamento;
    this.adaptadorProfissional = adaptadores.profissional;
  }

  get adaptadores(): Adaptadores {
    return {
      armazenamento: this.adaptadorArmazenamento,
      pagamento: this.adaptadorPagamento,
      profissional: this.adaptadorProfissional,
    };
  }

  /** Troca os provedores; vale a partir da próxima operação. */
  configurarAdaptadores(
    armazenamento: AdaptadorArmazenamento,
    pagamento: AdaptadorPagamento,
    profissional: AdaptadorProfissional,
  ): void {
    this.adaptadorArmazenamento = armazenamento;
    this.adaptadorPagamento = pagamento;
    this.adaptadorProfissional = profissional;
  }

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
    const equipe = await this.orquestrador(projeto).orquestrar(projeto, this.estrategiaPara(projeto));
    projeto.definirEquipe(equipe);
    await new ArquivoRecomendacoes(this.adaptadorArmazenamento).guardar(projeto, equipe);
    this.notificar('recomendacao_gerada', projeto, equipe.membros);
    return equipe;
  }

  consultarRecomendacao(projetoId: string): Promise<RecomendacaoArquivada> {
    return new ArquivoRecomendacoes(this.adaptadorArmazenamento).consultar(projetoId);
  }

  /** Refaz só o papel rejeitado; o resto da equipe fica igual. */
  async substituirMembro(projeto: Projeto, papel: Papel): Promise<MembroEquipe> {
    const equipe = this.equipeDe(projeto);
    const excluir = [...equipe.membros.map((m) => m.profissional.id), ...equipe.substituidos];
    const rodada = await this.orquestrador(projeto).orquestrar(projeto, this.estrategiaPara(projeto), {
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

  /** Se o profissional recusar, já busca outro para o papel. Com todos confirmados, a equipe é paga. */
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
    if (equipe.status === 'formada') {
      await new PagamentoEquipe(this.adaptadorPagamento).pagar(projeto, equipe);
      this.notificar('equipe_formada', projeto, equipe.membros);
    }
  }

  /** Para mudanças grandes de orçamento ou prazo. O que já foi pago à equipe anterior é estornado. */
  async reavaliar(projeto: Projeto): Promise<Equipe> {
    this.notificar('reavaliacao_solicitada', projeto, projeto.equipe?.membros ?? []);
    if (projeto.equipe) await new PagamentoEquipe(this.adaptadorPagamento).estornar(projeto.equipe);
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
    const escolhida = projeto.estrategia ?? this.estrategiaAtual ?? this.fabricaDe(projeto).criarRecomendador();
    return this.decorar(escolhida, projeto);
  }

  private orquestrador(projeto: Projeto): OrquestradorEquipe {
    return this.criarOrquestrador(this.fabricaDe(projeto), this.adaptadorProfissional);
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
