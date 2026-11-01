import { Competencia } from '../dominio/Competencia';
import { Papel } from '../dominio/Papel';
import type { DadosProjeto } from '../dominio/Projeto';
import { ProjetoAnimacao } from '../dominio/ProjetoAnimacao';
import { ProjetoDocumentario } from '../dominio/ProjetoDocumentario';
import { ProjetoFiccao } from '../dominio/ProjetoFiccao';
import { ProjetoPublicitario } from '../dominio/ProjetoPublicitario';
import { PacoteServico } from '../servicos/PacoteServico';
import { ServicoAtomico } from '../servicos/ServicoAtomico';
import type { ServicoProjeto } from '../servicos/ServicoProjeto';
import { RegistroPrototipos } from './RegistroPrototipos';

const DIA_EM_MS = 86_400_000;

type CriarServico = (
  nome: string,
  papel: Papel,
  custo: number,
  diasAntesDaEntrega: number,
  ...competencias: [string, number][]
) => ServicoAtomico;

const pacote = (nome: string, ...servicos: ServicoProjeto[]) => new PacoteServico(nome, servicos);

/** Nome e produtor ficam para quem cria o projeto. Os prazos dos serviços são contados a partir da entrega. */
function base(
  genero: string,
  duracao: number,
  orcamento: number,
  diasAteEntrega: number,
  servicos: (servico: CriarServico) => ServicoProjeto,
): DadosProjeto {
  const entrega = Date.now() + diasAteEntrega * DIA_EM_MS;
  const servico: CriarServico = (nome, papel, custo, diasAntesDaEntrega, ...competencias) =>
    new ServicoAtomico({
      nome,
      custoBase: custo,
      prazoBase: new Date(entrega - diasAntesDaEntrega * DIA_EM_MS),
      papelNecessario: papel,
      competenciasDesejadas: competencias.map(([nomeCompetencia, nivel]) => new Competencia(nomeCompetencia, nivel)),
    });
  return {
    nome: '',
    produtor: '',
    genero,
    duracao,
    servicoPrincipal: servicos(servico),
    restricoes: {
      orcamento,
      prazo: new Date(entrega),
      localizacao: 'São Paulo',
    },
  };
}

export function modelosDocumentario(): RegistroPrototipos<ProjetoDocumentario> {
  return new RegistroPrototipos<ProjetoDocumentario>()
    .registrar(
      'padrao',
      new ProjetoDocumentario({
        ...base('documentário', 80, 120_000, 180, (s) =>
          pacote(
            'Documentário',
            pacote(
              'Pré-produção',
              s('Pesquisa', Papel.ROTEIRISTA, 12_000, 150, ['pesquisa', 9]),
              s('Roteiro', Papel.ROTEIRISTA, 12_000, 120, ['roteiro', 7]),
            ),
            pacote(
              'Captação',
              s('Direção', Papel.DIRETOR, 30_000, 60, ['documentario', 9], ['narrativa', 8]),
              s('Fotografia', Papel.DIRETOR_FOTOGRAFIA, 18_000, 60, ['camera', 8]),
              s('Som direto', Papel.SONOPLASTA, 18_000, 60, ['captacao de som', 9]),
            ),
            pacote('Pós-produção', s('Montagem', Papel.EDITOR, 18_000, 0, ['montagem', 8])),
          ),
        ),
        tema: '',
        entrevistados: [],
      }),
    )
    .registrar(
      'entrevistas',
      new ProjetoDocumentario({
        ...base('documentário de entrevistas', 30, 50_000, 90, (s) =>
          pacote(
            'Documentário de entrevistas',
            pacote(
              'Captação',
              s('Direção', Papel.DIRETOR, 17_500, 30, ['documentario', 9]),
              s('Som direto', Papel.SONOPLASTA, 14_000, 30, ['captacao de som', 9]),
            ),
            pacote('Pós-produção', s('Montagem', Papel.EDITOR, 10_500, 0, ['montagem', 8])),
          ),
        ),
        tema: '',
        entrevistados: [],
      }),
    );
}

export function modelosAnimacao(): RegistroPrototipos<ProjetoAnimacao> {
  return new RegistroPrototipos<ProjetoAnimacao>()
    .registrar(
      'padrao',
      new ProjetoAnimacao({
        ...base('animação 3D', 12, 90_000, 240, (s) =>
          pacote(
            'Animação 3D',
            pacote('Pré-produção', s('Direção e storyboard', Papel.DIRETOR, 18_000, 180, ['animacao', 9], ['storyboard', 8])),
            pacote(
              'Produção',
              s('Modelagem', Papel.EFEITOS_VISUAIS, 18_000, 90, ['modelagem 3d', 9], ['blender', 8]),
              s('Renderização', Papel.EFEITOS_VISUAIS, 12_000, 30, ['renderizacao', 8], ['blender', 8]),
            ),
            pacote(
              'Pós-produção',
              s('Montagem', Papel.EDITOR, 12_000, 0, ['montagem', 7]),
              pacote(
                'Som',
                s('Foley', Papel.SONOPLASTA, 6_000, 10, ['foley', 7]),
                s('Mixagem', Papel.SONOPLASTA, 6_000, 0, ['mixagem', 7]),
              ),
            ),
          ),
        ),
        tecnica: '3d',
        quadrosPorSegundo: 24,
      }),
    )
    .registrar(
      'curta-2d',
      new ProjetoAnimacao({
        ...base('animação 2D', 5, 40_000, 120, (s) =>
          pacote(
            'Curta 2D',
            s('Direção e storyboard', Papel.DIRETOR, 12_000, 90, ['animacao', 8], ['storyboard', 9]),
            s('Animação e composição', Papel.EFEITOS_VISUAIS, 16_000, 20, ['composicao', 8], ['after effects', 8]),
            s('Foley', Papel.SONOPLASTA, 8_000, 0, ['foley', 7]),
          ),
        ),
        tecnica: '2d',
        quadrosPorSegundo: 12,
      }),
    );
}

export function modelosPublicitario(): RegistroPrototipos<ProjetoPublicitario> {
  return new RegistroPrototipos<ProjetoPublicitario>()
    .registrar(
      'padrao',
      new ProjetoPublicitario({
        ...base('comercial de TV', 0.5, 150_000, 45, (s) =>
          pacote(
            'Comercial',
            pacote(
              'Filmagem',
              s('Direção', Papel.DIRETOR, 40_000, 20, ['direcao de atores', 8], ['narrativa', 7]),
              s('Fotografia', Papel.DIRETOR_FOTOGRAFIA, 40_000, 20, ['iluminacao', 9], ['camera', 8], ['color grading', 7]),
            ),
            pacote(
              'Finalização',
              s('Montagem e cor', Papel.EDITOR, 30_000, 0, ['montagem', 8], ['color grading', 7]),
              s('Mixagem', Papel.SONOPLASTA, 20_000, 0, ['mixagem', 8]),
            ),
          ),
        ),
        cliente: '',
        veiculacao: 'tv',
      }),
    )
    .registrar(
      'digital',
      new ProjetoPublicitario({
        ...base('peça para redes sociais', 0.25, 60_000, 20, (s) =>
          pacote(
            'Peça digital',
            pacote(
              'Gravação',
              s('Direção', Papel.DIRETOR, 18_000, 10, ['narrativa', 7]),
              s('Câmera', Papel.DIRETOR_FOTOGRAFIA, 12_000, 10, ['camera', 7]),
            ),
            s('Edição e motion', Papel.EDITOR, 24_000, 0, ['montagem', 8], ['after effects', 7]),
          ),
        ),
        cliente: '',
        veiculacao: 'internet',
      }),
    );
}

export function modelosFiccao(): RegistroPrototipos<ProjetoFiccao> {
  return new RegistroPrototipos<ProjetoFiccao>().registrar(
    'padrao',
    new ProjetoFiccao(
      base('longa de ficção', 100, 300_000, 365, (s) =>
        pacote(
          'Longa-metragem',
          pacote('Desenvolvimento', s('Roteiro', Papel.ROTEIRISTA, 56_000, 270, ['roteiro', 9], ['narrativa', 8])),
          pacote(
            'Produção',
            s('Direção', Papel.DIRETOR, 70_000, 120, ['direcao de atores', 9], ['narrativa', 8]),
            s('Fotografia', Papel.DIRETOR_FOTOGRAFIA, 56_000, 120, ['iluminacao', 8], ['camera', 8]),
            s('Som direto', Papel.SONOPLASTA, 28_000, 120, ['captacao de som', 8]),
          ),
          pacote(
            'Pós-produção',
            s('Montagem', Papel.EDITOR, 42_000, 0, ['montagem', 8]),
            s('Mixagem', Papel.SONOPLASTA, 14_000, 0, ['mixagem', 7]),
          ),
        ),
      ),
    ),
  );
}
