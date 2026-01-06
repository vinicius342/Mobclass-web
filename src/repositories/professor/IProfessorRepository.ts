import { Professor } from '../../models/Professor';

export interface IProfessorRepository {
  findAll(): Promise<Professor[]>;
  findById(id: string): Promise<Professor | null>;
  create(professor: Omit<Professor, 'id'>): Promise<string>;
  update(id: string, professor: Partial<Omit<Professor, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
}
