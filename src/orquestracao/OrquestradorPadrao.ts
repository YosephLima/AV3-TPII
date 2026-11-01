import type { Recomendacoes } from '../dominio/Equipe';
import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';
import { OrquestradorEquipe, ProjetoInvalidoError } from './OrquestradorEquipe';

export class OrquestradorPadrao extends OrquestradorEquipe {
  static readonly ALTERNATIVAS_POR_PAPEL = 5;

  /** Usa o validador da família e já lança o erro com os motivos. */
  protected validarRestricoes(projeto: Projeto): boolean {
    const validador = this.fabrica.criarValidador();
    if (!projeto.aceitar(validador)) throw new ProjetoInvalidoError(projeto, validador.erros);
    return true;
  }

  /** Fica quem pode começar antes do prazo e cabe sozinho no orçamento. */
  protected normalizarDados(projeto: Projeto, profissionais: Profissional[]): Profissional[] {
    return profissionais.filter((p) => p.podeIniciarAte(projeto.prazo) && p.precoMedio <= projeto.orcamento);
  }

  /** Ninguém pega dois papéis (o de maior custo escolhe primeiro) e cada papel mostra no máximo 5 opções. */
  protected posProcessar(projeto: Projeto, recomendacoes: Recomendacoes): Recomendacoes {
    const porPeso = [...recomendacoes.keys()].sort(
      (a, b) => (projeto.requisito(b)?.custo ?? 0) - (projeto.requisito(a)?.custo ?? 0),
    );
    const escolhidos = new Set<string>();
    const ajustadas: Recomendacoes = new Map();

    for (const papel of porPeso) {
      const ranking = recomendacoes.get(papel) ?? [];
      const livre = ranking.find((p) => !escolhidos.has(p.id));
      const ordenado = livre ? [livre, ...ranking.filter((p) => p !== livre && !escolhidos.has(p.id))] : [];
      if (livre) escolhidos.add(livre.id);
      ajustadas.set(papel, ordenado.slice(0, OrquestradorPadrao.ALTERNATIVAS_POR_PAPEL));
    }

    // Volta para a ordem original dos papéis.
    return new Map([...recomendacoes.keys()].map((papel) => [papel, ajustadas.get(papel) ?? []]));
  }
}
