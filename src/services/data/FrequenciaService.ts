import { IFrequenciaRepository } from '../../repositories/frequencia/IFrequenciaRepository';
import { Frequencia } from '../../models/Frequencia';

export class FrequenciaService {
  constructor(private frequenciaRepository: IFrequenciaRepository) {}

  async listar(): Promise<Frequencia[]> {
    return this.frequenciaRepository.findAll();
  }

  async listarPorAluno(alunoId: string): Promise<Frequencia[]> {
    return this.frequenciaRepository.findByAlunoId(alunoId);
  }

  async listarPorAlunoETurma(alunoId: string, turmaId: string): Promise<Frequencia[]> {
    return this.frequenciaRepository.findByAlunoIdETurma(alunoId, turmaId);
  }

  async listarPorTurma(turmaId: string): Promise<Frequencia[]> {
    return this.frequenciaRepository.findByTurmaId(turmaId);
  }

  async copiarFrequencias(alunoId: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    await this.frequenciaRepository.copiarFrequencias(alunoId, turmaOrigemId, turmaDestinoId);
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
    const frequencias = await this.frequenciaRepository.findAll();
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
      .map(a => ({
        alunoId: a.id,
        turmaId,
        materiaId,
        data,
        presenca: attendance[a.id] ?? false,
        professorId,
        observacao: justificativas[a.id] || undefined
      }));
  }

  async salvarFrequencias(frequencias: Omit<Frequencia, 'id'>[]): Promise<void> {
    for (const freq of frequencias) {
      const existentes = await this.listarPorTurmaMateria(freq.turmaId, freq.materiaId, freq.data);
      const existente = existentes.find(f => f.alunoId === freq.alunoId);
      
      if (existente) {
        await this.frequenciaRepository.update(existente.id, freq);
      } else {
        await this.frequenciaRepository.create(freq);
      }
    }
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
}
