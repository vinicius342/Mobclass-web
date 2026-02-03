import { AdministradorService } from '../src/services/usuario/AdministradorService';
import { Administrador } from '../src/models/Administrador';
import { IAdministradorRepository } from '../src/repositories/administrador/IAdministradorRepository';

class FakeAdministradorRepository implements IAdministradorRepository {
  private administradores: Administrador[];

  constructor(initialAdministradores: Administrador[] = []) {
    this.administradores = [...initialAdministradores];
  }

  async findAll(): Promise<Administrador[]> {
    return this.administradores;
  }

  async findById(id: string): Promise<Administrador | null> {
    return this.administradores.find(a => a.id === id) ?? null;
  }

  async create(administrador: Omit<Administrador, 'id'>): Promise<string> {
    const id = `id-${this.administradores.length + 1}`;
    this.administradores.push({ id, ...administrador });
    return id;
  }

  async update(id: string, administrador: Partial<Omit<Administrador, 'id'>>): Promise<void> {
    this.administradores = this.administradores.map(a => 
      a.id === id ? { ...a, ...administrador } : a
    );
  }

  async delete(id: string): Promise<void> {
    this.administradores = this.administradores.filter(a => a.id !== id);
  }
}

const makeAdministrador = (overrides: Partial<Administrador> = {}): Administrador => ({
  id: overrides.id ?? '1',
  nome: overrides.nome ?? 'Admin Padrão',
  email: overrides.email ?? 'admin@escola.com',
  status: overrides.status ?? 'Ativo',
  dataCriacao: overrides.dataCriacao,
});

describe('AdministradorService', () => {
  it('deve listar administradores', async () => {
    const repo = new FakeAdministradorRepository([
      makeAdministrador({ id: '1', nome: 'Admin 1' }),
      makeAdministrador({ id: '2', nome: 'Admin 2' }),
    ]);
    const service = new AdministradorService(repo);

    const result = await service.listar();

    expect(result).toHaveLength(2);
    expect(result[0].nome).toBe('Admin 1');
    expect(result[1].nome).toBe('Admin 2');
  });

  it('deve buscar administrador por id', async () => {
    const repo = new FakeAdministradorRepository([
      makeAdministrador({ id: '1', nome: 'Admin 1' }),
      makeAdministrador({ id: '2', nome: 'Admin 2' }),
    ]);
    const service = new AdministradorService(repo);

    const found = await service.buscarPorId('2');
    const notFound = await service.buscarPorId('3');

    expect(found?.id).toBe('2');
    expect(found?.nome).toBe('Admin 2');
    expect(notFound).toBeNull();
  });

  it('deve criar administrador', async () => {
    const repo = new FakeAdministradorRepository();
    const service = new AdministradorService(repo);

    const id = await service.criar({
      nome: 'Novo Admin',
      email: 'novo@escola.com',
      status: 'Ativo',
    });

    expect(id).toBe('id-1');
    const all = await service.listar();
    expect(all).toHaveLength(1);
    expect(all[0].nome).toBe('Novo Admin');
  });

  it('deve atualizar administrador', async () => {
    const repo = new FakeAdministradorRepository([
      makeAdministrador({ id: '1', nome: 'Admin Original', email: 'original@escola.com' }),
    ]);
    const service = new AdministradorService(repo);

    await service.atualizar('1', { nome: 'Admin Atualizado', email: 'atualizado@escola.com' });

    const updated = await service.buscarPorId('1');
    expect(updated?.nome).toBe('Admin Atualizado');
    expect(updated?.email).toBe('atualizado@escola.com');
  });

  it('deve excluir administrador', async () => {
    const repo = new FakeAdministradorRepository([
      makeAdministrador({ id: '1', nome: 'Admin 1' }),
      makeAdministrador({ id: '2', nome: 'Admin 2' }),
    ]);
    const service = new AdministradorService(repo);

    await service.excluir('1');

    const all = await service.listar();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('2');
  });

  it('deve preservar campos não atualizados ao fazer update parcial', async () => {
    const repo = new FakeAdministradorRepository([
      makeAdministrador({ 
        id: '1', 
        nome: 'Admin Original', 
        email: 'original@escola.com',
        status: 'Ativo'
      }),
    ]);
    const service = new AdministradorService(repo);

    await service.atualizar('1', { nome: 'Nome Atualizado' });

    const updated = await service.buscarPorId('1');
    expect(updated?.nome).toBe('Nome Atualizado');
    expect(updated?.email).toBe('original@escola.com');
    expect(updated?.status).toBe('Ativo');
  });
});
