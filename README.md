# cinebridge: microsserviço de recomendação (AV1)

Recebe um projeto audiovisual, ranqueia os profissionais cadastrados para cada papel técnico e devolve a equipe recomendada, notificando os envolvidos e registrando auditoria.

Padrões aplicados:

| Padrão | Onde |
|---|---|
| Strategy | `src/estrategias/`: `SimilaridadeCosseno`, `FiltragemColaborativa`, `RegrasOrcamento` |
| Template Method | `src/orquestracao/`: `OrquestradorEquipe.orquestrar` fixa o fluxo; `OrquestradorPadrao` implementa as etapas |
| Observer | `src/observadores/`: `NotificadorEmail`, `NotificadorInterno`, `AuditoriaRecomendacao`, sobre um barramento com `EventEmitter` |
| Visitor | `src/visitantes/`: `ValidadorConsistencia`, `CalculadorCompatibilidade`, `GeradorRelatorio` |

`SistemaRecomendacao` é o ponto de entrada e `src/composicao.ts` monta as dependências.

## Persistência

O cadastro de profissionais fica no PostgreSQL, acessado com Prisma (`prisma/schema.prisma`), atrás da interface `RepositorioProfissionais`. Se o banco cair, a API continua respondendo com o cadastro em memória (`RepositorioComReserva`). Sem `DATABASE_URL`, usa só a memória, o que permite rodar os testes sem banco.

## Como executar

### Com Docker (Windows 10+ ou Ubuntu 24.04+)

```bash
docker compose up --build          # PostgreSQL + API em http://localhost:3000 (aplica migrations e seed)
docker compose run --rm api npm test
```

### Sem Docker (Node.js 24+)

```bash
npm install
npm start          # API em http://localhost:3000, com o cadastro em memória
npm test           # testes
npm run test:coverage
```

Para usar o banco fora do Docker, suba só o PostgreSQL e copie `.env.example` para `.env`:

```bash
docker compose up -d postgres
npm run db:preparar   # migrations e seed
npm start
```

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/saude` | Verificação de funcionamento |
| GET | `/profissionais` | Cadastro de profissionais |
| POST | `/recomendacoes` | Recebe um projeto e devolve a equipe recomendada |

O campo opcional `estrategia` (`cosseno`, `colaborativa` ou `orcamento`) fixa o algoritmo. Sem ele, o sistema escolhe pelo tipo de captação e pelo orçamento.

### Com curl

No Linux, ou com `curl.exe` no PowerShell:

```bash
curl -X POST http://localhost:3000/recomendacoes -H "content-type: application/json" -d @exemplos/documentario.json
```

### Com Postman, Insomnia ou Thunder Client

O arquivo `exemplos/cinebridge.postman_collection.json` traz todas as requisições prontas, inclusive um exemplo de erro. A URL base fica na variável `baseUrl` (`http://localhost:3000`).

| Ferramenta | Como importar |
|---|---|
| Postman | botão **Import** e escolher o arquivo |
| Insomnia | **Import** na tela do projeto, opção de arquivo, e escolher o arquivo |
| Thunder Client (VS Code) | aba **Collections**, menu da aba, **Import** e escolher o arquivo |

Para montar a requisição à mão: método `POST`, URL `http://localhost:3000/recomendacoes`, cabeçalho `Content-Type: application/json` e, no corpo (raw, JSON), o conteúdo de `exemplos/documentario.json`.
