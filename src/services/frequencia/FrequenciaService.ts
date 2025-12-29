import { IFrequenciaRepository } from '../../repositories/IFrequenciaRepository';
import { Frequencia } from '../../models/Frequencia';

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

  async copiarFrequencias(alunoId: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    await this.frequenciaRepository.copiarFrequencias(alunoId, turmaOrigemId, turmaDestinoId);
  }

  async calcularPercentualPresenca(alunoId: string, turmaId: string): Promise<number> {
    const frequencias = await this.listarPorAlunoETurma(alunoId, turmaId);
    
    if (frequencias.length === 0) return 0;

    const presencas = frequencias.filter(f => f.presenca).length;
    return (presencas / frequencias.length) * 100;
  }
}
