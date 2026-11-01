/** Tipo novo criado só nos testes: tudo o que ele precisa está neste arquivo, sem mudar nada em src/. */
import { Competencia } from '../src/dominio/Competencia';
import { Papel } from '../src/dominio/Papel';
import { Projeto, type AjustesProjeto, type DadosProjeto } from '../src/dominio/Projeto';
import type { RecomendacaoStrategy } from '../src/estrategias/RecomendacaoStrategy';
import { RecomendadorAnimacao } from '../src/fabricas/animacao/RecomendadorAnimacao';
import { texto, type Detalhes } from '../src/fabricas/detalhes';
import { FabricaProjetoBase } from '../src/fabricas/FabricaProjeto';
import { NotificadorConvite } from '../src/observadores/NotificadorConvite';
import type { EnviarEmail } from '../src/observadores/NotificadorEmail';
import type { Observador } from '../src/observadores/Observador';
import { RegistroPrototipos } from '../src/prototipos/RegistroPrototipos';
import { PacoteServico } from '../src/servicos/PacoteServico';
import { ServicoAtomico } from '../src/servicos/ServicoAtomico';
import { ValidadorConsistencia, type ValidadorProjeto } from '../src/visitantes/ValidadorConsistencia';

const servicoRV = (nome: string, papel: Papel, custo: number, competencia: Competencia) =>
  new ServicoAtomico({ nome, custoBase: custo, prazoBase: new Date('2027-06-01'), papelNecessario: papel, competenciasDesejadas: [competencia] });

type AjustesRealidadeVirtual = AjustesProjeto & { plataforma?: string };

export class ProjetoRealidadeVirtual extends Projeto {
  readonly tipo = 'realidade-virtual';

  constructor(
    dados: DadosProjeto,
    readonly plataforma: string,
  ) {
    super(dados);
  }

  clonar(ajustes: AjustesRealidadeVirtual = {}): ProjetoRealidadeVirtual {
    return new ProjetoRealidadeVirtual(this.dadosClonados(ajustes), ajustes.plataforma ?? this.plataforma);
  }
}

class ValidadorRealidadeVirtual extends ValidadorConsistencia {
  protected override validarTipo(projeto: ProjetoRealidadeVirtual): void {
    if (!projeto.plataforma) this.registrarErro('Experiência de realidade virtual sem plataforma');
  }
}

class NotificadorRealidadeVirtual extends NotificadorConvite<ProjetoRealidadeVirtual> {
  protected override detalhes(projeto: ProjetoRealidadeVirtual): string {
    return `Experiência imersiva para ${projeto.plataforma}.`;
  }
}

export class FabricaRealidadeVirtual extends FabricaProjetoBase<ProjetoRealidadeVirtual> {
  readonly tipo = 'realidade-virtual';

  constructor(enviar?: EnviarEmail) {
    const modelo = new ProjetoRealidadeVirtual(
      {
        nome: '',
        produtor: '',
        genero: 'experiência imersiva',
        duracao: 10,
        servicoPrincipal: new PacoteServico('Experiência imersiva', [
          servicoRV('Direção', Papel.DIRETOR, 30_000, new Competencia('narrativa', 8)),
          servicoRV('Ambientes 3D', Papel.EFEITOS_VISUAIS, 50_000, new Competencia('renderizacao', 9)),
          servicoRV('Áudio espacial', Papel.SONOPLASTA, 20_000, new Competencia('mixagem', 8)),
        ]),
        restricoes: { orcamento: 100_000, prazo: new Date('2027-06-30'), localizacao: 'São Paulo' },
      },
      '',
    );
    super(new RegistroPrototipos<ProjetoRealidadeVirtual>().registrar('padrao', modelo), enviar);
  }

  override criarValidador(): ValidadorProjeto {
    return new ValidadorRealidadeVirtual();
  }

  /** Reaproveita o de animação, que já prioriza modelagem 3D. */
  override criarRecomendador(): RecomendacaoStrategy {
    return new RecomendadorAnimacao();
  }

  override criarNotificador(): Observador {
    return new NotificadorRealidadeVirtual(this.enviar);
  }

  protected clonarModelo(modelo: ProjetoRealidadeVirtual, ajustes: AjustesProjeto, detalhes: Detalhes): ProjetoRealidadeVirtual {
    return modelo.clonar({ ...ajustes, plataforma: texto(detalhes, 'plataforma') });
  }
}
