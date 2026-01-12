import { IAlunoRepository } from '../../repositories/aluno/IAlunoRepository';
import { Aluno } from '../../models/Aluno';
import { INotaRepository } from '../../repositories/nota/INotaRepository';
import { IFrequenciaRepository } from '../../repositories/frequencia/IFrequenciaRepository';

export class AlunoService {
  constructor(
    private alunoRepository: IAlunoRepository,
    private notaRepository?: INotaRepository,
    private frequenciaRepository?: IFrequenciaRepository
  ) { }

  async listar(): Promise<Aluno[]> {
    return this.alunoRepository.findAll();
  }

  async buscarPorId(id: string): Promise<Aluno | null> {
    return this.alunoRepository.findById(id);
  }

  async promoverAluno(id: string, anoAtual: string, anoDestino: string, turmaId: string) {
    await this.alunoRepository.updateHistorico(id, anoAtual, anoDestino, turmaId, 'promovido');
  }

  async reprovarAluno(id: string, anoAtual: string, anoDestino: string, turmaId: string) {
    await this.alunoRepository.updateHistorico(id, anoAtual, anoDestino, turmaId, 'reprovado');
  }

  async transferirAluno(id: string, anoAtual: string, anoDestino: string, turmaId: string) {
    await this.alunoRepository.updateHistorico(id, anoAtual, anoDestino, turmaId, 'transferido');
  }

  async listarPorTurmaEAnoLetivo(turmaId: string, anoLetivo: string): Promise<Aluno[]> {
    return this.alunoRepository.findByTurmaEAnoLetivo(turmaId, anoLetivo);
  }

  async updateHistorico(
    id: string,
    anoAtual: string,
    anoDestino: string,
    turmaId: string,
    status: 'promovido' | 'reprovado' | 'transferido'
  ) {
    await this.alunoRepository.updateHistorico(id, anoAtual, anoDestino, turmaId, status);
  }

  /**
   * Obtém a turma do aluno para um ano específico considerando histórico
   * @param aluno - Objeto do aluno
   * @param anoLetivo - Ano letivo a buscar
   * @returns ID da turma do aluno no ano especificado
   */
  obterTurmaDoAno(aluno: Aluno, anoLetivo: number): string {
    const anoStr = anoLetivo.toString();
    if (aluno.historicoTurmas && aluno.historicoTurmas[anoStr]) {
      return aluno.historicoTurmas[anoStr];
    }
    return aluno.turmaId;
  }

  /**
   * Calcula o status do aluno baseado nas notas finais
   * @param aluno - Objeto do aluno
   * @param anoLetivo - Ano letivo para buscar as notas
   * @returns Status: 'Aprovado', 'Reprovado' ou 'Em Andamento'
   */
  async calcularStatusAluno(aluno: Aluno, anoLetivo: number): Promise<string> {
    if (!this.notaRepository) {
      throw new Error('NotaRepository não foi injetado no AlunoService');
    }

    try {
      // Obter a turma do aluno no ano letivo especificado
      const turmaId = this.obterTurmaDoAno(aluno, anoLetivo);

      // Buscar notas do aluno na turma especificada
      const notasData = await this.notaRepository.findByAlunoUidETurma(aluno.id, turmaId);

      if (notasData.length === 0) {
        return 'Em Andamento'; // Sem notas = em andamento
      }

      // Agrupar notas por matéria e bimestre
      const notasPorMateriaBimestre: { [materia: string]: { [bimestre: string]: any } } = {};

      notasData.forEach(nota => {
        if (!notasPorMateriaBimestre[nota.materiaId]) {
          notasPorMateriaBimestre[nota.materiaId] = {};
        }
        notasPorMateriaBimestre[nota.materiaId][nota.bimestre] = nota;
      });

      // Verificar se tem notas dos 4 bimestres em pelo menos uma matéria
      const bimestresEsperados = ['1º', '2º', '3º', '4º'];
      let temTodasNotasDoAno = false;

      Object.values(notasPorMateriaBimestre).forEach(bimestres => {
        const bimestresPresentes = Object.keys(bimestres);
        const temTodosBimestres = bimestresEsperados.every(b => bimestresPresentes.includes(b));

        if (temTodosBimestres) {
          temTodasNotasDoAno = true;
        }
      });

      // Se não tem notas dos 4 bimestres, está "Em Andamento"
      if (!temTodasNotasDoAno) {
        return 'Em Andamento';
      }

      // Verificar se tem notas finais válidas em todas as matérias/bimestres
      let todasMediasFinais: number[] = [];
      let temNotaIncompleta = false;

      Object.values(notasPorMateriaBimestre).forEach(bimestres => {
        Object.values(bimestres).forEach((nota: any) => {
          // Verificar se tem todas as 3 notas básicas OU nota de recuperação
          const temTresNotas =
            typeof nota.notaParcial === 'number' &&
            typeof nota.notaGlobal === 'number' &&
            typeof nota.notaParticipacao === 'number';

          const temRecuperacao = typeof nota.notaRecuperacao === 'number';

          if (temTresNotas || temRecuperacao) {
            // Calcular média final
            let mediaFinal: number;
            if (temRecuperacao) {
              mediaFinal = nota.notaRecuperacao;
            } else {
              mediaFinal = (nota.notaParcial + nota.notaGlobal + nota.notaParticipacao) / 3;
            }
            todasMediasFinais.push(mediaFinal);
          } else {
            temNotaIncompleta = true;
          }
        });
      });

      // Se tem nota incompleta, status é "Em Andamento"
      if (temNotaIncompleta) {
        return 'Em Andamento';
      }

      // Se não tem nenhuma média final calculada, também é "Em Andamento"
      if (todasMediasFinais.length === 0) {
        return 'Em Andamento';
      }

      // Calcular média geral do aluno
      const mediaGeral = todasMediasFinais.reduce((sum, nota) => sum + nota, 0) / todasMediasFinais.length;

      // Retornar status baseado na média geral
      return mediaGeral >= 6 ? 'Aprovado' : 'Reprovado';

    } catch (error) {
      console.error('Erro ao calcular status do aluno:', error);
      return 'Em Andamento';
    }
  }

  /**
   * Copia notas e frequências de uma turma para outra
   * Usado após transferências, promoções ou reprovações
   * @param alunoId - ID do aluno
   * @param turmaOrigemId - ID da turma de origem
   * @param turmaDestinoId - ID da turma de destino
   */
  async copiarDadosAcademicos(
    alunoId: string,
    turmaOrigemId: string,
    turmaDestinoId: string
  ): Promise<void> {
    if (!this.notaRepository) {
      console.warn('NotaRepository não injetado, pulando cópia de notas');
    }

    if (!this.frequenciaRepository) {
      console.warn('FrequenciaRepository não injetado, pulando cópia de frequências');
    }

    try {
      const promises: Promise<void>[] = [];

      // Copiar notas se o repositório estiver disponível
      if (this.notaRepository) {
        promises.push(
          this.notaRepository.copiarNotas(alunoId, turmaOrigemId, turmaDestinoId)
        );
      }

      // Copiar frequências se o repositório estiver disponível
      if (this.frequenciaRepository) {
        promises.push(
          this.frequenciaRepository.copiarFrequencias(alunoId, turmaOrigemId, turmaDestinoId)
        );
      }

      // Executar cópias em paralelo
      await Promise.all(promises);

      console.log(`✅ Dados acadêmicos copiados para aluno ${alunoId}`);

    } catch (error) {
      console.error('❌ Erro ao copiar dados acadêmicos:', error);
      // Não bloquear a operação principal por erro na cópia
      throw error;
    }
  }
}