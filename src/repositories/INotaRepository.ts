import { Nota } from '../models/Nota';

export interface INotaRepository {
  findAll(): Promise<Nota[]>;
  findById(id: string): Promise<Nota | null>;
  create(nota: Omit<Nota, 'id'>): Promise<string>;
  update(id: string, nota: Partial<Omit<Nota, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;

  findByAlunoUid(alunoUid: string): Promise<Nota[]>;
  findByAlunoUidETurma(alunoUid: string, turmaId: string): Promise<Nota[]>;
  findByTurmaId(turmaId: string): Promise<Nota[]>;

  copiarNotas(alunoUid: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void>;
}