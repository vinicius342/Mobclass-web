import { Aluno } from "../models/Aluno";

export interface IAlunoRepository {
  findAll(): Promise<Aluno[]>;
  create(aluno: Omit<Aluno, 'id'>): Promise<string>;
  update(id: string, aluno: Partial<Omit<Aluno, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;

  findById(id: string): Promise<Aluno | null>;
  findByTurmaEAnoLetivo(turmaId: string, anoLetivo: string): Promise<Aluno[]>;

  updateHistorico(
    alunoId: string,
    anoAtual: string,
    anoDestino: string,
    turmaId: string,
    status: 'promovido' | 'reprovado' | 'transferido'
  ): Promise<void>;
};