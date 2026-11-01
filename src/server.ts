import 'dotenv/config';
import { adaptadoresDoAmbiente } from './adaptadores/doAmbiente';
import { criarSistema } from './composicao';
import { pilhaDoTexto } from './decoradores/PoliticaDecoradores';
import { construirApp } from './http/app';
import { repositorioDoAmbiente } from './repositorio/doAmbiente';

const repositorio = repositorioDoAmbiente();
const { sistema } = criarSistema({
  repositorio,
  adaptadores: adaptadoresDoAmbiente(repositorio),
  decoradores: pilhaDoTexto(process.env.DECORADORES ?? 'auditoria,cache,compressao'),
  nivelCompressao: Number(process.env.NIVEL_COMPRESSAO ?? 6),
});
const app = construirApp({ sistema }, { logger: true });

const porta = Number(process.env.PORT ?? 3000);
await app.listen({ host: '0.0.0.0', port: porta });
