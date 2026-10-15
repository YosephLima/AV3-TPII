import { Avaliacao } from '../dominio/Avaliacao';
import { Competencia } from '../dominio/Competencia';
import { Papel } from '../dominio/Papel';
import { Profissional } from '../dominio/Profissional';

const c = (nome: string, nivel: number) => new Competencia(nome, nivel);
const notas = (...valores: number[]) => valores.map((n, i) => new Avaliacao(n, '', new Date(2025, i, 1)));
const disponivel = (inicio: string, fim = '2027-12-31') => ({ inicio: new Date(inicio), fim: new Date(fim) });

export function profissionaisIniciais(): Profissional[] {
  return [
    new Profissional({
      id: 'p01', nome: 'Ana Ribeiro', especialidades: [Papel.DIRETOR],
      competencias: [c('direcao de atores', 9), c('narrativa', 8), c('documentario', 6)],
      avaliacoes: notas(5, 5, 4, 5), precoMedio: 18000, disponibilidade: disponivel('2026-09-01'), localizacao: 'São Paulo',
    }),
    new Profissional({
      id: 'p02', nome: 'Bruno Tavares', especialidades: [Papel.DIRETOR, Papel.ROTEIRISTA],
      competencias: [c('direcao de atores', 6), c('narrativa', 9), c('roteiro', 8), c('documentario', 9)],
      avaliacoes: notas(4, 4, 5), precoMedio: 12000, disponibilidade: disponivel('2026-10-01'), localizacao: 'Rio de Janeiro',
    }),
    new Profissional({
      id: 'p03', nome: 'Carla Mendes', especialidades: [Papel.DIRETOR],
      competencias: [c('animacao', 9), c('narrativa', 7), c('storyboard', 9)],
      avaliacoes: notas(5, 4), precoMedio: 15000, disponibilidade: disponivel('2026-08-01'), localizacao: 'São Paulo',
    }),
    new Profissional({
      id: 'p04', nome: 'Diego Alves', especialidades: [Papel.DIRETOR_FOTOGRAFIA],
      competencias: [c('iluminacao', 9), c('camera', 9), c('color grading', 7)],
      avaliacoes: notas(5, 5, 5, 4), precoMedio: 14000, disponibilidade: disponivel('2026-09-15'), localizacao: 'São Paulo',
    }),
    new Profissional({
      id: 'p05', nome: 'Elisa Prado', especialidades: [Papel.DIRETOR_FOTOGRAFIA],
      competencias: [c('camera', 7), c('iluminacao', 6), c('drone', 9)],
      avaliacoes: notas(4, 3), precoMedio: 6000, disponibilidade: disponivel('2026-07-01'), localizacao: 'Belo Horizonte',
    }),
    new Profissional({
      id: 'p06', nome: 'Fábio Nunes', especialidades: [Papel.DIRETOR_FOTOGRAFIA],
      competencias: [c('iluminacao', 8), c('camera', 8)],
      precoMedio: 9000, disponibilidade: disponivel('2027-06-01'), localizacao: 'São Paulo',
    }),
    new Profissional({
      id: 'p07', nome: 'Gabriela Souza', especialidades: [Papel.SONOPLASTA],
      competencias: [c('captacao de som', 9), c('mixagem', 8), c('foley', 7)],
      avaliacoes: notas(5, 4, 5), precoMedio: 8000, disponibilidade: disponivel('2026-09-01'), localizacao: 'São Paulo',
    }),
    new Profissional({
      id: 'p08', nome: 'Heitor Lima', especialidades: [Papel.SONOPLASTA],
      competencias: [c('captacao de som', 6), c('mixagem', 7)],
      avaliacoes: notas(4, 4), precoMedio: 3500, disponibilidade: disponivel('2026-06-01'), localizacao: 'Campinas',
    }),
    new Profissional({
      id: 'p09', nome: 'Isabela Rocha', especialidades: [Papel.EDITOR],
      competencias: [c('montagem', 9), c('davinci resolve', 8), c('color grading', 8)],
      avaliacoes: notas(5, 5), precoMedio: 10000, disponibilidade: disponivel('2026-10-01'), localizacao: 'São Paulo',
    }),
    new Profissional({
      id: 'p10', nome: 'João Pedro Costa', especialidades: [Papel.EDITOR],
      competencias: [c('montagem', 7), c('premiere', 8)],
      avaliacoes: notas(4, 3, 4), precoMedio: 4000, disponibilidade: disponivel('2026-05-01'), localizacao: 'Curitiba',
    }),
    new Profissional({
      id: 'p11', nome: 'Karina Duarte', especialidades: [Papel.EDITOR, Papel.EFEITOS_VISUAIS],
      competencias: [c('montagem', 6), c('after effects', 9), c('composicao', 8)],
      avaliacoes: notas(4, 5), precoMedio: 9500, disponibilidade: disponivel('2026-09-01'), localizacao: 'São Paulo',
    }),
    new Profissional({
      id: 'p12', nome: 'Lucas Martins', especialidades: [Papel.ROTEIRISTA],
      competencias: [c('roteiro', 9), c('pesquisa', 7), c('narrativa', 8)],
      avaliacoes: notas(5, 4, 5), precoMedio: 11000, disponibilidade: disponivel('2026-08-01'), localizacao: 'São Paulo',
    }),
    new Profissional({
      id: 'p13', nome: 'Marina Teixeira', especialidades: [Papel.ROTEIRISTA],
      competencias: [c('roteiro', 7), c('pesquisa', 9), c('documentario', 8)],
      avaliacoes: notas(4), precoMedio: 5000, disponibilidade: disponivel('2026-07-01'), localizacao: 'Recife',
    }),
    new Profissional({
      id: 'p14', nome: 'Nicolas Ferreira', especialidades: [Papel.EFEITOS_VISUAIS],
      competencias: [c('blender', 9), c('modelagem 3d', 9), c('renderizacao', 8)],
      avaliacoes: notas(5, 5, 4), precoMedio: 16000, disponibilidade: disponivel('2026-09-01'), localizacao: 'São Paulo',
    }),
    new Profissional({
      id: 'p15', nome: 'Olívia Campos', especialidades: [Papel.EFEITOS_VISUAIS],
      competencias: [c('maya', 8), c('modelagem 3d', 8), c('animacao', 7)],
      avaliacoes: notas(4, 4), precoMedio: 12000, disponibilidade: disponivel('2026-10-01'), localizacao: 'Florianópolis',
    }),
    new Profissional({
      id: 'p16', nome: 'Paulo Henrique', especialidades: [Papel.EFEITOS_VISUAIS],
      competencias: [c('composicao', 7), c('after effects', 7)],
      avaliacoes: notas(3, 4), precoMedio: 4500, disponibilidade: disponivel('2026-06-01'), localizacao: 'Porto Alegre',
    }),
  ];
}
