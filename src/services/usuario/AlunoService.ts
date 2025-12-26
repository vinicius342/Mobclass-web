import { IAlunoRepository } from '../../repositories/IAlunoRepository';
import { Aluno } from '../../models/Aluno';

export class AlunoService {
  constructor(private alunoRepository: IAlunoRepository) { }

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
}