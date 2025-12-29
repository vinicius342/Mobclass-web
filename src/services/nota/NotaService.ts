import { INotaRepository } from '../../repositories/INotaRepository';
import { Nota } from '../../models/Nota';

export class NotaService {
  constructor(private notaRepository: INotaRepository) { }

  async listarPorAluno(alunoUid: string): Promise<Nota[]> {
    return this.notaRepository.findByAlunoUid(alunoUid);
  }

  async listarPorAlunoETurma(alunoUid: string, turmaId: string): Promise<Nota[]> {
    return this.notaRepository.findByAlunoUidETurma(alunoUid, turmaId);
  }

  async listarPorTurma(turmaId: string): Promise<Nota[]> {
    return this.notaRepository.findByTurmaId(turmaId);
  }

  async copiarNotas(alunoUid: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    await this.notaRepository.copiarNotas(alunoUid, turmaOrigemId, turmaDestinoId);
  }

  async calcularMediaFinalAluno(alunoUid: string, turmaId: string): Promise<number | null> {
    const notas = await this.listarPorAlunoETurma(alunoUid, turmaId);

    if (notas.length === 0) return null;

    // Calcula média das notas globais
    const notasValidas = notas
      .map(n => n.notaGlobal)
      .filter((nota): nota is number => nota !== null && nota !== undefined);

    if (notasValidas.length === 0) return null;

    const soma = notasValidas.reduce((acc, nota) => acc + nota, 0);
    return soma / notasValidas.length;
  }
}