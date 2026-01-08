import { IAdministradorRepository } from '../../repositories/administrador/IAdministradorRepository';
import { Administrador } from '../../models/Administrador';

export class AdministradorService {
  constructor(private administradorRepository: IAdministradorRepository) {}

  async listar(): Promise<Administrador[]> {
    return this.administradorRepository.findAll();
  }

  async buscarPorId(id: string): Promise<Administrador | null> {
    return this.administradorRepository.findById(id);
  }

  async criar(administrador: Omit<Administrador, 'id'>): Promise<string> {
    return this.administradorRepository.create(administrador);
  }

  async atualizar(id: string, administrador: Partial<Omit<Administrador, 'id'>>): Promise<void> {
    return this.administradorRepository.update(id, administrador);
  }

  async excluir(id: string): Promise<void> {
    return this.administradorRepository.delete(id);
  }
}
