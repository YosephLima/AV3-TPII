import type { Profissional } from '../dominio/Profissional';
import type { Projeto } from '../dominio/Projeto';
import { CalculadorCompatibilidade } from './CalculadorCompatibilidade';
import { ValidadorConsistencia } from './ValidadorConsistencia';
import type { VisitanteProjeto } from './VisitanteProjeto';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export class GeradorRelatorio implements VisitanteProjeto<string> {
  visitarProjeto(projeto: Projeto): string {
    const linhas = [
      `Projeto: ${projeto.nome} (${projeto.tipoCaptacao}, ${projeto.genero}, ${projeto.duracao} min)`,
      `Orçamento: ${moeda.format(projeto.orcamento)} | Entrega: ${projeto.prazo.toISOString().slice(0, 10)} | Local: ${projeto.restricoes.localizacao}`,
    ];

    const equipe = projeto.equipe;
    if (!equipe) return [...linhas, 'Equipe: ainda não recomendada'].join('\n');

    linhas.push(`Equipe (${equipe.status}):`);
    for (const { papel, peso } of projeto.papeis) {
      const membro = equipe.membro(papel);
      const descricao = membro ? membro.profissional.aceitar(this) : 'sem candidato';
      const confirmado = membro?.confirmado ? ' [confirmado]' : '';
      linhas.push(`  - ${papel} (peso ${peso}): ${descricao}${confirmado}`);
    }

    const validador = new ValidadorConsistencia();
    const consistente = projeto.aceitar(validador);
    const compatibilidade = projeto.aceitar(new CalculadorCompatibilidade());
    linhas.push(`Custo total: ${moeda.format(equipe.custoTotal())}`);
    linhas.push(`Compatibilidade geral: ${(compatibilidade * 100).toFixed(1)}%`);
    linhas.push(consistente ? 'Consistência: ok' : `Consistência: ${validador.erros.join('; ')}`);
    return linhas.join('\n');
  }

  visitarProfissional(profissional: Profissional): string {
    const nota = profissional.avaliacoes.length > 0 ? profissional.notaMedia().toFixed(1) : 'sem avaliações';
    return `${profissional.nome}, ${moeda.format(profissional.precoMedio)}, nota ${nota}, ${profissional.localizacao}`;
  }
}
