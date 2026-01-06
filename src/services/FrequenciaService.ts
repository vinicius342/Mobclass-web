import { Frequencia } from '../models/Frequencia';
import { IFrequenciaRepository } from '../repositories/frequencia/IFrequenciaRepository';

interface EstatisticasFrequencia {
  totalPresentes: number;
  totalAusentes: number;
  totalNaoRegistrado: number;
  totalAlunos: number;
  percentualPresenca: number;
  percentualAusencia: number;
}

interface DadosAluno {
  id: string;
  nome: string;
}

export class FrequenciaService {
  constructor(private frequenciaRepository: IFrequenciaRepository) {}

  async listarPorAluno(alunoId: string): Promise<Frequencia[]> {
    return this.frequenciaRepository.findByAlunoId(alunoId);
  }

  async listarPorAlunoETurma(alunoId: string, turmaId: string): Promise<Frequencia[]> {
    return this.frequenciaRepository.findByAlunoIdETurma(alunoId, turmaId);
  }

  async listarPorTurma(turmaId: string): Promise<Frequencia[]> {
    return this.frequenciaRepository.findByTurmaId(turmaId);
  }

  async listarPorTurmaMateria(turmaId: string, materiaId: string, data: string): Promise<Frequencia[]> {
    return this.frequenciaRepository.findByTurmaMateria(turmaId, materiaId, data);
  }

  async buscarPorId(id: string): Promise<Frequencia | null> {
    return this.frequenciaRepository.findById(id);
  }

  async buscarPorPeriodo(dataInicio: string, dataFim: string): Promise<Frequencia[]> {
    return this.frequenciaRepository.findByPeriodo(dataInicio, dataFim);
  }

  async buscarPorAlunoIdEPeriodo(alunoId: string, dataInicio: string, dataFim: string): Promise<Frequencia[]> {
    return this.frequenciaRepository.findByAlunoIdEPeriodo(alunoId, dataInicio, dataFim);
  }

  async salvarFrequencias(frequencias: Omit<Frequencia, 'id'>[]): Promise<void> {
    return this.frequenciaRepository.salvarEmLote(frequencias);
  }

  async copiarFrequencias(alunoId: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    return this.frequenciaRepository.copiarFrequencias(alunoId, turmaOrigemId, turmaDestinoId);
  }

  calcularEstatisticas(frequencias: Frequencia[]): EstatisticasFrequencia {
    const totalAlunos = frequencias.length;
    const totalPresentes = frequencias.filter(f => f.presenca === true).length;
    const totalAusentes = frequencias.filter(f => f.presenca === false).length;
    const totalNaoRegistrado = frequencias.filter(f => f.presenca === null).length;
    
    const percentualPresenca = totalAlunos > 0 
      ? Math.round((totalPresentes / totalAlunos) * 100) 
      : 0;
    
    const percentualAusencia = totalAlunos > 0 
      ? Math.round((totalAusentes / totalAlunos) * 100) 
      : 0;

    return {
      totalPresentes,
      totalAusentes,
      totalNaoRegistrado,
      totalAlunos,
      percentualPresenca,
      percentualAusencia
    };
  }

  filtrarPorPresenca(frequencias: Frequencia[], filtro: 'presentes' | 'ausentes' | 'nao-registrado' | 'todos'): Frequencia[] {
    if (filtro === 'todos') {
      return frequencias;
    }
    
    if (filtro === 'presentes') {
      return frequencias.filter(f => f.presenca === true);
    }
    
    if (filtro === 'ausentes') {
      return frequencias.filter(f => f.presenca === false);
    }
    
    if (filtro === 'nao-registrado') {
      return frequencias.filter(f => f.presenca === null);
    }
    
    return frequencias;
  }

  filtrarAlunosPorNome(
    alunos: DadosAluno[], 
    frequencias: Frequencia[], 
    termoBusca: string,
    filtroPresenca: 'presentes' | 'ausentes' | 'nao-registrado' | 'todos'
  ): DadosAluno[] {
    let alunosFiltrados = alunos;

    // Filtrar por nome
    if (termoBusca.trim()) {
      const termo = termoBusca.toLowerCase().trim();
      alunosFiltrados = alunosFiltrados.filter(aluno =>
        aluno.nome.toLowerCase().includes(termo)
      );
    }

    // Filtrar por presença
    if (filtroPresenca !== 'todos') {
      const frequenciasFiltradas = this.filtrarPorPresenca(frequencias, filtroPresenca);
      const idsComFiltro = new Set(frequenciasFiltradas.map(f => f.alunoId));
      alunosFiltrados = alunosFiltrados.filter(aluno => idsComFiltro.has(aluno.id));
    }

    return alunosFiltrados;
  }

  validarFrequencia(frequencia: Omit<Frequencia, 'id'>): string[] {
    const erros: string[] = [];

    if (!frequencia.alunoId?.trim()) {
      erros.push('ID do aluno é obrigatório');
    }

    if (!frequencia.turmaId?.trim()) {
      erros.push('ID da turma é obrigatório');
    }

    if (!frequencia.materiaId?.trim()) {
      erros.push('ID da matéria é obrigatório');
    }

    if (!frequencia.data?.trim()) {
      erros.push('Data é obrigatória');
    } else if (!this.isDataValida(frequencia.data)) {
      erros.push('Data em formato inválido (use yyyy-MM-dd)');
    }

    if (!frequencia.professorId?.trim()) {
      erros.push('ID do professor é obrigatório');
    }

    return erros;
  }

  private isDataValida(data: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(data)) {
      return false;
    }

    const [ano, mes, dia] = data.split('-').map(Number);
    const date = new Date(ano, mes - 1, dia);
    
    return date.getFullYear() === ano 
      && date.getMonth() === mes - 1 
      && date.getDate() === dia;
  }

  prepararFrequenciaEmLote(
    alunos: DadosAluno[],
    turmaId: string,
    materiaId: string,
    data: string,
    professorId: string,
    presencaInicial: boolean | null = null
  ): Omit<Frequencia, 'id'>[] {
    return alunos.map(aluno => ({
      alunoId: aluno.id,
      turmaId,
      materiaId,
      data,
      presenca: presencaInicial,
      professorId
    }));
  }

  marcarTodosPresentes(frequencias: Frequencia[]): Frequencia[] {
    return frequencias.map(f => ({ ...f, presenca: true }));
  }

  marcarTodosAusentes(frequencias: Frequencia[]): Frequencia[] {
    return frequencias.map(f => ({ ...f, presenca: false }));
  }

  adicionarObservacao(frequencia: Frequencia, observacao: string): Frequencia {
    return { ...frequencia, observacao };
  }

  /**
   * Mapeia frequências para um objeto Record<alunoId, presenca>
   */
  mapearFrequenciasParaAttendance(frequencias: Frequencia[]): Record<string, boolean | null> {
    const presMap: Record<string, boolean | null> = {};
    frequencias.forEach(freq => {
      presMap[freq.alunoId] = freq.presenca;
    });
    return presMap;
  }

  /**
   * Mapeia frequências para um objeto Record<alunoId, observacao>
   */
  mapearJustificativas(frequencias: Frequencia[]): Record<string, string> {
    const justificativasMap: Record<string, string> = {};
    frequencias.forEach(freq => {
      if (freq.observacao) {
        justificativasMap[freq.alunoId] = freq.observacao;
      }
    });
    return justificativasMap;
  }

  /**
   * Inicializa attendance para alunos baseado em frequências existentes
   */
  inicializarAttendance(
    alunos: DadosAluno[],
    frequenciasExistentes: Frequencia[]
  ): Record<string, boolean | null> {
    const presMap = this.mapearFrequenciasParaAttendance(frequenciasExistentes);
    const initial: Record<string, boolean | null> = {};
    
    alunos.forEach(a => {
      initial[a.id] = presMap[a.id] !== undefined ? presMap[a.id] : null;
    });
    
    return initial;
  }

  /**
   * Prepara frequências para salvar incluindo justificativas
   */
  prepararFrequenciasComJustificativas(
    alunos: DadosAluno[],
    turmaId: string,
    materiaId: string,
    data: string,
    professorId: string,
    attendance: Record<string, boolean | null>,
    justificativas: Record<string, string>
  ): Omit<Frequencia, 'id'>[] {
    return alunos.map(aluno => {
      const justificativa = justificativas[aluno.id];
      return {
        turmaId,
        materiaId,
        data,
        alunoId: aluno.id,
        presenca: justificativa ? false : attendance[aluno.id],
        professorId,
        observacao: justificativa || undefined
      };
    });
  }

  /**
   * Filtra frequências por período (hoje, mês, personalizado)
   */
  filtrarPorPeriodo(
    frequencias: Frequencia[],
    tipoPeriodo: 'hoje' | 'mes' | 'personalizado',
    opcoes?: { mes?: number; dataInicio?: string; dataFim?: string }
  ): Frequencia[] {
    if (tipoPeriodo === 'hoje') {
      const hoje = this.obterDataAtual();
      return frequencias.filter(f => f.data === hoje);
    }

    if (tipoPeriodo === 'mes' && opcoes?.mes !== undefined) {
      const ano = new Date().getFullYear();
      const inicio = new Date(ano, opcoes.mes, 1);
      const fim = new Date(ano, opcoes.mes + 1, 0);
      const inicioStr = this.formatarData(inicio);
      const fimStr = this.formatarData(fim);
      
      return frequencias.filter(f => f.data >= inicioStr && f.data <= fimStr);
    }

    if (tipoPeriodo === 'personalizado' && opcoes?.dataInicio && opcoes?.dataFim) {
      return frequencias.filter(
        f => f.data >= opcoes.dataInicio! && f.data <= opcoes.dataFim!
      );
    }

    return frequencias;
  }

  /**
   * Calcula top N alunos com melhor frequência
   */
  calcularTopAlunosPresenca(
    frequencias: Frequencia[],
    alunos: DadosAluno[],
    limite: number = 5
  ): Array<{ id: string; nome: string; percentual: number }> {
    const resumoPorAluno: Record<string, { nome: string; presencas: number; total: number }> = {};

    frequencias.forEach(freq => {
      const aluno = alunos.find(a => a.id === freq.alunoId);
      if (!aluno) return;

      const primeiroNome = aluno.nome.split(' ')[0];

      if (!resumoPorAluno[freq.alunoId]) {
        resumoPorAluno[freq.alunoId] = { nome: primeiroNome, presencas: 0, total: 0 };
      }

      if (freq.presenca) resumoPorAluno[freq.alunoId].presencas += 1;
      resumoPorAluno[freq.alunoId].total += 1;
    });

    return Object.entries(resumoPorAluno)
      .map(([id, { nome, presencas, total }]) => ({
        id,
        nome,
        percentual: total > 0 ? Math.round((presencas / total) * 100 * 10) / 10 : 0
      }))
      .sort((a, b) => b.percentual - a.percentual)
      .slice(0, limite);
  }

  /**
   * Calcula estatísticas gerais de frequência (para gráfico de pizza)
   */
  calcularEstatisticasGerais(frequencias: Frequencia[]): {
    presencaPercentual: number;
    ausenciaPercentual: number;
  } {
    const total = frequencias.length;
    if (total === 0) return { presencaPercentual: 0, ausenciaPercentual: 0 };

    const presencas = frequencias.filter(f => f.presenca === true).length;
    const presencaPercentual = Math.round((presencas / total) * 100 * 10) / 10;
    const ausenciaPercentual = Math.round((100 - presencaPercentual) * 10) / 10;

    return { presencaPercentual, ausenciaPercentual };
  }

  /**
   * Calcula resumo de frequência por aluno
   */
  calcularResumosPorAluno(
    alunos: DadosAluno[],
    frequencias: Frequencia[]
  ): Array<{
    aluno: DadosAluno;
    presencas: number;
    faltas: number;
    total: number;
    percentual: number;
  }> {
    return alunos.map(aluno => {
      const registrosAluno = frequencias.filter(f => f.alunoId === aluno.id);
      const presencas = registrosAluno.filter(f => f.presenca === true).length;
      const faltas = registrosAluno.filter(f => f.presenca === false).length;
      const total = registrosAluno.length;
      const percentual = total > 0 ? Math.round((presencas / total) * 100 * 10) / 10 : 0;

      return { aluno, presencas, faltas, total, percentual };
    });
  }

  /**
   * Ordena resumos de alunos por critério
   */
  ordenarResumos(
    resumos: Array<{ aluno: DadosAluno; presencas: number; faltas: number; percentual: number }>,
    criterio: 'nome' | 'presencas' | 'faltas' | 'percentual'
  ): Array<{ aluno: DadosAluno; presencas: number; faltas: number; percentual: number }> {
    const copia = [...resumos];

    if (criterio === 'nome') {
      copia.sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome));
    } else if (criterio === 'presencas') {
      copia.sort((a, b) => b.presencas - a.presencas);
    } else if (criterio === 'faltas') {
      copia.sort((a, b) => b.faltas - a.faltas);
    } else if (criterio === 'percentual') {
      copia.sort((a, b) => b.percentual - a.percentual);
    }

    return copia;
  }

  /**
   * Calcula histórico por bimestre
   */
  calcularHistoricoPorBimestre(
    frequencias: Frequencia[],
    ano: number = new Date().getFullYear()
  ): Array<{
    bimestre: string;
    presencas: number;
    faltas: number;
    total: number;
    percentual: string;
  }> {
    const bimestres = [
      { nome: '1º Bimestre', inicio: new Date(ano, 0, 1), fim: new Date(ano, 2, 31) },
      { nome: '2º Bimestre', inicio: new Date(ano, 3, 1), fim: new Date(ano, 5, 30) },
      { nome: '3º Bimestre', inicio: new Date(ano, 6, 1), fim: new Date(ano, 8, 30) },
      { nome: '4º Bimestre', inicio: new Date(ano, 9, 1), fim: new Date(ano, 11, 31) }
    ];

    return bimestres.map(bim => {
      const inicioStr = this.formatarData(bim.inicio);
      const fimStr = this.formatarData(bim.fim);

      const registrosBimestre = frequencias.filter(f => 
        f.data >= inicioStr && f.data <= fimStr
      );

      const presencas = registrosBimestre.filter(f => f.presenca === true).length;
      const faltas = registrosBimestre.filter(f => f.presenca === false).length;
      const total = registrosBimestre.length;
      const percentual = total > 0 ? ((presencas / total) * 100).toFixed(1) : '0.0';

      return {
        bimestre: bim.nome,
        presencas,
        faltas,
        total,
        percentual
      };
    });
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  private obterDataAtual(): string {
    return this.formatarData(new Date());
  }
}
