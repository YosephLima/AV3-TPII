import type { AdaptadorArmazenamento } from '../adaptadores/armazenamento/AdaptadorArmazenamento';
import type { Equipe } from '../dominio/Equipe';
import type { Projeto } from '../dominio/Projeto';

export interface RecomendacaoArquivada {
  projetoId: string;
  nome: string;
  tipo: string;
  produtor: string;
  custoEstimado: number;
  data: string;
  equipe: { papel: string; profissionalId: string; nome: string; precoMedio: number }[];
}

/** Guarda o resultado de cada recomendação no armazenamento configurado, para consulta posterior. */
export class ArquivoRecomendacoes {
  static readonly PASTA = 'recomendacoes/';

  constructor(private readonly armazenamento: AdaptadorArmazenamento) {}

  async guardar(projeto: Projeto, equipe: Equipe): Promise<string> {
    const registro: RecomendacaoArquivada = {
      projetoId: projeto.id,
      nome: projeto.nome,
      tipo: projeto.tipo,
      produtor: projeto.produtor,
      custoEstimado: projeto.calcularCustoTotal(),
      data: equipe.dataFormacao.toISOString(),
      equipe: equipe.membros.map((m) => ({
        papel: m.papel,
        profissionalId: m.profissional.id,
        nome: m.profissional.nome,
        precoMedio: m.profissional.precoMedio,
      })),
    };
    return this.armazenamento.salvarArquivo(Buffer.from(JSON.stringify(registro)), {
      caminho: `${ArquivoRecomendacoes.PASTA}${projeto.id}.json`,
      tipoConteudo: 'application/json',
      extras: { tipo: projeto.tipo },
    });
  }

  async consultar(projetoId: string): Promise<RecomendacaoArquivada> {
    const conteudo = await this.armazenamento.recuperarArquivo(`${ArquivoRecomendacoes.PASTA}${projetoId}.json`);
    return JSON.parse(conteudo.toString('utf8')) as RecomendacaoArquivada;
  }
}
