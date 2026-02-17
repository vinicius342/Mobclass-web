import { Aluno } from '../../models/Aluno';
// URL da Cloud Function unificada mobclassApi
const MOBCLASS_API_URL =
  'https://mobclassapi-3ohr3pb77q-uc.a.run.app';

type AlunoFunctionAction =
  | 'listar'
  | 'buscarPorId'
  | 'promoverAluno'
  | 'reprovarAluno'
  | 'transferirAluno'
  | 'listarPorTurma'
  | 'listarPorTurmas'
  | 'listarPorTurmaSimplificado'
  | 'listarPorTurmasSimplificado'
  | 'listarPorTurmaEAnoLetivo'
  | 'atualizar'
  | 'updateHistorico'
  | 'calcularStatusAluno'
  | 'calcularStatusAlunosEmLote'
  | 'copiarDadosAcademicos';

export class AlunoService {
  // Mantemos um construtor flexível para compatibilidade com chamadas existentes,
  // mas os parâmetros são ignorados, pois o acesso aos dados agora é via Cloud Function.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(..._args: any[]) {}

  private async postAlunoFunction<T = any>(
    action: AlunoFunctionAction,
    payload: any,
    defaultErrorMessage: string,
  ): Promise<T> {
    const response = await fetch(MOBCLASS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'aluno', action, ...payload }),
    });

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      throw new Error((result && result.message) || defaultErrorMessage);
    }

    return result as T;
  }

  async listar(): Promise<Aluno[]> {
    return this.postAlunoFunction<Aluno[]>(
      'listar',
      {},
      'Erro ao listar alunos',
    );
  }

  async buscarPorId(id: string): Promise<Aluno | null> {
    return this.postAlunoFunction<Aluno | null>(
      'buscarPorId',
      { id },
      'Erro ao buscar aluno',
    );
  }

  async promoverAluno(id: string, anoAtual: string, anoDestino: string, turmaId: string) {
    await this.postAlunoFunction(
      'promoverAluno',
      { id, anoAtual, anoDestino, turmaId },
      'Erro ao promover aluno',
    );
  }

  async reprovarAluno(id: string, anoAtual: string, anoDestino: string, turmaId: string) {
    await this.postAlunoFunction(
      'reprovarAluno',
      { id, anoAtual, anoDestino, turmaId },
      'Erro ao reprovar aluno',
    );
  }

  async transferirAluno(id: string, anoAtual: string, anoDestino: string, turmaId: string) {
    await this.postAlunoFunction(
      'transferirAluno',
      { id, anoAtual, anoDestino, turmaId },
      'Erro ao transferir aluno',
    );
  }

  async listarPorTurma(turmaId: string): Promise<Aluno[]> {
    return this.postAlunoFunction<Aluno[]>(
      'listarPorTurma',
      { turmaId },
      'Erro ao listar alunos por turma',
    );
  }

  async listarPorTurmas(turmaIds: string[]): Promise<Aluno[]> {
    return this.postAlunoFunction<Aluno[]>(
      'listarPorTurmas',
      { turmaIds },
      'Erro ao listar alunos por turmas',
    );
  }

  // Método otimizado que retorna apenas id, nome e status (para telas de frequência)
  async listarPorTurmaSimplificado(turmaId: string): Promise<Pick<Aluno, 'id' | 'nome' | 'status'>[]> {
    return this.postAlunoFunction<Pick<Aluno, 'id' | 'nome' | 'status'>[]>(
      'listarPorTurmaSimplificado',
      { turmaId },
      'Erro ao listar alunos por turma',
    );
  }

  // Método otimizado que retorna apenas id, nome, status e turmaId de múltiplas turmas (para filtros)
  async listarPorTurmasSimplificado(turmaIds: string[]): Promise<Pick<Aluno, 'id' | 'nome' | 'status' | 'turmaId'>[]> {
    return this.postAlunoFunction<Pick<Aluno, 'id' | 'nome' | 'status' | 'turmaId'>[]>(
      'listarPorTurmasSimplificado',
      { turmaIds },
      'Erro ao listar alunos por turmas',
    );
  }

  async listarPorTurmaEAnoLetivo(turmaId: string, anoLetivo: string): Promise<Aluno[]> {
    return this.postAlunoFunction<Aluno[]>(
      'listarPorTurmaEAnoLetivo',
      { turmaId, anoLetivo },
      'Erro ao listar alunos por turma/ano letivo',
    );
  }

  async atualizar(id: string, aluno: Partial<Omit<Aluno, 'id'>>): Promise<void> {
    await this.postAlunoFunction(
      'atualizar',
      { id, aluno },
      'Erro ao atualizar aluno',
    );
  }

  async updateHistorico(
    id: string,
    anoAtual: string,
    anoDestino: string,
    turmaId: string,
    status: 'promovido' | 'reprovado' | 'transferido'
  ) {
    await this.postAlunoFunction(
      'updateHistorico',
      { id, anoAtual, anoDestino, turmaId, status },
      'Erro ao atualizar histórico do aluno',
    );
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
    try {
      const turmaId = this.obterTurmaDoAno(aluno, anoLetivo);

      const result = await this.postAlunoFunction<{ status: string }>(
        'calcularStatusAluno',
        { alunoId: aluno.id, turmaId, anoLetivo },
        'Erro ao calcular status do aluno',
      );

      return result.status || 'Em Andamento';
    } catch (error) {
      console.error('Erro ao calcular status do aluno:', error);
      return 'Em Andamento';
    }
  }

  /**
   * Calcula o status de vários alunos em uma única chamada ao backend
   * Retorna um mapa alunoId -> status
   */
  async calcularStatusAlunosEmLote(
    alunos: Aluno[],
    anoLetivo: number,
  ): Promise<Record<string, string>> {
    try {
      const itens = alunos.map((aluno) => ({
        alunoId: aluno.id,
        turmaId: this.obterTurmaDoAno(aluno, anoLetivo),
        anoLetivo,
      }));

      const result = await this.postAlunoFunction<{ resultados: Record<string, string> }>(
        'calcularStatusAlunosEmLote',
        { itens },
        'Erro ao calcular status dos alunos em lote',
      );

      return result.resultados || {};
    } catch (error) {
      console.error('Erro ao calcular status dos alunos em lote:', error);
      // Em caso de erro, retornamos todos como "Em Andamento" para não quebrar a tela
      const fallback: Record<string, string> = {};
      alunos.forEach((aluno) => {
        fallback[aluno.id] = 'Em Andamento';
      });
      return fallback;
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
    try {
      await this.postAlunoFunction(
        'copiarDadosAcademicos',
        { alunoId, turmaOrigemId, turmaDestinoId },
        'Erro ao copiar dados acadêmicos do aluno',
      );

      console.log(`✅ Dados acadêmicos copiados para aluno ${alunoId}`);
    } catch (error) {
      console.error('❌ Erro ao copiar dados acadêmicos:', error);
      throw error;
    }
  }
}