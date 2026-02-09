import { Frequencia } from '../../models/Frequencia';

// URL da Cloud Function unificada mobclassApi
const MOBCLASS_API_URL =
  'https://mobclassapi-3ohr3pb77q-uc.a.run.app';

type FrequenciaFunctionAction =
  | 'listar'
  | 'buscarPorId'
  | 'listarPorAluno'
  | 'listarPorAlunoETurma'
  | 'listarPorTurma'
  | 'buscarPorPeriodo'
  | 'buscarPorAlunoIdEPeriodo'
  | 'salvarFrequencias'
  | 'copiarFrequencias';

export class FrequenciaService {
  constructor() {}

  private async postFrequenciaFunction<T = any>(
    action: FrequenciaFunctionAction,
    payload: any,
    defaultErrorMessage: string,
  ): Promise<T> {
    const response = await fetch(MOBCLASS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'frequencia', action, ...payload }),
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

  async listar(): Promise<Frequencia[]> {
    return this.postFrequenciaFunction<Frequencia[]>(
      'listar',
      {},
      'Erro ao listar frequências',
    );
  }

  async listarPorAluno(alunoId: string): Promise<Frequencia[]> {
    return this.postFrequenciaFunction<Frequencia[]>(
      'listarPorAluno',
      { alunoId },
      'Erro ao listar frequências do aluno',
    );
  }

  async listarPorAlunoETurma(alunoId: string, turmaId: string): Promise<Frequencia[]> {
    return this.postFrequenciaFunction<Frequencia[]>(
      'listarPorAlunoETurma',
      { alunoId, turmaId },
      'Erro ao listar frequências do aluno na turma',
    );
  }

  async listarPorTurma(turmaId: string): Promise<Frequencia[]> {
    return this.postFrequenciaFunction<Frequencia[]>(
      'listarPorTurma',
      { turmaId },
      'Erro ao listar frequências da turma',
    );
  }

  async buscarPorPeriodo(dataInicio: string, dataFim: string): Promise<Frequencia[]> {
    return this.postFrequenciaFunction<Frequencia[]>(
      'buscarPorPeriodo',
      { dataInicio, dataFim },
      'Erro ao buscar frequências por período',
    );
  }

  async copiarFrequencias(alunoId: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    await this.postFrequenciaFunction(
      'copiarFrequencias',
      { alunoId, turmaOrigemId, turmaDestinoId },
      'Erro ao copiar frequências',
    );
  }

  async buscarPorAlunoIdEPeriodo(alunoId: string, dataInicio: string, dataFim: string): Promise<Frequencia[]> {
    return this.postFrequenciaFunction<Frequencia[]>(
      'buscarPorAlunoIdEPeriodo',
      { alunoId, dataInicio, dataFim },
      'Erro ao buscar frequências do aluno por período',
    );
  }

  async salvarFrequencias(frequencias: Omit<Frequencia, 'id'>[]): Promise<void> {
    await this.postFrequenciaFunction(
      'salvarFrequencias',
      { frequencias },
      'Erro ao salvar frequências',
    );
  }

  async calcularPercentualPresenca(alunoId: string, turmaId: string): Promise<number> {
    const frequencias = await this.listarPorAlunoETurma(alunoId, turmaId);
    
    if (frequencias.length === 0) return 0;

    const presencas = frequencias.filter(f => f.presenca).length;
    return (presencas / frequencias.length) * 100;
  }

  calcularTaxasPorTurma(
    frequencias: Frequencia[], 
    turmas: { id: string; nome: string }[],
    filtros?: {
      materiaId?: string;
      periodo?: {
        tipo: 'hoje' | 'mes' | 'personalizado';
        data?: string;
        mes?: string;
        ano?: number; // Adicionar ano letivo
      };
    }
  ): { turma: string; taxa: number }[] {
    return turmas.map(turma => {
      let turmaFreq = frequencias.filter(f => f.turmaId === turma.id);

      // Filtrar por disciplina se especificada
      if (filtros?.materiaId && filtros.materiaId !== 'todas') {
        turmaFreq = turmaFreq.filter(f => f.materiaId === filtros.materiaId);
      }

      // Filtrar por período
      if (filtros?.periodo) {
        const { tipo, data, mes, ano } = filtros.periodo;
        
        if (tipo === 'hoje') {
          const hoje = new Date().toISOString().split('T')[0];
          turmaFreq = turmaFreq.filter(f => f.data === hoje);
        } else if (tipo === 'mes' && mes) {
          const anoFiltro = ano || new Date().getFullYear();
          turmaFreq = turmaFreq.filter(f => {
            if (!f.data) return false;
            const dataFreq = new Date(f.data);
            return dataFreq.getFullYear() === anoFiltro &&
              (dataFreq.getMonth() + 1).toString().padStart(2, '0') === mes;
          });
        } else if (tipo === 'personalizado' && data) {
          turmaFreq = turmaFreq.filter(f => f.data === data);
        }
      }

      const total = turmaFreq.length;
      const presentes = turmaFreq.filter(f => f.presenca).length;
      const taxa = total ? (presentes / total) * 100 : 0;
      
      return { turma: turma.nome, taxa: parseFloat(taxa.toFixed(2)) };
    });
  }

  agruparPorDiaSemana(
    frequencias: Frequencia[],
    diasPt: Record<string, string>
  ): Array<{ dia: string; presencas: number; faltas: number; taxa: number }> {
    const freqPorDia: Record<string, { presencas: number; faltas: number }> = {};

    frequencias.forEach(f => {
      try {
        const [ano, mes, dia] = f.data.split('-').map(Number);
        const data = new Date(ano, mes - 1, dia);
        const diaSemanaEn = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(data);
        const diaSemana = diasPt[diaSemanaEn] || 'Outro';

        if (!freqPorDia[diaSemana]) {
          freqPorDia[diaSemana] = { presencas: 0, faltas: 0 };
        }
        
        if (f.presenca) {
          freqPorDia[diaSemana].presencas++;
        } else {
          freqPorDia[diaSemana].faltas++;
        }
      } catch {
        // Ignora datas inválidas
      }
    });

    const diasOrdem = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
    
    return Object.entries(freqPorDia)
      .map(([dia, dados]) => ({
        dia,
        presencas: dados.presencas,
        faltas: dados.faltas,
        taxa: (dados.presencas + dados.faltas) > 0 
          ? (dados.presencas / (dados.presencas + dados.faltas)) * 100 
          : 0
      }))
      .sort((a, b) => diasOrdem.indexOf(a.dia) - diasOrdem.indexOf(b.dia));
  }

  async listarPorTurmaMateria(turmaId: string, materiaId: string, data: string): Promise<Frequencia[]> {
    const frequencias = await this.listar();
    return frequencias.filter(f => 
      f.turmaId === turmaId && 
      f.materiaId === materiaId && 
      f.data === data
    );
  }

  inicializarAttendance(alunos: Array<{ id: string; nome: string }>, frequencias: Frequencia[]): Record<string, boolean | null> {
    const initial: Record<string, boolean | null> = {};
    alunos.forEach(aluno => {
      const freq = frequencias.find(f => f.alunoId === aluno.id);
      initial[aluno.id] = freq ? freq.presenca : null;
    });
    return initial;
  }

  mapearJustificativas(frequencias: Frequencia[]): Record<string, string> {
    const map: Record<string, string> = {};
    frequencias.forEach(f => {
      if (f.observacao) {
        map[f.alunoId] = f.observacao;
      }
    });
    return map;
  }

  marcarTodosPresentes(alunos: Array<{ id: string; nome: string }>): Array<{ alunoId: string; presenca: boolean }> {
    return alunos.map(a => ({ alunoId: a.id, presenca: true }));
  }

  marcarTodosAusentes(alunos: Array<{ id: string; nome: string }>): Array<{ alunoId: string; presenca: boolean }> {
    return alunos.map(a => ({ alunoId: a.id, presenca: false }));
  }

  prepararFrequenciasComJustificativas(
    alunos: Array<{ id: string; nome: string }>,
    turmaId: string,
    materiaId: string,
    data: string,
    professorId: string,
    attendance: Record<string, boolean | null>,
    justificativas: Record<string, string>
  ): Omit<Frequencia, 'id'>[] {
    return alunos
      .filter(a => attendance[a.id] !== null)
      .map(a => {
        const baseData = {
          alunoId: a.id,
          turmaId,
          materiaId,
          data,
          presenca: attendance[a.id] ?? false,
          professorId
        };
        
        // Só adiciona observacao se existir, para evitar undefined no Firestore
        if (justificativas[a.id]) {
          return { ...baseData, observacao: justificativas[a.id] };
        }
        
        return baseData;
      });
  }

  calcularEstatisticas(frequencias: Array<{ presenca: boolean | null }>): {
    totalAlunos: number;
    totalPresentes: number;
    totalAusentes: number;
    percentualPresenca: number;
    percentualAusencia: number;
  } {
    const totalAlunos = frequencias.length;
    const totalPresentes = frequencias.filter(f => f.presenca === true).length;
    const totalAusentes = frequencias.filter(f => f.presenca === false).length;
    
    return {
      totalAlunos,
      totalPresentes,
      totalAusentes,
      percentualPresenca: totalAlunos > 0 ? (totalPresentes / totalAlunos) * 100 : 0,
      percentualAusencia: totalAlunos > 0 ? (totalAusentes / totalAlunos) * 100 : 0
    };
  }

  filtrarAlunosPorNome(
    alunos: Array<{ id: string; nome: string }>,
    frequencias: Array<{ alunoId: string; presenca: boolean | null }>,
    busca: string,
    filtroTipo: 'todos' | 'presentes' | 'ausentes'
  ): Array<{ id: string; nome: string }> {
    let filtrados = alunos;

    // Filtrar por tipo
    if (filtroTipo === 'presentes') {
      filtrados = filtrados.filter(a => {
        const freq = frequencias.find(f => f.alunoId === a.id);
        return freq?.presenca === true;
      });
    } else if (filtroTipo === 'ausentes') {
      filtrados = filtrados.filter(a => {
        const freq = frequencias.find(f => f.alunoId === a.id);
        return freq?.presenca === false;
      });
    }

    // Filtrar por nome
    if (busca.trim()) {
      filtrados = filtrados.filter(a => 
        a.nome.toLowerCase().includes(busca.toLowerCase())
      );
    }

    return filtrados;
  }

  calcularEstatisticasGerais(frequencias: Frequencia[]): {
    presencaPercentual: number;
    ausenciaPercentual: number;
    totalPresencas: number;
    totalAusencias: number;
    total: number;
  } {
    const total = frequencias.length;
    const totalPresencas = frequencias.filter(f => f.presenca === true).length;
    const totalAusencias = frequencias.filter(f => f.presenca === false).length;
    
    return {
      presencaPercentual: total > 0 ? (totalPresencas / total) * 100 : 0,
      ausenciaPercentual: total > 0 ? (totalAusencias / total) * 100 : 0,
      totalPresencas,
      totalAusencias,
      total
    };
  }

  calcularTopAlunosPresenca(
    frequencias: Frequencia[],
    alunos: Array<{ id: string; nome: string }>,
    limite: number
  ): Array<{ nome: string; percentual: number }> {
    const resumosPorAluno = alunos.map(aluno => {
      const freqAluno = frequencias.filter(f => f.alunoId === aluno.id);
      const total = freqAluno.length;
      const presencas = freqAluno.filter(f => f.presenca === true).length;
      const percentual = total > 0 ? (presencas / total) * 100 : 0;
      
      return {
        nome: aluno.nome,
        percentual: parseFloat(percentual.toFixed(2))
      };
    });

    return resumosPorAluno
      .sort((a, b) => b.percentual - a.percentual)
      .slice(0, limite);
  }

  calcularResumosPorAluno(
    alunos: Array<{ id: string; nome: string; matricula?: string }>,
    frequencias: Frequencia[]
  ): Array<{
    aluno: { id: string; nome: string };
    presencas: number;
    faltas: number;
    percentual: number;
  }> {
    return alunos.map(aluno => {
      const freqAluno = frequencias.filter(f => f.alunoId === aluno.id);
      const presencas = freqAluno.filter(f => f.presenca === true).length;
      const faltas = freqAluno.filter(f => f.presenca === false).length;
      const total = freqAluno.length;
      const percentual = total > 0 ? (presencas / total) * 100 : 0;

      return {
        aluno: { id: aluno.id, nome: aluno.nome },
        presencas,
        faltas,
        percentual: parseFloat(percentual.toFixed(2))
      };
    });
  }

  ordenarResumos(
    resumos: Array<{
      aluno: { id: string; nome: string };
      presencas: number;
      faltas: number;
      percentual: number;
    }>,
    criterio: 'nome' | 'presencas' | 'faltas' | 'percentual'
  ): Array<{
    aluno: { id: string; nome: string };
    presencas: number;
    faltas: number;
    percentual: number;
  }> {
    return [...resumos].sort((a, b) => {
      switch (criterio) {
        case 'nome':
          return a.aluno.nome.localeCompare(b.aluno.nome);
        case 'presencas':
          return b.presencas - a.presencas;
        case 'faltas':
          return b.faltas - a.faltas;
        case 'percentual':
          return b.percentual - a.percentual;
        default:
          return 0;
      }
    });
  }

  calcularHistoricoPorBimestre(
    frequencias: Frequencia[],
    aluno: { id: string; nome: string },
    anoLetivo: number
  ): Array<{
    bimestre: string;
    presencas: number;
    ausencias: number;
    percentual: number;
  }> {
    const bimestres = [
      { nome: '1º Bimestre', inicio: new Date(anoLetivo, 0, 1), fim: new Date(anoLetivo, 2, 31) },
      { nome: '2º Bimestre', inicio: new Date(anoLetivo, 3, 1), fim: new Date(anoLetivo, 5, 30) },
      { nome: '3º Bimestre', inicio: new Date(anoLetivo, 6, 1), fim: new Date(anoLetivo, 8, 30) },
      { nome: '4º Bimestre', inicio: new Date(anoLetivo, 9, 1), fim: new Date(anoLetivo, 11, 31) }
    ];

    const freqAluno = frequencias.filter(f => f.alunoId === aluno.id);

    return bimestres.map(bim => {
      const freqBimestre = freqAluno.filter(f => {
        const dataFreq = new Date(f.data);
        return dataFreq >= bim.inicio && dataFreq <= bim.fim;
      });

      const presencas = freqBimestre.filter(f => f.presenca === true).length;
      const ausencias = freqBimestre.filter(f => f.presenca === false).length;
      const total = freqBimestre.length;
      const percentual = total > 0 ? (presencas / total) * 100 : 0;

      return {
        bimestre: bim.nome,
        presencas,
        ausencias,
        percentual: parseFloat(percentual.toFixed(2))
      };
    });
  }
}
