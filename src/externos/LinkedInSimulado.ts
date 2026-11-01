/**
 * Imita uma API de rede social profissional no estilo do LinkedIn: perfis identificados por URN, nomes e
 * habilidades em inglês, nível medido em recomendações de colegas (endorsements), nota de 1 a 10, valor da
 * diária em centavos e busca paginada (start/count).
 */
export interface PerfilLinkedIn {
  urn: string;
  firstName: string;
  lastName: string;
  /** Cargos separados por " | ", como "Film Director | Screenwriter". */
  headline: string;
  skills: { name: string; endorsements: number }[];
  location: { city: string; country: string };
  dailyRate: { amountCents: number; currency: 'BRL' };
  openToWork: { startDate: string };
  recommendations: { rating: number; text: string; createdAt: string }[];
}

export class PerfilNaoEncontrado extends Error {
  readonly status = 404;
}

const perfil = (
  id: string,
  nome: string,
  headline: string,
  cidade: string,
  diaria: number,
  inicio: string,
  skills: [string, number][],
  notas: number[],
): PerfilLinkedIn => {
  const [firstName = '', ...resto] = nome.split(' ');
  return {
    urn: `urn:li:person:${id}`,
    firstName,
    lastName: resto.join(' '),
    headline,
    skills: skills.map(([name, endorsements]) => ({ name, endorsements })),
    location: { city: cidade, country: 'BR' },
    dailyRate: { amountCents: diaria * 100, currency: 'BRL' },
    openToWork: { startDate: inicio },
    recommendations: notas.map((rating, i) => ({ rating, text: '', createdAt: `2025-0${i + 1}-15T12:00:00Z` })),
  };
};

export function perfisIniciais(): PerfilLinkedIn[] {
  return [
    perfil('rf01', 'Renata Freitas', 'Director of Photography', 'São Paulo', 13_000, '2026-09-01', [['Lighting', 95], ['Camera Operation', 88], ['Drone', 40]], [9, 10, 8]),
    perfil('tm02', 'Tiago Moura', 'Film Editor', 'Porto Alegre', 7_000, '2026-08-15', [['Film Editing', 92], ['DaVinci Resolve', 85], ['Color Grading', 70]], [8, 9]),
    perfil('sa03', 'Sofia Antunes', 'Sound Designer', 'Recife', 6_000, '2026-07-01', [['Sound Mixing', 90], ['Foley', 85], ['Production Sound', 60]], [10, 9, 9]),
    perfil('cb04', 'Caio Brandão', 'Film Director | Screenwriter', 'Salvador', 16_000, '2026-10-01', [['Storytelling', 90], ['Documentary', 85], ['Directing Actors', 80], ['Screenwriting', 70]], [9, 8]),
    perfil('lc05', 'Lívia Cardoso', 'VFX Artist', 'Curitiba', 14_000, '2026-09-10', [['Blender', 95], ['3D Modeling', 90], ['Rendering', 85]], [10, 9]),
    perfil('ro06', 'Rafael Okada', 'Screenwriter', 'São Paulo', 9_000, '2026-08-01', [['Screenwriting', 90], ['Research', 80], ['Storytelling', 85]], []),
  ];
}

export class LinkedInSimulado {
  constructor(private readonly perfis: PerfilLinkedIn[] = perfisIniciais()) {}

  async searchPeople(params: { titles?: string[]; city?: string; start?: number; count?: number }): Promise<{
    elements: PerfilLinkedIn[];
    paging: { start: number; count: number; total: number };
  }> {
    const encontrados = this.perfis.filter(
      (p) =>
        (!params.titles || params.titles.some((t) => p.headline.split(' | ').includes(t))) &&
        (!params.city || p.location.city === params.city),
    );
    const start = params.start ?? 0;
    const count = params.count ?? 10;
    return {
      elements: encontrados.slice(start, start + count).map((p) => structuredClone(p)),
      paging: { start, count, total: encontrados.length },
    };
  }

  async getProfile(urn: string): Promise<PerfilLinkedIn> {
    const encontrado = this.perfis.find((p) => p.urn === urn);
    if (!encontrado) throw new PerfilNaoEncontrado(`Member ${urn} not found`);
    return structuredClone(encontrado);
  }

  async addRecommendation(urn: string, recomendacao: { rating: number; text: string }): Promise<void> {
    const encontrado = this.perfis.find((p) => p.urn === urn);
    if (!encontrado) throw new PerfilNaoEncontrado(`Member ${urn} not found`);
    if (!Number.isInteger(recomendacao.rating) || recomendacao.rating < 1 || recomendacao.rating > 10) {
      throw new RangeError('rating must be an integer between 1 and 10');
    }
    encontrado.recommendations.push({ ...recomendacao, createdAt: new Date().toISOString() });
  }
}
