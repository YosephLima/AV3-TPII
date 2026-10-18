import { describe, expect, it } from 'vitest';
import { Equipe, MembroEquipe } from '../src/dominio/Equipe';
import { Papel } from '../src/dominio/Papel';
import { ProjetoAnimacao } from '../src/dominio/ProjetoAnimacao';
import { ProjetoDocumentario } from '../src/dominio/ProjetoDocumentario';
import { ProjetoFiccao } from '../src/dominio/ProjetoFiccao';
import { ProjetoPublicitario } from '../src/dominio/ProjetoPublicitario';
import { SimilaridadeCosseno } from '../src/estrategias/SimilaridadeCosseno';
import { modelosAnimacao, modelosDocumentario, modelosFiccao, modelosPublicitario } from '../src/prototipos/modelos';
import { ModeloDesconhecidoError, RegistroPrototipos } from '../src/prototipos/RegistroPrototipos';
import { criarProjeto, PRAZO, profissional } from './fixtures';

describe('Prototype', () => {
  describe('clonar', () => {
    it('cada subclasse devolve uma instância da própria classe, com outro id', () => {
      const tipos = ['documentario', 'animacao', 'publicitario', 'ficcao'] as const;
      const classes = [ProjetoDocumentario, ProjetoAnimacao, ProjetoPublicitario, ProjetoFiccao];

      tipos.forEach((tipo, i) => {
        const original = criarProjeto({}, tipo);
        const clone = original.clonar();
        expect(clone).toBeInstanceOf(classes[i]);
        expect(clone.id).not.toBe(original.id);
        expect(clone.tipo).toBe(tipo);
      });
    });

    it('a cópia é profunda: papéis, competências e restrições não são compartilhados', () => {
      const original = criarProjeto();
      const clone = original.clonar();

      expect(clone.papeis).toEqual(original.papeis);
      expect(clone.papeis).not.toBe(original.papeis);
      expect(clone.papeis[0]).not.toBe(original.papeis[0]);
      expect(clone.papeis[0]?.competenciasDesejadas[0]).not.toBe(original.papeis[0]?.competenciasDesejadas[0]);
      expect(clone.restricoes).not.toBe(original.restricoes);
      expect(clone.prazo).not.toBe(original.prazo);
      expect(clone.prazo.getTime()).toBe(original.prazo.getTime());

      const papel = clone.papeis[0];
      if (papel) papel.peso = 99;
      clone.papeis.push({ papel: Papel.EFEITOS_VISUAIS, peso: 1, competenciasDesejadas: [] });
      clone.restricoes.orcamento = 1;
      clone.prazo.setFullYear(2030);

      expect(original.papeis[0]?.peso).toBe(5);
      expect(original.papeis).toHaveLength(5);
      expect(original.orcamento).toBe(120_000);
      expect(original.prazo).toEqual(PRAZO);
    });

    it('atributos específicos também são copiados sem compartilhar listas', () => {
      const original = criarProjeto({}, 'documentario') as ProjetoDocumentario;
      const clone = original.clonar();
      clone.entrevistados.push('Seu Antônio');

      expect(clone.tema).toBe(original.tema);
      expect(original.entrevistados).toEqual(['Dona Socorro']);
    });

    it('aceita ajustes finos, inclusive restrições campo a campo e atributos do tipo', () => {
      const original = criarProjeto({}, 'animacao') as ProjetoAnimacao;
      const clone = original.clonar({ nome: 'Episódio 2', quadrosPorSegundo: 30, restricoes: { orcamento: 70_000 } });

      expect(clone.nome).toBe('Episódio 2');
      expect(clone.quadrosPorSegundo).toBe(30);
      expect(clone.tecnica).toBe('3d');
      expect(clone.orcamento).toBe(70_000);
      expect(clone.prazo).toEqual(original.prazo);
      expect(clone.restricoes.localizacao).toBe(original.restricoes.localizacao);
    });

    it('o clone não herda a equipe, mas mantém a estratégia escolhida', () => {
      const estrategia = new SimilaridadeCosseno();
      const original = criarProjeto({ estrategia });
      original.definirEquipe(new Equipe([new MembroEquipe(Papel.DIRETOR, profissional('p01'))]));

      const clone = original.clonar();
      expect(clone.equipe).toBeUndefined();
      expect(clone.estrategia).toBe(estrategia);
    });
  });

  describe('RegistroPrototipos', () => {
    it('cria projetos novos a partir de um modelo sem alterar o protótipo', () => {
      const registro = modelosDocumentario();
      const modelo = registro.modelo('padrao');

      const a = registro.clonar('padrao', { nome: 'A', produtor: 'x' });
      const b = registro.clonar('padrao', { nome: 'B', produtor: 'y' });

      expect(a).toBeInstanceOf(ProjetoDocumentario);
      expect([a.nome, b.nome]).toEqual(['A', 'B']);
      expect(a.id).not.toBe(b.id);
      expect(modelo.nome).toBe('');
      expect(a.papeis).toEqual(modelo.papeis);
    });

    it('modelos diferentes do mesmo tipo trazem estruturas diferentes', () => {
      const registro = modelosAnimacao();
      const padrao = registro.clonar('padrao');
      const curta = registro.clonar('curta-2d');

      expect([padrao.tecnica, curta.tecnica]).toEqual(['3d', '2d']);
      expect(curta.papeis.length).toBeLessThan(padrao.papeis.length);
    });

    it('lista os modelos e recusa nomes desconhecidos', () => {
      expect(modelosPublicitario().nomes()).toEqual(['padrao', 'digital']);
      expect(modelosFiccao().nomes()).toEqual(['padrao']);
      expect(() => new RegistroPrototipos().clonar('inexistente')).toThrow(ModeloDesconhecidoError);
    });
  });
});
