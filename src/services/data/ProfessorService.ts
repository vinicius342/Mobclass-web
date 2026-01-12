import { Professor } from '../../models/Professor';
import { IProfessorRepository } from '../../repositories/professor/IProfessorRepository';

export class ProfessorService {
  constructor(private professorRepository: IProfessorRepository) {}

  async listar(): Promise<Professor[]> {
    return this.professorRepository.findAll();
  }

  async buscarPorId(id: string): Promise<Professor | null> {
    return this.professorRepository.findById(id);
  }

  async criar(professor: Omit<Professor, 'id'>): Promise<string> {
    return this.professorRepository.create(professor);
  }

  async atualizar(id: string, professor: Partial<Omit<Professor, 'id'>>): Promise<void> {
    return this.professorRepository.update(id, professor);
  }

  async excluir(id: string): Promise<void> {
    return this.professorRepository.delete(id);
  }
}
