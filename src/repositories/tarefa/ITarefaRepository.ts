import { Tarefa } from '../../models/Tarefa';

export interface ITarefaRepository {
  findAll(): Promise<Tarefa[]>;
  findById(id: string): Promise<Tarefa | null>;
  create(tarefa: Omit<Tarefa, 'id'>): Promise<string>;
  update(id: string, tarefa: Partial<Omit<Tarefa, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
  findByTurmaAndMateria(turmaId: string, materiaId: string): Promise<Tarefa[]>;
  findByTurmas(turmaIds: string[]): Promise<Tarefa[]>;
}
