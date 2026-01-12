import { Comunicado } from '../../models/Comunicado';

export interface IComunicadoRepository {
  listar(): Promise<Comunicado[]>;
  listarPorTurmas(turmaIds: string[]): Promise<Comunicado[]>;
  buscarPorId(id: string): Promise<Comunicado | null>;
  criar(comunicado: Omit<Comunicado, 'id'>): Promise<string>;
  atualizar(id: string, comunicado: Partial<Omit<Comunicado, 'id'>>): Promise<void>;
  deletar(id: string): Promise<void>;
}
