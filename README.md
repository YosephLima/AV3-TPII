# cinebridge: microsserviço de recomendação (AV3)

O produtor descreve um projeto audiovisual (tipo, orçamento, data de entrega e os serviços de que precisa) e o serviço devolve a equipe recomendada, com um profissional para cada papel técnico e alternativas para cada um. Os envolvidos são notificados e tudo fica registrado em auditoria.

## O que a AV3 acrescentou

- **Integração com serviços externos:** os arquivos podem ir para o Amazon S3, o Google Cloud ou o disco local; os pagamentos aos profissionais, para o Stripe ou o PagSeguro; e os profissionais podem vir do cadastro próprio ou do LinkedIn. Trocar de provedor é só mudar uma variável de ambiente. Os serviços externos são simulados.
- **Projeto como pacote de serviços:** em vez de uma lista de papéis, o projeto é uma árvore (pré-produção, produção, pós-produção, cada uma com seus serviços), e o custo e o prazo são calculados a partir dela.
- **Cache, auditoria e compressão:** podem ser ligados em qualquer combinação, pela configuração do servidor ou pelo próprio produtor na requisição.

A análise de anti-padrões feita sobre o código da AV2, o funcionamento interno de cada padrão e as decisões em relação ao diagrama do enunciado estão em [`docs/AV3.md`](docs/AV3.md). O diagrama de classes está em [`diagramas/diagrama-av3.puml`](diagramas/diagrama-av3.puml).

## Padrões aplicados

| Padrão | Etapa | Para que serve aqui | Onde |
|---|---|---|---|
| Strategy | AV1 | Algoritmos de recomendação intercambiáveis | `src/estrategias/` |
| Template Method | AV1 | Etapas fixas da montagem da equipe | `src/orquestracao/` |
| Observer | AV1 | Notificações e auditoria de eventos | `src/observadores/` |
| Visitor | AV1 | Validação, compatibilidade e relatório | `src/visitantes/` |
| Prototype | AV2 | Projetos criados a partir de modelos prontos | `src/dominio/`, `src/prototipos/` |
| Factory Method | AV2 | Cada tipo de projeto cria seus próprios componentes | `src/fabricas/` |
| Abstract Factory | AV2 | Uma família de componentes por tipo de projeto | `src/fabricas/` |
| **Adapter** | AV3 | Armazenamento, pagamento e cadastro de profissionais externos | `src/adaptadores/`, `src/externos/` |
| **Composite** | AV3 | Projeto como árvore de pacotes e serviços | `src/servicos/` |
| **Decorator** | AV3 | Cache, auditoria e compressão em volta da recomendação | `src/decoradores/` |

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

## Configuração

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | nenhum | Conexão com o PostgreSQL. Sem ela, o cadastro fica só em memória |
| `PORT` | `3000` | Porta HTTP da API |
| `ARMAZENAMENTO` | `local` | Onde guardar os arquivos: `local`, `s3` ou `gcs` |
| `ARMAZENAMENTO_DIR` | `armazenamento` | Pasta usada quando o armazenamento é `local` |
| `ARMAZENAMENTO_BUCKET` | `cinebridge` | Bucket do S3 ou do Google Cloud |
| `PAGAMENTO` | `stripe` | `stripe` ou `pagseguro` |
| `PROFISSIONAIS` | `interno` | `interno` (cadastro próprio) ou `linkedin` |
| `DECORADORES` | `auditoria,cache,compressao` | Quais recursos ligar, de fora para dentro. Vazio desliga todos |
| `NIVEL_COMPRESSAO` | `6` | Nível do gzip, de 1 (mais rápido) a 9 (menor) |

Um valor inválido impede o servidor de subir, com uma mensagem dizendo os valores aceitos.

Para trocar de provedor, basta mudar a variável e reiniciar:

```bash
ARMAZENAMENTO=s3 PAGAMENTO=pagseguro PROFISSIONAIS=linkedin npm start
```

No PowerShell:

```powershell
$env:ARMAZENAMENTO='s3'; $env:PAGAMENTO='pagseguro'; $env:PROFISSIONAIS='linkedin'; npm start
```

Sobre os recursos de `DECORADORES`:

- **`cache`:** reaproveita a recomendação de pedidos equivalentes, inclusive de projetos diferentes com os mesmos requisitos.
- **`auditoria`:** registra no log cada recomendação calculada, com o tempo de resposta.
- **`compressao`:** grava o ranking completo comprimido no armazenamento, em `rankings/`.

A ordem importa: com `auditoria,cache`, a auditoria registra também as respostas que vieram do cache.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/saude` | Verificação de funcionamento |
| GET | `/profissionais` | Profissionais da fonte configurada |
| GET | `/modelos` | Tipos de projeto e modelos disponíveis em cada um |
| POST | `/recomendacoes` | Cria o projeto e devolve a equipe recomendada |
| GET | `/recomendacoes/:id` | Consulta uma recomendação já feita |

### O que enviar em `POST /recomendacoes`

Só `tipo`, `nome` e `produtor` são obrigatórios. O resto vem de um modelo pronto do tipo (`modelo`, padrão `padrao`; veja `GET /modelos`) e pode ser ajustado:

- **`orcamento`, `prazo`, `localizacao`, `genero`, `duracao`:** ajustes do projeto.
- **`detalhes`:** o que é próprio do tipo (tema e entrevistados no documentário, técnica e quadros por segundo na animação, cliente e veiculação na publicidade).
- **`servico`:** os serviços do projeto, se você não quiser os do modelo. Um pacote tem `servicos`; um serviço tem `papel`, `custo`, `prazo` e, se quiser, `competencias`:

  ```json
  "servico": {
    "nome": "Pós-produção",
    "servicos": [
      { "nome": "Montagem", "papel": "EDITOR", "custo": 6000, "prazo": "2027-03-20" },
      { "nome": "Som", "servicos": [
        { "nome": "Mixagem", "papel": "SONOPLASTA", "custo": 3000, "prazo": "2027-03-25" }
      ] }
    ]
  }
  ```

- **`estrategia`:** outro algoritmo de recomendação (`cosseno`, `colaborativa` ou `orcamento`).
- **`decoradores`:** os recursos que o produtor quer só para este projeto, como `["auditoria", "cache"]`.

A resposta traz a equipe, o custo estimado dos serviços, a árvore de serviços com o responsável de cada um, a validação e um relatório em texto. Se o projeto não atender às regras do seu tipo (por exemplo, um serviço que termina depois da entrega ou um custo acima do orçamento), a resposta é `422`, com a lista de `motivos`.

### Com curl

No Linux, ou com `curl.exe` no PowerShell:

```bash
curl -X POST http://localhost:3000/recomendacoes -H "content-type: application/json" -d @exemplos/documentario.json
curl -X POST http://localhost:3000/recomendacoes -H "content-type: application/json" -d @exemplos/animacao.json
curl -X POST http://localhost:3000/recomendacoes -H "content-type: application/json" -d @exemplos/ficcao-pilha.json
curl --compressed -X POST http://localhost:3000/recomendacoes -H "content-type: application/json" -d @exemplos/publicitario-modelo.json
curl http://localhost:3000/recomendacoes/<projetoId>
```

Com `--compressed`, a resposta vem comprimida (gzip), o que reduz o tráfego quando ela passa de 1 KB.

### Com Postman, Insomnia ou Thunder Client

O arquivo `exemplos/cinebridge.postman_collection.json` traz todas as requisições prontas, inclusive dois exemplos de erro. A URL base fica na variável `baseUrl` (`http://localhost:3000`). No Postman, cada recomendação guarda o `projetoId` para a consulta; nas outras ferramentas, cole o id à mão.

| Ferramenta | Como importar |
|---|---|
| Postman | botão **Import** e escolher o arquivo |
| Insomnia | **Import** na tela do projeto, opção de arquivo, e escolher o arquivo |
| Thunder Client (VS Code) | aba **Collections**, menu da aba, **Import** e escolher o arquivo |

## Compatibilidade

- **Com Docker,** a API e o banco rodam no mesmo ambiente Linux em qualquer sistema. No Windows 10+, basta o Docker Desktop.
- **Sem Docker,** o projeto só depende do Node.js 24+. Os scripts não usam sintaxe exclusiva de um shell, o fim de linha é fixado em LF e os caminhos de arquivo funcionam igual no Windows e no Linux.
- Testado no Ubuntu, tanto direto no sistema quanto pelo Docker. No Windows não foi testado.

## Estrutura

```
src/
  dominio/        entidades; Projeto e suas subclasses
  servicos/       árvore de serviços do projeto
  prototipos/     modelos prontos de cada tipo
  fabricas/       uma fábrica por tipo de projeto
  estrategias/    algoritmos de recomendação
  decoradores/    cache, auditoria e compressão
  adaptadores/    armazenamento, pagamento e fontes de profissionais
  externos/       serviços externos simulados (S3, Google Cloud, Stripe, PagSeguro, LinkedIn)
  contratacao/    pagamento da equipe e arquivo das recomendações
  orquestracao/   montagem da equipe
  observadores/   notificações e auditoria de eventos
  visitantes/     validação, compatibilidade e relatório
  repositorio/    cadastro de profissionais (PostgreSQL, com reserva em memória)
  http/           API
  composicao.ts   onde as peças são montadas
prisma/           banco: schema, migrations e seed
docs/             análise e decisões de projeto
diagramas/        diagramas de classes
exemplos/         requisições prontas
tests/            testes
```
