import { Competencia } from '../dominio/Competencia';
import { Papel } from '../dominio/Papel';
import type { DadosProjeto, RequisitoPapel } from '../dominio/Projeto';
import { ProjetoAnimacao } from '../dominio/ProjetoAnimacao';
import { ProjetoDocumentario } from '../dominio/ProjetoDocumentario';
import { ProjetoFiccao } from '../dominio/ProjetoFiccao';
import { ProjetoPublicitario } from '../dominio/ProjetoPublicitario';
import { RegistroPrototipos } from './RegistroPrototipos';

const DIA_EM_MS = 86_400_000;

const papel = (p: Papel, peso: number, ...competencias: [string, number][]): RequisitoPapel => ({
  papel: p,
  peso,
  competenciasDesejadas: competencias.map(([nome, nivel]) => new Competencia(nome, nivel)),
});

/** Nome e produtor ficam para quem cria o projeto. */
function base(genero: string, duracao: number, orcamento: number, diasAteEntrega: number, papeis: RequisitoPapel[]): DadosProjeto {
  return {
    nome: '',
    produtor: '',
    genero,
    duracao,
    papeis,
    restricoes: {
      orcamento,
      prazo: new Date(Date.now() + diasAteEntrega * DIA_EM_MS),
      localizacao: 'São Paulo',
    },
  };
}

export function modelosDocumentario(): RegistroPrototipos<ProjetoDocumentario> {
  return new RegistroPrototipos<ProjetoDocumentario>()
    .registrar(
      'padrao',
      new ProjetoDocumentario({
        ...base('documentário', 80, 120_000, 180, [
          papel(Papel.DIRETOR, 5, ['documentario', 9], ['narrativa', 8]),
          papel(Papel.DIRETOR_FOTOGRAFIA, 3, ['camera', 8]),
          papel(Papel.SONOPLASTA, 3, ['captacao de som', 9]),
          papel(Papel.EDITOR, 3, ['montagem', 8]),
          papel(Papel.ROTEIRISTA, 4, ['pesquisa', 9], ['roteiro', 7]),
        ]),
        tema: '',
        entrevistados: [],
      }),
    )
    .registrar(
      'entrevistas',
      new ProjetoDocumentario({
        ...base('documentário de entrevistas', 30, 50_000, 90, [
          papel(Papel.DIRETOR, 5, ['documentario', 9]),
          papel(Papel.SONOPLASTA, 4, ['captacao de som', 9]),
          papel(Papel.EDITOR, 3, ['montagem', 8]),
        ]),
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
        ...base('animação 3D', 12, 90_000, 240, [
          papel(Papel.DIRETOR, 3, ['animacao', 9], ['storyboard', 8]),
          papel(Papel.EFEITOS_VISUAIS, 5, ['modelagem 3d', 9], ['blender', 8], ['renderizacao', 8]),
          papel(Papel.EDITOR, 2, ['montagem', 7]),
          papel(Papel.SONOPLASTA, 2, ['mixagem', 7], ['foley', 7]),
        ]),
        tecnica: '3d',
        quadrosPorSegundo: 24,
      }),
    )
    .registrar(
      'curta-2d',
      new ProjetoAnimacao({
        ...base('animação 2D', 5, 40_000, 120, [
          papel(Papel.DIRETOR, 3, ['animacao', 8], ['storyboard', 9]),
          papel(Papel.EFEITOS_VISUAIS, 4, ['composicao', 8], ['after effects', 8]),
          papel(Papel.SONOPLASTA, 2, ['foley', 7]),
        ]),
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
        ...base('comercial de TV', 0.5, 150_000, 45, [
          papel(Papel.DIRETOR, 4, ['direcao de atores', 8], ['narrativa', 7]),
          papel(Papel.DIRETOR_FOTOGRAFIA, 4, ['iluminacao', 9], ['camera', 8], ['color grading', 7]),
          papel(Papel.EDITOR, 3, ['montagem', 8], ['color grading', 7]),
          papel(Papel.SONOPLASTA, 2, ['mixagem', 8]),
        ]),
        cliente: '',
        veiculacao: 'tv',
      }),
    )
    .registrar(
      'digital',
      new ProjetoPublicitario({
        ...base('peça para redes sociais', 0.25, 60_000, 20, [
          papel(Papel.DIRETOR, 3, ['narrativa', 7]),
          papel(Papel.EDITOR, 4, ['montagem', 8], ['after effects', 7]),
          papel(Papel.DIRETOR_FOTOGRAFIA, 2, ['camera', 7]),
        ]),
        cliente: '',
        veiculacao: 'internet',
      }),
    );
}

export function modelosFiccao(): RegistroPrototipos<ProjetoFiccao> {
  return new RegistroPrototipos<ProjetoFiccao>().registrar(
    'padrao',
    new ProjetoFiccao(
      base('longa de ficção', 100, 300_000, 365, [
        papel(Papel.DIRETOR, 5, ['direcao de atores', 9], ['narrativa', 8]),
        papel(Papel.ROTEIRISTA, 4, ['roteiro', 9], ['narrativa', 8]),
        papel(Papel.DIRETOR_FOTOGRAFIA, 4, ['iluminacao', 8], ['camera', 8]),
        papel(Papel.SONOPLASTA, 3, ['captacao de som', 8], ['mixagem', 7]),
        papel(Papel.EDITOR, 3, ['montagem', 8]),
      ]),
    ),
  );
}
