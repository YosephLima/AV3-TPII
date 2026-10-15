import 'dotenv/config';
import { criarSistema } from './composicao';
import { construirApp } from './http/app';
import { repositorioDoAmbiente } from './repositorio/doAmbiente';

const { sistema, repositorio } = criarSistema({ repositorio: repositorioDoAmbiente() });
const app = construirApp({ sistema, repositorio }, { logger: true });

const porta = Number(process.env.PORT ?? 3000);
await app.listen({ host: '0.0.0.0', port: porta });
