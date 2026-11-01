import { describe, expect, it } from 'vitest';
import { Competencia } from '../src/dominio/Competencia';
import { Papel } from '../src/dominio/Papel';
import { PacoteServico } from '../src/servicos/PacoteServico';
import { ServicoAtomico } from '../src/servicos/ServicoAtomico';
import { ComposicaoInvalidaError, type ServicoProjeto } from '../src/servicos/ServicoProjeto';
import { criarProjeto, PRAZO, sistemaDeTeste } from './fixtures';

const atomico = (nome: string, custo: number, prazo: string, papel = Papel.EDITOR, ...competencias: Competencia[]) =>
  new ServicoAtomico({ nome, custoBase: custo, prazoBase: new Date(prazo), papelNecessario: papel, competenciasDesejadas: competencias });

const pacote = (nome: string, ...servicos: ServicoProjeto[]) => new PacoteServico(nome, servicos);

/** Pós-produção com quatro níveis: pacote > pacote > pacote > atômico. */
function posProducao() {
  const correcao = atomico('Correção de cor', 4_000, '2027-02-20');
  const mixagem = atomico('Mixagem', 3_000, '2027-03-10', Papel.SONOPLASTA);
  const foley = atomico('Foley', 2_000, '2027-02-28', Papel.SONOPLASTA);
  const raiz = pacote(
    'Pós-produção',
    atomico('Montagem', 10_000, '2027-02-01'),
    pacote('Finalização', correcao, pacote('Som', foley, mixagem)),
  );
  return { raiz, correcao, mixagem, foley };
}

describe('Composite', () => {
  describe('custo e prazo em profundidades diferentes', () => {
    it('serviço atômico sozinho (profundidade 1)', () => {
      const montagem = atomico('Montagem', 10_000, '2027-02-01');
      expect(montagem.calcularCusto()).toBe(10_000);
      expect(montagem.obterPrazo()).toEqual(new Date('2027-02-01'));
      expect(montagem.listarSubservicos()).toEqual([]);
    });

    it('pacote de atômicos (profundidade 2): soma os custos e o prazo é o do último a terminar', () => {
      const som = pacote('Som', atomico('Foley', 2_000, '2027-02-28'), atomico('Mixagem', 3_000, '2027-03-10'));
      expect(som.calcularCusto()).toBe(5_000);
      expect(som.obterPrazo()).toEqual(new Date('2027-03-10'));
    });

    it('pacotes aninhados (profundidade 4) propagam a conta pela árvore inteira', () => {
      const { raiz } = posProducao();
      expect(raiz.calcularCusto()).toBe(19_000);
      expect(raiz.obterPrazo()).toEqual(new Date('2027-03-10'));
      expect(raiz.servicosAtomicos().map((s) => s.nome)).toEqual(['Montagem', 'Correção de cor', 'Foley', 'Mixagem']);
    });

    it('adicionar ou remover um serviço muda o resultado de todos os pacotes acima', () => {
      const { raiz, mixagem } = posProducao();
      const som = (raiz.listarSubservicos()[1] as PacoteServico).listarSubservicos()[1] as PacoteServico;

      expect(som.removerServico(mixagem)).toBe(true);
      expect(raiz.calcularCusto()).toBe(16_000);
      expect(raiz.obterPrazo()).toEqual(new Date('2027-02-28'));

      som.adicionarServico(atomico('Dublagem', 6_000, '2027-03-15', Papel.SONOPLASTA));
      expect(raiz.calcularCusto()).toBe(22_000);
      expect(raiz.obterPrazo()).toEqual(new Date('2027-03-15'));
      expect(som.removerServico(mixagem)).toBe(false);
    });

    it('a lista devolvida é uma cópia: mexer nela não altera o pacote', () => {
      const { raiz } = posProducao();
      raiz.listarSubservicos().pop();
      expect(raiz.listarSubservicos()).toHaveLength(2);
    });
  });

  describe('validação recursiva', () => {
    it('aceita a árvore bem formada', () => {
      expect(posProducao().raiz.validar()).toBe(true);
    });

    it('aponta o caminho até cada serviço com problema', () => {
      const raiz = pacote(
        'Projeto',
        pacote('Pós-produção', atomico('Montagem', 0, '2027-02-01'), pacote('Som', atomico('Mixagem', 1, 'data ruim'))),
        pacote('Extras'),
        atomico('Figurino', 500, '2027-01-01', 'FIGURINISTA' as Papel),
      );

      expect(raiz.validar()).toBe(false);
      expect(raiz.problemas()).toEqual([
        'Projeto > Pós-produção > Montagem: custo deve ser positivo',
        'Projeto > Pós-produção > Som > Mixagem: prazo inválido',
        'Projeto > Extras: pacote vazio',
        'Projeto > Figurino: papel inválido (FIGURINISTA)',
      ]);
    });

    it('recusa ciclos e o mesmo serviço em dois lugares', () => {
      const { raiz, foley } = posProducao();
      const finalizacao = raiz.listarSubservicos()[1] as PacoteServico;

      expect(() => finalizacao.adicionarServico(raiz)).toThrow(ComposicaoInvalidaError);
      expect(() => raiz.adicionarServico(raiz)).toThrow(ComposicaoInvalidaError);
      expect(() => raiz.adicionarServico(foley)).toThrow(/já faz parte/);
      expect(() => raiz.adicionarServico(pacote('Outro som', foley))).toThrow(/já faz parte/);
    });
  });

  describe('Projeto com servicoPrincipal', () => {
    it('calcularCustoTotal delega ao serviço principal', () => {
      const { raiz } = posProducao();
      expect(criarProjeto({ servicoPrincipal: raiz }).calcularCustoTotal()).toBe(19_000);
    });

    it('os papéis vêm das folhas: custo somado e maior nível de cada competência', () => {
      const servicoPrincipal = pacote(
        'Projeto',
        atomico('Foley', 2_000, '2027-02-28', Papel.SONOPLASTA, new Competencia('foley', 7), new Competencia('mixagem', 5)),
        pacote('Final', atomico('Mixagem', 3_000, '2027-03-10', Papel.SONOPLASTA, new Competencia('mixagem', 8))),
        atomico('Montagem', 5_000, '2027-02-01'),
      );
      const projeto = criarProjeto({ servicoPrincipal });

      expect(projeto.papeis).toEqual([
        { papel: Papel.SONOPLASTA, custo: 5_000, competenciasDesejadas: [new Competencia('foley', 7), new Competencia('mixagem', 8)] },
        { papel: Papel.EDITOR, custo: 5_000, competenciasDesejadas: [] },
      ]);
      expect(projeto.tetoPorPapel(Papel.SONOPLASTA)).toBe(projeto.orcamento / 2);
    });

    it('validarEstrutura confere a árvore, a entrega e o orçamento', () => {
      const dentro = criarProjeto({ servicoPrincipal: posProducao().raiz });
      expect(dentro.validarEstrutura()).toBe(true);

      const { raiz } = posProducao();
      raiz.adicionarServico(atomico('Legendas', 200_000, '2027-04-15'));
      const projeto = criarProjeto({ servicoPrincipal: raiz });

      expect(projeto.prazo).toEqual(PRAZO);
      expect(projeto.validarEstrutura()).toBe(false);
      expect(projeto.problemasEstrutura()).toEqual([
        'O serviço Legendas termina depois da entrega',
        'Custo estimado dos serviços (219000) excede o orçamento (120000)',
      ]);
    });

    it('os modelos de cada tipo já vêm com árvores válidas', () => {
      const { fabricas } = sistemaDeTeste();
      for (const fabrica of fabricas.todas()) {
        for (const modelo of fabrica.modelos()) {
          const projeto = fabrica.criarProjeto({ modelo, nome: 'x', produtor: 'y' });
          expect(projeto.problemasEstrutura(), `${fabrica.tipo}/${modelo}`).toEqual([]);
        }
      }
      const animacao = fabricas.para('animacao').criarProjeto({ nome: 'x', produtor: 'y' });
      expect(animacao.calcularCustoTotal()).toBe(72_000);
    });
  });
});
