import { Avaliacao } from '../../dominio/Avaliacao';
import { Competencia } from '../../dominio/Competencia';
import { Papel } from '../../dominio/Papel';
import { Profissional } from '../../dominio/Profissional';
import { PerfilNaoEncontrado, type LinkedInSimulado, type PerfilLinkedIn } from '../../externos/LinkedInSimulado';
import {
  atendeCriterios,
  ProfissionalNaoEncontradoError,
  type AdaptadorProfissional,
  type CriteriosBusca,
} from './AdaptadorProfissional';

/** Cargo no LinkedIn para cada papel da plataforma. */
const CARGOS: Record<Papel, string> = {
  [Papel.DIRETOR]: 'Film Director',
  [Papel.DIRETOR_FOTOGRAFIA]: 'Director of Photography',
  [Papel.SONOPLASTA]: 'Sound Designer',
  [Papel.EDITOR]: 'Film Editor',
  [Papel.ROTEIRISTA]: 'Screenwriter',
  [Papel.EFEITOS_VISUAIS]: 'VFX Artist',
};

/** Habilidades em inglês para o nome de competência usado no cadastro interno. */
const COMPETENCIAS: Record<string, string> = {
  'directing actors': 'direcao de atores',
  storytelling: 'narrativa',
  documentary: 'documentario',
  lighting: 'iluminacao',
  'camera operation': 'camera',
  'film editing': 'montagem',
  'sound mixing': 'mixagem',
  'production sound': 'captacao de som',
  '3d modeling': 'modelagem 3d',
  rendering: 'renderizacao',
  screenwriting: 'roteiro',
  research: 'pesquisa',
  animation: 'animacao',
  storyboarding: 'storyboard',
  compositing: 'composicao',
};

/** 100 recomendações de colegas equivalem ao nível máximo (10). */
const ENDOSSOS_POR_NIVEL = 10;
const DISPONIBILIDADE_EM_ANOS = 2;
const POR_PAGINA = 50;

export class AdaptadorLinkedIn implements AdaptadorProfissional {
  readonly provedor = 'linkedin';

  constructor(private readonly linkedin: LinkedInSimulado) {}

  /** A API filtra por cargo e cidade e devolve em páginas; o adaptador junta tudo. */
  async listarProfissionais(criterios: CriteriosBusca = {}): Promise<Profissional[]> {
    const titles = criterios.papeis?.map((papel) => CARGOS[papel]);
    const perfis: PerfilLinkedIn[] = [];
    let total = Infinity;
    while (perfis.length < total) {
      const pagina = await this.linkedin.searchPeople({
        titles,
        city: criterios.localizacao,
        start: perfis.length,
        count: POR_PAGINA,
      });
      perfis.push(...pagina.elements);
      total = pagina.elements.length === 0 ? perfis.length : pagina.paging.total;
    }
    return perfis.map(paraProfissional).filter((p) => atendeCriterios(p, criterios));
  }

  async detalharProfissional(id: string): Promise<Profissional> {
    try {
      return paraProfissional(await this.linkedin.getProfile(id));
    } catch (erro) {
      if (erro instanceof PerfilNaoEncontrado) throw new ProfissionalNaoEncontradoError(id);
      throw erro;
    }
  }

  /** Nossa nota vai de 0 a 5; a do LinkedIn, de 1 a 10. */
  async registrarAvaliacao(id: string, avaliacao: Avaliacao): Promise<void> {
    const rating = Math.min(10, Math.max(1, Math.round(avaliacao.nota * 2)));
    try {
      await this.linkedin.addRecommendation(id, { rating, text: avaliacao.comentario });
    } catch (erro) {
      if (erro instanceof PerfilNaoEncontrado) throw new ProfissionalNaoEncontradoError(id);
      throw erro;
    }
  }
}

function paraProfissional(perfil: PerfilLinkedIn): Profissional {
  const cargos = perfil.headline.split(' | ');
  const inicio = new Date(perfil.openToWork.startDate);
  const fim = new Date(inicio);
  fim.setFullYear(fim.getFullYear() + DISPONIBILIDADE_EM_ANOS);

  return new Profissional({
    id: perfil.urn,
    nome: `${perfil.firstName} ${perfil.lastName}`.trim(),
    especialidades: Object.values(Papel).filter((papel) => cargos.includes(CARGOS[papel])),
    competencias: perfil.skills.map((s) => {
      const nome = s.name.toLowerCase();
      return new Competencia(COMPETENCIAS[nome] ?? nome, Math.min(10, Math.round(s.endorsements / ENDOSSOS_POR_NIVEL)));
    }),
    avaliacoes: perfil.recommendations.map((r) => new Avaliacao(r.rating / 2, r.text, new Date(r.createdAt))),
    precoMedio: perfil.dailyRate.amountCents / 100,
    disponibilidade: { inicio, fim },
    localizacao: perfil.location.city,
  });
}
