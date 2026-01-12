import { Responsavel } from '../../models/Responsavel';

export interface IResponsavelRepository {
  findAll(): Promise<Responsavel[]>;
  findById(id: string): Promise<Responsavel | null>;
  create(responsavel: Omit<Responsavel, 'id'>): Promise<string>;
  update(id: string, responsavel: Partial<Omit<Responsavel, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
}
