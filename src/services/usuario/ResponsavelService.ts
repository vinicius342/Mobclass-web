import { IResponsavelRepository } from '../../repositories/responsavel/IResponsavelRepository';
import { Responsavel } from '../../models/Responsavel';

export class ResponsavelService {
  constructor(private responsavelRepository: IResponsavelRepository) {}

  async listar(): Promise<Responsavel[]> {
    return this.responsavelRepository.findAll();
  }

  async buscarPorId(id: string): Promise<Responsavel | null> {
    return this.responsavelRepository.findById(id);
  }

  async criar(responsavel: Omit<Responsavel, 'id'>): Promise<string> {
    return this.responsavelRepository.create(responsavel);
  }

  async atualizar(id: string, responsavel: Partial<Omit<Responsavel, 'id'>>): Promise<void> {
    return this.responsavelRepository.update(id, responsavel);
  }

  async excluir(id: string): Promise<void> {
    return this.responsavelRepository.delete(id);
  }
}
