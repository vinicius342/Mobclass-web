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
        const { tipo, data, mes } = filtros.periodo;
        
        if (tipo === 'hoje') {
          const hoje = new Date().toISOString().split('T')[0];
          turmaFreq = turmaFreq.filter(f => f.data === hoje);
        } else if (tipo === 'mes' && mes) {
          const anoAtual = new Date().getFullYear();
          turmaFreq = turmaFreq.filter(f => {
            if (!f.data) return false;
            const dataFreq = new Date(f.data);
            return dataFreq.getFullYear() === anoAtual &&
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
}

