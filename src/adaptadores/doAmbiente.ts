import { GoogleCloudStorageSimulado } from '../externos/GoogleCloudStorageSimulado';
import { LinkedInSimulado } from '../externos/LinkedInSimulado';
import { PagSeguroSimulado } from '../externos/PagSeguroSimulado';
import { S3Simulado } from '../externos/S3Simulado';
import { StripeSimulado } from '../externos/StripeSimulado';
import type { RepositorioProfissionais } from '../repositorio/RepositorioProfissionais';
import type { Adaptadores } from '../SistemaRecomendacao';
import type { AdaptadorArmazenamento } from './armazenamento/AdaptadorArmazenamento';
import { AdaptadorGoogleCloud } from './armazenamento/AdaptadorGoogleCloud';
import { AdaptadorLocal } from './armazenamento/AdaptadorLocal';
import { AdaptadorS3 } from './armazenamento/AdaptadorS3';
import type { AdaptadorPagamento } from './pagamento/AdaptadorPagamento';
import { AdaptadorPagSeguro } from './pagamento/AdaptadorPagSeguro';
import { AdaptadorStripe } from './pagamento/AdaptadorStripe';
import type { AdaptadorProfissional } from './profissionais/AdaptadorProfissional';
import { AdaptadorInterno } from './profissionais/AdaptadorInterno';
import { AdaptadorLinkedIn } from './profissionais/AdaptadorLinkedIn';

type Ambiente = Record<string, string | undefined>;

export class ConfiguracaoInvalidaError extends Error {
  constructor(variavel: string, valor: string, aceitos: string[]) {
    super(`${variavel}=${valor} não é válido. Use um destes: ${aceitos.join(', ')}`);
    this.name = 'ConfiguracaoInvalidaError';
  }
}

const ARMAZENAMENTO: Record<string, (env: Ambiente) => AdaptadorArmazenamento> = {
  local: (env) => new AdaptadorLocal(env.ARMAZENAMENTO_DIR ?? 'armazenamento'),
  s3: (env) => new AdaptadorS3(new S3Simulado(), env.ARMAZENAMENTO_BUCKET ?? 'cinebridge'),
  gcs: (env) => new AdaptadorGoogleCloud(new GoogleCloudStorageSimulado(), env.ARMAZENAMENTO_BUCKET ?? 'cinebridge'),
};

const PAGAMENTO: Record<string, () => AdaptadorPagamento> = {
  stripe: () => new AdaptadorStripe(new StripeSimulado()),
  pagseguro: () => new AdaptadorPagSeguro(new PagSeguroSimulado()),
};

const PROFISSIONAIS: Record<string, (repositorio: RepositorioProfissionais) => AdaptadorProfissional> = {
  interno: (repositorio) => new AdaptadorInterno(repositorio),
  linkedin: () => new AdaptadorLinkedIn(new LinkedInSimulado()),
};

function escolher<T>(opcoes: Record<string, T>, variavel: string, padrao: string, env: Ambiente): T {
  const valor = env[variavel] ?? padrao;
  const escolhido = opcoes[valor];
  if (!escolhido) throw new ConfiguracaoInvalidaError(variavel, valor, Object.keys(opcoes));
  return escolhido;
}

/** Escolhe cada provedor por uma variável de ambiente. Trocar de provedor não muda nenhuma outra linha. */
export function adaptadoresDoAmbiente(repositorio: RepositorioProfissionais, env: Ambiente = process.env): Adaptadores {
  return {
    armazenamento: escolher(ARMAZENAMENTO, 'ARMAZENAMENTO', 'local', env)(env),
    pagamento: escolher(PAGAMENTO, 'PAGAMENTO', 'stripe', env)(),
    profissional: escolher(PROFISSIONAIS, 'PROFISSIONAIS', 'interno', env)(repositorio),
  };
}
