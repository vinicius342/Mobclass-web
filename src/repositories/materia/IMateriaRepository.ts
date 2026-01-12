import { Materia } from '../../models/Materia';

export interface IMateriaRepository {
  findAll(): Promise<Materia[]>;
  findById(id: string): Promise<Materia | null>;
  create(materia: Omit<Materia, 'id'>): Promise<string>;
  update(id: string, materia: Partial<Omit<Materia, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
}
