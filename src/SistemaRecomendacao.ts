import type { Equipe, MembroEquipe } from './dominio/Equipe';
import type { Papel } from './dominio/Papel';
import type { Projeto } from './dominio/Projeto';
import { FiltragemColaborativa } from './estrategias/FiltragemColaborativa';
import type { RecomendacaoStrategy } from './estrategias/RecomendacaoStrategy';
import { RegrasOrcamento } from './estrategias/RegrasOrcamento';
import { SimilaridadeCosseno } from './estrategias/SimilaridadeCosseno';
import { BarramentoEmMemoria, type BarramentoEventos } from './observadores/BarramentoEventos';
import { EventoRecomendacao, type TipoEvento } from './observadores/EventoRecomendacao';
import type { Observador } from './observadores/Observador';
import type { OrquestradorEquipe } from './orquestracao/OrquestradorEquipe';

export class SemCandidatoError extends Error {
  constructor(papel: Papel) {
    super(`Não há outro profissional disponível para ${papel}`);
    this.name = 'SemCandidatoError';
  }
}

/** Ponto de entrada: escolhe a estratégia, deixa o orquestrador montar a equipe e avisa os observadores. */
export class SistemaRecomendacao {
  static readonly LIMITE_ORCAMENTO_REDUZIDO = 50_000;
  private static readonly ORIGEM = 'sistema-recomendacao';

  private readonly observadores: Observador[] = [];
  private estrategiaAtual: RecomendacaoStrategy | undefined;

  constructor(
    private readonly orquestrador: OrquestradorEquipe,
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

  async executarRecomendacao(projeto: Projeto): Promise<Equipe> {
    const equipe = await this.orquestrador.orquestrar(projeto, this.estrategiaPara(projeto));
    projeto.definirEquipe(equipe);
    this.notificar('recomendacao_gerada', projeto, equipe.membros);
    return equipe;
  }

  /** Refaz só o papel rejeitado; o resto da equipe fica igual. */
  async substituirMembro(projeto: Projeto, papel: Papel): Promise<MembroEquipe> {
    const equipe = this.equipeDe(projeto);
    const excluir = [...equipe.membros.map((m) => m.profissional.id), ...equipe.substituidos];
    const rodada = await this.orquestrador.orquestrar(projeto, this.estrategiaPara(projeto), {
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

  estrategiaPara(projeto: Projeto): RecomendacaoStrategy {
    if (projeto.estrategia) return projeto.estrategia;
    if (this.estrategiaAtual) return this.estrategiaAtual;
    if (projeto.orcamento < SistemaRecomendacao.LIMITE_ORCAMENTO_REDUZIDO) return new RegrasOrcamento();

    switch (projeto.tipoCaptacao) {
      case 'documentario':
        return new FiltragemColaborativa();
      case 'ficcao':
      case 'animacao':
        return new SimilaridadeCosseno();
    }
  }

  private equipeDe(projeto: Projeto): Equipe {
    if (!projeto.equipe) throw new Error(`O projeto ${projeto.nome} ainda não tem equipe recomendada`);
    return projeto.equipe;
  }

  private notificar(tipo: TipoEvento, projeto: Projeto, membros: MembroEquipe[]): void {
    const envolvidos = membros.map((m) => ({
      profissionalId: m.profissional.id,
      nome: m.profissional.nome,
      papel: m.papel,
    }));
    const dados = { projetoId: projeto.id, projetoNome: projeto.nome, produtor: projeto.produtor, envolvidos };
    this.notificarObservadores(new EventoRecomendacao(tipo, dados, SistemaRecomendacao.ORIGEM));
  }
}
