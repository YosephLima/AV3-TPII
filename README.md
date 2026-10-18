# cinebridge: microsserviço de recomendação (AV2)

Recebe um projeto audiovisual, ranqueia os profissionais cadastrados para cada papel técnico e devolve a equipe recomendada, notificando os envolvidos e registrando auditoria.

Nesta etapa, o código da AV1 foi analisado e refatorado com três padrões criacionais (**Prototype**, **Factory Method** e **Abstract Factory**). Cada tipo de projeto (documentário, animação, publicitário e ficção) passou a ter sua própria família de objetos.

## Padrões aplicados

| Padrão | Etapa | Onde |
|---|---|---|
| Strategy | AV1 | `src/estrategias/`: `SimilaridadeCosseno`, `FiltragemColaborativa`, `RegrasOrcamento`, mais os recomendadores de cada família |
| Template Method | AV1 | `src/orquestracao/`: `OrquestradorEquipe.orquestrar` fixa o fluxo; `OrquestradorPadrao` implementa as etapas |
| Observer | AV1 | `src/observadores/`: barramento com `EventEmitter`, notificadores, auditoria |
| Visitor | AV1 | `src/visitantes/`: validação, compatibilidade e relatório |
| **Prototype** | AV2 | `Projeto.clonar()` e subclasses em `src/dominio/`; modelos pré-configurados em `src/prototipos/` |
| **Factory Method** | AV2 | Métodos `criar*` de `FabricaProjetoBase` (`src/fabricas/FabricaProjeto.ts`), sobrescritos por cada família |
| **Abstract Factory** | AV2 | Interface `FabricaProjeto` e as fábricas em `src/fabricas/<tipo>/` |

O diagrama de classes refinado está em [`diagramas/diagrama-av2.puml`](diagramas/diagrama-av2.puml).

O cadastro de profissionais fica no PostgreSQL, acessado com Prisma, atrás da interface `RepositorioProfissionais`. Se o banco cair, a API continua respondendo com o cadastro em memória (`RepositorioComReserva`). Sem `DATABASE_URL`, usa só a memória, o que permite rodar os testes sem banco.

## Análise crítica do código da AV1

O primeiro commit deste repositório é o código da AV1, sem alterações. Nele foram identificados os seguintes problemas:

| Sintoma | Onde estava | Como foi resolvido |
|---|---|---|
| **Rigidez:** a estratégia era escolhida por um `switch` sobre o tipo de captação | `SistemaRecomendacao.estrategiaPara` | Cada fábrica fornece o recomendador da sua família (`criarRecomendador`) |
| **Rigidez e fragilidade:** uma regra exclusiva de animação ficava dentro do orquestrador genérico | `if (tipoCaptacao === 'animacao')` em `OrquestradorPadrao.validarRestricoes` | A regra foi para `ValidadorAnimacao`; o orquestrador aplica o validador que a fábrica entrega |
| **Rigidez:** o conjunto de tipos estava repetido em três lugares (união `TipoCaptacao`, `enum` do esquema JSON e o `switch`) | `Projeto.ts`, `http/app.ts`, `SistemaRecomendacao.ts` | Os tipos aceitos vêm do `RegistroFabricas`. Na AV1, incluir "publicitário" exigiria editar os três lugares |
| **Imobilidade:** um único `Projeto` para todos os tipos, sem lugar para atributos específicos (tema, técnica, cliente...) | `src/dominio/Projeto.ts` | Hierarquia `ProjetoDocumentario`, `ProjetoAnimacao`, `ProjetoPublicitario`, `ProjetoFiccao` |
| **Criação repetitiva e propensa a erros:** a rota e os testes montavam o projeto inteiro à mão | `http/app.ts`, fixtures de teste | Modelos pré-configurados (`RegistroPrototipos`) clonados por `criarProjeto`; a requisição só precisa de tipo, nome e produtor |
| **Componentes únicos para tipos diferentes:** um validador, um formato de convite e um relatório para todos | `ValidadorConsistencia`, `NotificadorEmail`, `GeradorRelatorio` | Viraram bases genéricas que cada família especializa |
| **Duplicação:** os nomes das estratégias estavam repetidos num mapa da rota | `ESTRATEGIAS` em `http/app.ts` | O mapa é montado a partir do `nome` que cada estratégia declara |

O teste `tests/integracao.test.ts` contém uma guarda: o orquestrador, o `SistemaRecomendacao` e a rota HTTP não podem mencionar nenhum tipo de projeto.

## Como as peças se encaixam

```
POST /recomendacoes { tipo, modelo?, nome, produtor, detalhes?, ... }
  └─ SistemaRecomendacao.recomendar
       ├─ RegistroFabricas.para(tipo)        → fábrica da família (Abstract Factory)
       ├─ fabrica.criarProjeto(dados)        → clona o modelo e aplica os ajustes (Prototype + Factory Method)
       ├─ new OrquestradorPadrao(fabrica)    → Template Method
       │    ├─ validarRestricoes             → fabrica.criarValidador()   (Visitor da família)
       │    └─ recomendar                    → fabrica.criarRecomendador() (Strategy da família)
       ├─ notificar                          → observadores gerais + fabrica.criarNotificador() (Observer da família)
       └─ avaliar                            → validador e fabrica.criarRelatorio() (Visitor da família)
```

| Família | Atributos do projeto | Validador exige | Recomendador prioriza | Convite informa | Relatório |
|---|---|---|---|---|---|
| Documentário | tema, entrevistados | tema e ao menos um entrevistado | experiência em documentário | tema e nº de entrevistados | genérico |
| Animação | técnica, quadros por segundo | efeitos visuais; 12 a 60 fps; em 3D, VFX com software de modelagem | software de modelagem 3D | técnica, fps e total de quadros | métricas de renderização |
| Publicitário | cliente, veiculação | cliente, veiculação, até 3 minutos | reputação (avaliações) | cliente, veiculação e entrega | genérico |
| Ficção | nenhum | só as regras gerais | aderência técnica (cosseno) | convite genérico | genérico |

Os recomendadores das famílias respeitam a fatia do orçamento de cada papel (proporcional ao peso).

### Adicionando um tipo de projeto

1. Criar a subclasse de `Projeto` com seus atributos e o `clonar()`.
2. Criar a fábrica estendendo `FabricaProjetoBase`, com seus modelos, e sobrescrever só os `criar*` que precisam de um objeto próprio.
3. Registrar a fábrica em `fabricasPadrao` (`src/composicao.ts`).

Nada no orquestrador, no `SistemaRecomendacao` ou na rota muda. O arquivo `tests/realidadeVirtual.ts` faz exatamente isso para um tipo de realidade virtual, e `tests/integracao.test.ts` roda o fluxo completo com ele, inclusive pela API.

## Decisões em relação ao diagrama

O diagrama do enunciado foi usado como guia. Onde ele e o texto divergem, ou onde faltava informação, seguimos o texto:

- **`FabricaProjeto` é uma interface,** como diz o texto (o diagrama a desenha como classe). A implementação comum fica em `FabricaProjetoBase`, cujos métodos `criar*` são os Factory Methods.
- **`criarRelatorio()` foi incluído na família.** O texto cita o "gerador de relatório com métricas de eficiência de renderização" da animação, que o diagrama não mostra.
- **`orquestrar(projeto, estrategia?)`:** o diagrama mantém a estratégia como parâmetro, e o texto diz que a fábrica fornece o recomendador. A estratégia ficou opcional: por padrão vem da fábrica, mas o produtor ainda pode escolher outra.
- **O projeto não guarda referência à fábrica.** O `SistemaRecomendacao` obtém a fábrica pelo tipo do projeto no `RegistroFabricas`. Assim o domínio não depende das fábricas, e não há dependência circular entre `Projeto` e `FabricaProjeto`.
- **`clonar(ajustes?)`:** aceita ajustes finos, como o texto pede ("com possibilidade de ajustes finos"). O clone ganha outro id e não herda a equipe.
- **Ficção foi mantida como quarta família,** para não perder o tipo que a AV1 já aceitava. Ela usa só os componentes genéricos.
- **Tipos `any` foram substituídos** por tipos explícitos (`DadosCriacao`, `VisitanteProjeto<R>`, `ValidadorProjeto`).

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
npm test
npm run test:coverage
```

Para usar o banco fora do Docker, suba só o PostgreSQL e copie `.env.example` para `.env`:

```bash
docker compose up -d postgres
npm run db:preparar   # migrations e seed
npm start
```

### Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | nenhum | Conexão com o PostgreSQL. Sem ela, o cadastro fica só em memória. O `docker-compose.yml` já define a dele, e o `.env.example` traz a de uso local |
| `PORT` | `3000` | Porta HTTP da API |

### Compatibilidade

- **Com Docker,** a API e o banco rodam no mesmo ambiente Linux em qualquer sistema. No Windows 10+, basta o Docker Desktop.
- **Sem Docker,** o projeto só depende do Node.js 24+. Os scripts do `package.json` não usam sintaxe exclusiva de um shell, e o `.gitattributes` fixa o fim de linha em LF.
- Testado no Ubuntu, tanto direto no sistema quanto pelo Docker. No Windows não foi testado.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/saude` | Verificação de funcionamento |
| GET | `/profissionais` | Cadastro de profissionais |
| GET | `/modelos` | Tipos de projeto e modelos disponíveis em cada um |
| POST | `/recomendacoes` | Cria o projeto pela fábrica do tipo e devolve equipe, validação e relatório |

Só `tipo`, `nome` e `produtor` são obrigatórios; o resto vem do modelo (`modelo`, padrão `padrao`) e pode ser ajustado. Os atributos específicos do tipo vão em `detalhes`. O campo opcional `estrategia` (`cosseno`, `colaborativa` ou `orcamento`) substitui o recomendador da família.

### Com curl

No Linux, ou com `curl.exe` no PowerShell:

```bash
curl -X POST http://localhost:3000/recomendacoes -H "content-type: application/json" -d @exemplos/documentario.json
curl -X POST http://localhost:3000/recomendacoes -H "content-type: application/json" -d @exemplos/animacao.json
curl -X POST http://localhost:3000/recomendacoes -H "content-type: application/json" -d @exemplos/publicitario-modelo.json
```

### Com Postman, Insomnia ou Thunder Client

O arquivo `exemplos/cinebridge.postman_collection.json` traz todas as requisições prontas, inclusive um exemplo de erro. A URL base fica na variável `baseUrl` (`http://localhost:3000`).

| Ferramenta | Como importar |
|---|---|
| Postman | botão **Import** e escolher o arquivo |
| Insomnia | **Import** na tela do projeto, opção de arquivo, e escolher o arquivo |
| Thunder Client (VS Code) | aba **Collections**, menu da aba, **Import** e escolher o arquivo |

Para montar a requisição à mão: método `POST`, URL `http://localhost:3000/recomendacoes`, cabeçalho `Content-Type: application/json` e, no corpo (raw, JSON), o conteúdo de um dos arquivos de `exemplos/`.

Um projeto que não atende às regras da sua família recebe `422` com a lista de `motivos`.

## Estrutura

```
src/
  dominio/        entidades; Projeto e suas subclasses (Prototype)
  prototipos/     RegistroPrototipos e os modelos de cada tipo
  fabricas/       FabricaProjeto, RegistroFabricas e uma pasta por família
  estrategias/    Strategy (genéricas e a base dos recomendadores das famílias)
  orquestracao/   Template Method
  observadores/   Observer
  visitantes/     Visitor
  repositorio/    cadastro de profissionais (PostgreSQL com reserva em memória)
  http/           API Fastify
  composicao.ts   raiz de composição (injeção de dependências)
prisma/           schema, migrations e seed
generated/        cliente do Prisma, gerado no npm install (fora do git)
tests/            um arquivo por padrão, mais integracao.test.ts
```
