import { IProfessorMateriaRepository } from '../../repositories/professor_materia/IProfessorMateriaRepository';
import { ProfessorMateria } from '../../models/ProfessorMateria';

export class ProfessorMateriaService {
  constructor(private professorMateriaRepository: IProfessorMateriaRepository) {}

  async listar(): Promise<ProfessorMateria[]> {
    return this.professorMateriaRepository.findAll();
  }

  async buscarPorId(id: string): Promise<ProfessorMateria | null> {
    return this.professorMateriaRepository.findById(id);
  }

  async criar(professorMateria: Omit<ProfessorMateria, 'id'>): Promise<string> {
    return this.professorMateriaRepository.create(professorMateria);
  }

  async atualizar(
    id: string,
    professorMateria: Partial<Omit<ProfessorMateria, 'id'>>
  ): Promise<void> {
    await this.professorMateriaRepository.update(id, professorMateria);
  }

  async excluir(id: string): Promise<void> {
    await this.professorMateriaRepository.delete(id);
  }

  async listarPorProfessor(professorId: string): Promise<ProfessorMateria[]> {
    return this.professorMateriaRepository.findByProfessorId(professorId);
  }

  async listarPorMateria(materiaId: string): Promise<ProfessorMateria[]> {
    return this.professorMateriaRepository.findByMateriaId(materiaId);
  }

  async listarPorTurma(turmaId: string): Promise<ProfessorMateria[]> {
    return this.professorMateriaRepository.findByTurmaId(turmaId);
  }

  async buscarVinculoEspecifico(
    professorId: string,
    materiaId: string,
    turmaId: string
  ): Promise<ProfessorMateria | null> {
    return this.professorMateriaRepository.findByProfessorMateriaETurma(
      professorId,
      materiaId,
      turmaId
    );
  }

  async copiarVinculos(turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    await this.professorMateriaRepository.copiarVinculos(turmaOrigemId, turmaDestinoId);
  }

  /**
   * Verifica se um professor está vinculado a uma matéria em uma turma
   */
  async professorLecionaMateriaNaTurma(
    professorId: string,
    materiaId: string,
    turmaId: string
  ): Promise<boolean> {
    const vinculo = await this.buscarVinculoEspecifico(professorId, materiaId, turmaId);
    return vinculo !== null;
  }

  /**
   * Obtém todas as matérias que um professor leciona em uma turma
   */
  async listarMateriasDoProfessorNaTurma(
    professorId: string,
    turmaId: string
  ): Promise<string[]> {
    const vinculos = await this.professorMateriaRepository.findAll();
    return vinculos
      .filter(v => v.professorId === professorId && v.turmaId === turmaId)
      .map(v => v.materiaId);
  }

  /**
   * Obtém todos os professores que lecionam uma matéria em uma turma
   */
  async listarProfessoresDaMateriaNaTurma(
    materiaId: string,
    turmaId: string
  ): Promise<string[]> {
    const vinculos = await this.professorMateriaRepository.findAll();
    return vinculos
      .filter(v => v.materiaId === materiaId && v.turmaId === turmaId)
      .map(v => v.professorId);
  }

  /**
   * Obtém os IDs das matérias vinculadas a uma turma (útil para filtrar dropdowns)
   */
  obterMateriaIdsDaTurma(vinculos: ProfessorMateria[], turmaId: string): string[] {
    return vinculos
      .filter(v => v.turmaId === turmaId)
      .map(v => v.materiaId);
  }
}
