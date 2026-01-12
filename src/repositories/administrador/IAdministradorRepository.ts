import { Administrador } from '../../models/Administrador';

export interface IAdministradorRepository {
  findAll(): Promise<Administrador[]>;
  findById(id: string): Promise<Administrador | null>;
  create(administrador: Omit<Administrador, 'id'>): Promise<string>;
  update(id: string, administrador: Partial<Omit<Administrador, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
}
