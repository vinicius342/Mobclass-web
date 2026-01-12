import { Ocorrencia } from '../../models/Ocorrencia';

export interface IOcorrenciaRepository {
  findAll(): Promise<Ocorrencia[]>;
  findById(id: string): Promise<Ocorrencia | null>;
  create(ocorrencia: Omit<Ocorrencia, 'id'>): Promise<string>;
  update(id: string, ocorrencia: Partial<Omit<Ocorrencia, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
}
