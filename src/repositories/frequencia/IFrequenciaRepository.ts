import { Frequencia } from '../../models/Frequencia';

export interface IFrequenciaRepository {
  findAll(): Promise<Frequencia[]>;
  findById(id: string): Promise<Frequencia | null>;
  create(frequencia: Omit<Frequencia, 'id'>): Promise<string>;
  update(id: string, frequencia: Partial<Omit<Frequencia, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;

  findByAlunoId(alunoId: string): Promise<Frequencia[]>;
  findByAlunoIdETurma(alunoId: string, turmaId: string): Promise<Frequencia[]>;
  findByTurmaId(turmaId: string): Promise<Frequencia[]>;
  findByTurmaMateria(turmaId: string, materiaId: string, data: string): Promise<Frequencia[]>;
  findByAlunoIdEPeriodo(alunoId: string, dataInicio: string, dataFim: string): Promise<Frequencia[]>;
  findByPeriodo(dataInicio: string, dataFim: string): Promise<Frequencia[]>;
  
  salvarEmLote(frequencias: Omit<Frequencia, 'id'>[]): Promise<void>;
  copiarFrequencias(alunoId: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void>;
}
