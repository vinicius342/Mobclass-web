/**
 * Model para representar a relação entre Professor e Matéria em uma Turma
 * Corresponde à coleção 'professores_materias' no Firebase
 */
export interface ProfessorMateria {
  id: string;
  professorId: string;
  materiaId: string;
  turmaId: string;
}
