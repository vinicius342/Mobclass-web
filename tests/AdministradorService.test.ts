import { AdministradorService } from '../src/services/usuario/AdministradorService';
import { Administrador } from '../src/models/Administrador';

const makeAdministrador = (overrides: Partial<Administrador> = {}): Administrador => ({
  id: overrides.id ?? '1',
  nome: overrides.nome ?? 'Admin Padrão',
  email: overrides.email ?? 'admin@escola.com',
  status: overrides.status ?? 'Ativo',
  dataCriacao: overrides.dataCriacao,
});

describe('AdministradorService', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('deve listar administradores', async () => {
    const mockAdmins = [
      makeAdministrador({ id: '1', nome: 'Admin 1' }),
      makeAdministrador({ id: '2', nome: 'Admin 2' }),
    ];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockAdmins,
    });

    const service = new AdministradorService();
    const result = await service.listar();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ domain: 'administrador', action: 'listar' }),
      })
    );
    expect(result).toHaveLength(2);
    expect(result[0].nome).toBe('Admin 1');
    expect(result[1].nome).toBe('Admin 2');
  });

  it('deve buscar administrador por id', async () => {
    const mockAdmin = makeAdministrador({ id: '2', nome: 'Admin 2' });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAdmin,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

    const service = new AdministradorService();
    const found = await service.buscarPorId('2');
    const notFound = await service.buscarPorId('3');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ domain: 'administrador', action: 'buscarPorId', id: '2' }),
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ domain: 'administrador', action: 'buscarPorId', id: '3' }),
      })
    );
    expect(found?.id).toBe('2');
    expect(found?.nome).toBe('Admin 2');
    expect(notFound).toBeNull();
  });

  it('deve criar administrador', async () => {
    const newId = 'id-1';
    const mockAdmins = [
      makeAdministrador({ id: newId, nome: 'Novo Admin', email: 'novo@escola.com', status: 'Ativo' }),
    ];
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => newId,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAdmins,
      });

    const service = new AdministradorService();
    const id = await service.criar({
      nome: 'Novo Admin',
      email: 'novo@escola.com',
      status: 'Ativo',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          domain: 'administrador',
          action: 'criar',
          administrador: {
            nome: 'Novo Admin',
            email: 'novo@escola.com',
            status: 'Ativo',
          },
        }),
      })
    );
    expect(id).toBe('id-1');
    const all = await service.listar();
    expect(all).toHaveLength(1);
    expect(all[0].nome).toBe('Novo Admin');
  });

  it('deve atualizar administrador', async () => {
    const mockUpdated = makeAdministrador({ 
      id: '1', 
      nome: 'Admin Atualizado', 
      email: 'atualizado@escola.com' 
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => undefined,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdated,
      });

    const service = new AdministradorService();
    await service.atualizar('1', { nome: 'Admin Atualizado', email: 'atualizado@escola.com' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          domain: 'administrador',
          action: 'atualizar',
          id: '1',
          administrador: { nome: 'Admin Atualizado', email: 'atualizado@escola.com' },
        }),
      })
    );
    const updated = await service.buscarPorId('1');
    expect(updated?.nome).toBe('Admin Atualizado');
    expect(updated?.email).toBe('atualizado@escola.com');
  });

  it('deve excluir administrador', async () => {
    const mockRemaining = [makeAdministrador({ id: '2', nome: 'Admin 2' })];
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => undefined,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRemaining,
      });

    const service = new AdministradorService();
    await service.excluir('1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ domain: 'administrador', action: 'excluir', id: '1' }),
      })
    );
    const all = await service.listar();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('2');
  });

  it('deve preservar campos não atualizados ao fazer update parcial', async () => {
    const mockUpdated = makeAdministrador({
      id: '1',
      nome: 'Nome Atualizado',
      email: 'original@escola.com',
      status: 'Ativo'
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => undefined,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdated,
      });

    const service = new AdministradorService();
    await service.atualizar('1', { nome: 'Nome Atualizado' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          domain: 'administrador',
          action: 'atualizar',
          id: '1',
          administrador: { nome: 'Nome Atualizado' },
        }),
      })
    );
    const updated = await service.buscarPorId('1');
    expect(updated?.nome).toBe('Nome Atualizado');
    expect(updated?.email).toBe('original@escola.com');
    expect(updated?.status).toBe('Ativo');
  });
});
