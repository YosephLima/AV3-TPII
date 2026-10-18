import type { ProjetoAnimacao } from '../../dominio/ProjetoAnimacao';
import { formatarMoeda, GeradorRelatorio } from '../../visitantes/GeradorRelatorio';

const DIA_EM_MS = 86_400_000;

/** Acrescenta métricas de renderização. */
export class RelatorioAnimacao extends GeradorRelatorio {
  protected override linhasDoTipo(projeto: ProjetoAnimacao): string[] {
    const quadros = projeto.totalDeQuadros;
    const dias = Math.max(1, Math.ceil((projeto.prazo.getTime() - Date.now()) / DIA_EM_MS));
    const linhas = [
      `Técnica: ${projeto.tecnica}, ${projeto.quadrosPorSegundo} fps, ${quadros} quadros`,
      `Ritmo necessário: ${Math.ceil(quadros / dias)} quadros por dia até a entrega`,
      `Orçamento por quadro: ${formatarMoeda(projeto.orcamento / quadros)}`,
    ];
    const equipe = projeto.equipe;
    if (equipe) linhas.push(`Custo da equipe por quadro: ${formatarMoeda(equipe.custoTotal() / quadros)}`);
    return linhas;
  }
}
