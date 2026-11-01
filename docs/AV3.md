# AV3: análise e decisões de projeto

Este documento complementa o [README](../README.md), que explica como usar o serviço. Aqui ficam a análise de anti-padrões feita sobre o código da AV2, o funcionamento interno de cada padrão estrutural e as decisões tomadas em relação ao diagrama do enunciado.

O diagrama de classes refinado está em [`diagramas/diagrama-av3.puml`](../diagramas/diagrama-av3.puml).

## Análise de anti-padrões no código da AV2

O primeiro commit deste repositório é o código da AV1 e o segundo, o da AV2. A análise foi feita sobre o segundo, procurando os anti-padrões citados no enunciado e outros sinais de desgaste.

### Encontrados e corrigidos

| Anti-padrão | Onde estava | Como foi resolvido |
|---|---|---|
| **Estrutura plana demais para o domínio:** o projeto era uma lista de papéis com um peso arbitrário, sem como representar pacotes (pós-produção com edição, cor e mixagem) | `Projeto.papeis: RequisitoPapel[]` | **Composite.** `Projeto.servicoPrincipal` é uma árvore de serviços. Os papéis passaram a ser derivados das folhas, e o peso virou o custo real dos serviços de cada papel |
| **Dependência de implementação concreta:** o orquestrador só sabia ler o cadastro próprio, e não havia como trocar ou acrescentar outra fonte | `OrquestradorEquipe` recebia `RepositorioProfissionais` | **Adapter.** O orquestrador depende de `AdaptadorProfissional`; o cadastro próprio (PostgreSQL com reserva em memória) virou o `AdaptadorInterno`, ao lado do `AdaptadorLinkedIn` |
| **Blob em formação:** o `SistemaRecomendacao` já tinha 14 métodos públicos, e pagamento e armazenamento seriam o caminho natural para ele crescer | `src/SistemaRecomendacao.ts` | Ele só guarda os adaptadores e delega: pagamento em `PagamentoEquipe`, arquivamento em `ArquivoRecomendacoes`, decoradores numa função injetada (`DecorarEstrategia`) que ele nem sabe quais são |
| **Números mágicos:** pesos 0.6/0.4 e 0.5/0.5 soltos nas fórmulas | `RecomendadorDocumentario`, `RecomendadorAnimacao`, `RecomendadorPublicitario` | Constantes com nome (`PESO_ADERENCIA`) e comentário dizendo o que é o resto da pontuação, como o `CalculadorCompatibilidade.PESO_TECNICO` já fazia |

### Padrão virando anti-padrão (o caso do Singleton)

Cache e auditoria precisam de estado compartilhado entre requisições, e o caminho fácil é um Singleton ou uma variável global, que o enunciado cita como "Global State disfarçado". Aqui o estado fica em objetos próprios (`ArmazemCache`, `RegistroChamadas`), criados uma vez na raiz de composição (`src/composicao.ts`) e entregues aos decoradores. Isso permite:

- montar a pilha de novo a cada requisição sem perder o cache;
- usar nos testes um cache novo, com relógio falso;
- impor limites: o cache tem capacidade e validade, e a auditoria guarda só as últimas chamadas, então nenhum dos dois cresce sem fim.

## Composite: o projeto como árvore de serviços

```
Animação 3D                         R$ 72.000 (modelo padrão de animação)
├─ Pré-produção
│  └─ Direção e storyboard          DIRETOR            R$ 18.000
├─ Produção
│  ├─ Modelagem                     EFEITOS_VISUAIS    R$ 18.000
│  └─ Renderização                  EFEITOS_VISUAIS    R$ 12.000
└─ Pós-produção
   ├─ Montagem                      EDITOR             R$ 12.000
   └─ Som
      ├─ Foley                      SONOPLASTA         R$  6.000
      └─ Mixagem                    SONOPLASTA         R$  6.000
```

- **Custo:** a soma das folhas. **Prazo:** o do último serviço a terminar. Os dois são calculados pela árvore, em qualquer profundidade.
- **Papéis do projeto:** derivados das folhas, somando o custo dos serviços de cada papel e pegando o maior nível pedido de cada competência. Com isso, estratégias, validadores e relatórios da AV2 continuaram funcionando sem mudar de assinatura.
- **Fatia do orçamento de cada papel:** é proporcional ao custo dos seus serviços.
- **`validarEstrutura()`:** valida a árvore inteira e aponta o caminho até o problema (`Projeto > Pós-produção > Som > Mixagem: prazo inválido`). Confere ainda se algum serviço termina depois da entrega e se o custo estimado cabe no orçamento.
- **Ciclos e duplicidades:** `PacoteServico.adicionarServico` recusa ciclos (um pacote dentro de si mesmo) e o mesmo serviço em dois lugares, que seria contado duas vezes.
- **Modelos e clonagem:** os modelos de cada tipo trazem árvores de profundidades diferentes. Ao clonar com outra data de entrega, os prazos dos serviços acompanham a nova data.

## Adapter: provedores externos

| Interface | Adaptadores | Sistema externo e o que o adaptador traduz |
|---|---|---|
| `AdaptadorArmazenamento` | `AdaptadorS3`, `AdaptadorGoogleCloud`, `AdaptadorLocal` | S3: parâmetros `Bucket`/`Key`, corpo em `Uint8Array`, erro `NoSuchKey` e listagem paginada por token. GCS: `bucket().file()`, respostas em tupla e erro com `code: 404`. Local: disco, com proteção contra caminhos que saem do diretório |
| `AdaptadorPagamento` | `AdaptadorStripe`, `AdaptadorPagSeguro` | Stripe: centavos inteiros, ids `pi_`, status em inglês e estorno num recurso à parte. PagSeguro: valor em texto (`"1234.50"`), situação em português e falhas no corpo da resposta, sem exceção. Os dois viram `aprovado`, `pendente`, `recusado` ou `cancelado` |
| `AdaptadorProfissional` | `AdaptadorInterno`, `AdaptadorLinkedIn` | LinkedIn: perfis por URN, cargos e habilidades em inglês, nível medido em recomendações de colegas, nota de 1 a 10, diária em centavos e busca paginada. O adaptador devolve `Profissional` do domínio |

Os sistemas externos são simulados em memória (`src/externos/`), cada um imitando o formato da API real, para que a tradução feita pelo adaptador seja de verdade e não um repasse.

No fluxo:

- **Profissionais:** o orquestrador busca os candidatos pelo `AdaptadorProfissional`.
- **Armazenamento:** cada recomendação é guardada pelo `AdaptadorArmazenamento` e pode ser consultada depois (`GET /recomendacoes/:id`).
- **Pagamento:** quando todos os convites são aceitos, a equipe é paga pelo `AdaptadorPagamento`. Se o produtor pedir reavaliação, os pagamentos são estornados.

O `SistemaRecomendacao` recebe os três adaptadores no construtor e pode trocá-los com `configurarAdaptadores`. No servidor, cada um é escolhido por uma variável de ambiente (veja a seção Configuração do README).

## Decorator: cache, auditoria e compressão

A interface `RecomendacaoStrategy` não mudou. O `RecomendadorBase` tem a lógica principal: cada papel só aceita quem cabe na sua fatia do orçamento, ordenado por pontuação. Os recomendadores das famílias o estendem e só trocam a pontuação.

| Decorador | O que faz |
|---|---|
| `CacheDecorator` | Devolve o resultado já calculado para um pedido equivalente. A chave considera estratégia, orçamento, requisitos de cada papel e dados dos candidatos (inclusive notas), mas não o id nem o nome do projeto, então projetos parecidos aproveitam o cache. Com capacidade e validade |
| `AuditoriaDecorator` | Registra toda chamada, inclusive as que falham, com a pilha, o projeto, o número de candidatos, o tamanho do resultado e o tempo de resposta |
| `CompressaoDecorator` | Serializa o ranking, comprime com gzip no `nivelCompressao` (1 a 9) e envia pelo canal configurado, que grava em `rankings/<projeto>.json.gz` no armazenamento. Abaixo de 1 KB envia sem comprimir |

**Por que a compressão é feita assim:**

- **O tipo devolvido não pode mudar.** O decorador precisa devolver o mesmo `Map` que recebeu do recomendador, porque o orquestrador usa o resultado como `Map`.
- **Dentro do processo não há transmissão.** O `Map` passa por referência, sem copiar nenhum byte. A compressão só faz diferença onde os dados saem do processo.
- **Por isso o decorador comprime o que ele mesmo envia** ao armazenamento, e o teste compara os bytes enviados com o JSON original.
- **A resposta HTTP é comprimida à parte.** Isso fica com o `@fastify/compress`, que usa gzip ou brotli quando o cliente aceita e a resposta passa de 1 KB.

**A pilha é montada em tempo de execução:**

- **Ordem:** a lista vai de fora para dentro. `["auditoria", "cache"]` vira `auditoria(cache(estratégia))`.
- **De onde vem:** a política padrão vem de `DECORADORES` e pode ser trocada com o sistema rodando (`politica.definirPadrao`). O produtor pode pedir outra pilha na requisição (`decoradores`), que vale só para o projeto dele.
- **Sem mudar o `SistemaRecomendacao`:** ele recebe uma função que envolve a estratégia escolhida e não sabe quais decoradores existem.
- **A ordem muda o comportamento,** e os testes mostram isso:
  - com a auditoria por fora, ela registra os acertos do cache; por dentro, só as chamadas que chegaram ao recomendador;
  - com o cache por fora da compressão, um acerto não grava o ranking de novo.

## Como as peças se encaixam

```
POST /recomendacoes { tipo, modelo?, nome, produtor, servico?, decoradores?, detalhes?, ... }
  └─ SistemaRecomendacao.recomendar
       ├─ RegistroFabricas.para(tipo)        → fábrica da família (Abstract Factory)
       ├─ fabrica.criarProjeto(dados)        → clona o modelo, com a árvore de serviços (Prototype + Composite)
       ├─ estrategiaPara(projeto)            → recomendador da família envolvido pela pilha (Strategy + Decorator)
       ├─ OrquestradorPadrao                 → Template Method
       │    ├─ validarRestricoes             → validador da família, inclusive a árvore (Visitor + Composite)
       │    ├─ candidatos                    → AdaptadorProfissional (Adapter)
       │    └─ recomendar                    → a pilha decorada
       ├─ ArquivoRecomendacoes.guardar       → AdaptadorArmazenamento (Adapter)
       └─ notificar                          → observadores (Observer)

responderConvite (todos aceitaram)           → PagamentoEquipe.pagar    → AdaptadorPagamento
reavaliar                                    → PagamentoEquipe.estornar → AdaptadorPagamento
```

## Decisões em relação ao diagrama

O diagrama do enunciado foi usado como guia. Onde ele e o texto divergem, ou onde faltava informação:

- **Adaptadores assíncronos.** Os métodos devolvem `Promise`, porque as APIs externas são assíncronas. Os tipos `any` do diagrama viraram `MetadadosArquivo`, `CriteriosBusca` e `Avaliacao`, e `verificarPagamento` devolve um dos quatro status padronizados.
- **Dois adaptadores por interface, três no armazenamento.** O texto pede "pelo menos duas"; `AdaptadorPayPal` e `AdaptadorIndeed` ficaram de fora. O `AdaptadorLocal` foi incluído porque é o padrão do servidor e grava de verdade no disco.
- **`ServicoProjeto` ganhou métodos além dos quatro do diagrama:**
  - `problemas()`, para a validação apontar o caminho até o erro;
  - `servicosAtomicos()`, para derivar os papéis;
  - `contem()`, que impede ciclos;
  - `clonar()`, que mantém o Prototype da AV2.
- **`PacoteServico` vazio é permitido durante a montagem,** mas a validação o recusa; por isso a multiplicidade ficou `0..*` no nosso diagrama.
- **`Projeto` manteve `papeis`,** só que derivado da árvore. Assim estratégias, validadores e relatórios não precisaram mudar de assinatura. A lista deixou de ser um atributo, como o texto pede.
- **`RecomendadorBase`** é o antigo `RecomendadorPorPontuacao`, agora concreto (pontua pela aderência técnica) e base dos recomendadores das famílias.
- **`DecoradorRecomendacao`** é uma classe abstrata que não está no diagrama. Ela guarda a estratégia envolvida e repassa o `nome`, para que a decoração seja transparente; a pilha aparece em `descricao` e no campo `pilha` da resposta.
- **O `-cache: Map` do `CacheDecorator`** e o `-logger` do `AuditoriaDecorator` foram para `ArmazemCache` e `RegistroChamadas`, compartilhados e com limite, pelo motivo explicado na análise de anti-padrões.
- **`SistemaRecomendacao`** ganhou `consultarRecomendacao` e o getter `adaptadores` (para a rota de profissionais seguir uma troca feita com `configurarAdaptadores`).
