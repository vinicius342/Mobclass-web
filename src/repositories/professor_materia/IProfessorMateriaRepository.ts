import { ProfessorMateria } from '../../models/ProfessorMateria';

/**
 * Interface do repositório para gerenciar vínculos entre Professores e Matérias
 */
export interface IProfessorMateriaRepository {
  /**
   * Busca todos os vínculos
   */
  findAll(): Promise<ProfessorMateria[]>;

  /**
   * Busca um vínculo por ID
   */
  findById(id: string): Promise<ProfessorMateria | null>;

  /**
   * Cria um novo vínculo
   */
  create(professorMateria: Omit<ProfessorMateria, 'id'>): Promise<string>;

  /**
   * Atualiza um vínculo existente
   */
  update(id: string, professorMateria: Partial<Omit<ProfessorMateria, 'id'>>): Promise<void>;

  /**
   * Remove um vínculo
   */
  delete(id: string): Promise<void>;

  /**
   * Busca vínculos por professor
   */
  findByProfessorId(professorId: string): Promise<ProfessorMateria[]>;

  /**
   * Busca vínculos por matéria
   */
  findByMateriaId(materiaId: string): Promise<ProfessorMateria[]>;

  /**
   * Busca vínculos por turma
   */
  findByTurmaId(turmaId: string): Promise<ProfessorMateria[]>;

  /**
   * Busca vínculo específico por professor, matéria e turma
   */
  findByProfessorMateriaETurma(
    professorId: string,
    materiaId: string,
    turmaId: string
  ): Promise<ProfessorMateria | null>;

  /**
   * Copia vínculos de uma turma para outra
   */
  copiarVinculos(turmaOrigemId: string, turmaDestinoId: string): Promise<void>;
}
