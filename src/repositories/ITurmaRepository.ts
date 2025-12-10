import { Turma } from '../models/Turma';

export interface ITurmaRepository {
  findAll(): Promise<Turma[]>;
  findById(id: string): Promise<Turma | null>;
  create(turma: Omit<Turma, 'id' | 'turmaOriginalId'>): Promise<string>;
  update(id: string, turma: Partial<Omit<Turma, 'id' | 'turmaOriginalId'>>): Promise<void>;
  delete(id: string): Promise<void>;
}