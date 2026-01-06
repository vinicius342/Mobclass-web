import { Agenda } from '../../models/Agenda';

export interface IAgendaRepository {
  listar(): Promise<Agenda[]>;
  buscarPorId(id: string): Promise<Agenda | null>;
  criar(agenda: Omit<Agenda, 'id'>): Promise<string>;
  atualizar(id: string, agenda: Partial<Omit<Agenda, 'id'>>): Promise<void>;
  deletar(id: string): Promise<void>;
  listarPorTurma(turmaId: string): Promise<Agenda[]>;
  listarPorTurmas(turmaIds: string[]): Promise<Agenda[]>;
}

