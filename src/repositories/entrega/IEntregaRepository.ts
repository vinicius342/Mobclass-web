import { Entrega } from '../../models/Entrega';

export interface IEntregaRepository {
  findAll(): Promise<Entrega[]>;
  findById(id: string): Promise<Entrega | null>;
  create(entrega: Omit<Entrega, 'id'>): Promise<string>;
  update(id: string, entrega: Partial<Omit<Entrega, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
  findByTarefaId(tarefaId: string): Promise<Entrega[]>;
  findByAlunoAndTarefa(alunoId: string, tarefaId: string): Promise<Entrega | null>;
}
