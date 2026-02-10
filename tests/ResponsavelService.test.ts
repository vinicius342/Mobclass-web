import { ResponsavelService } from '../src/services/usuario/ResponsavelService';
import { Responsavel } from '../src/models/Responsavel';

const makeResponsavel = (overrides: Partial<Responsavel> = {}): Responsavel => ({
  id: overrides.id ?? 'r1',
  nome: overrides.nome ?? 'Responsável 1',
  email: overrides.email ?? 'resp1@escola.com',
  status: overrides.status ?? 'Ativo',
  filhos: overrides.filhos ?? ['a1'],
  dataCriacao: overrides.dataCriacao,
});

describe('ResponsavelService', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('deve listar responsáveis', async () => {
    const responsaveisMock = [
      makeResponsavel({ id: 'r1', nome: 'Resp 1' }),
      makeResponsavel({ id: 'r2', nome: 'Resp 2' }),
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => responsaveisMock,
    });

    const service = new ResponsavelService();
    const result = await service.listar();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ domain: 'responsavel', action: 'listar' }),
      }),
    );
    expect(result).toHaveLength(2);
    expect(result[0].nome).toBe('Resp 1');
    expect(result[1].nome).toBe('Resp 2');
  });

  it('deve buscar responsável por id', async () => {
    const responsavelMock = makeResponsavel({ id: 'r2', nome: 'Resp 2' });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => responsavelMock,
    });

    const service = new ResponsavelService();
    const found = await service.buscarPorId('r2');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ domain: 'responsavel', action: 'buscarPorId', id: 'r2' }),
      }),
    );
    expect(found?.id).toBe('r2');
    expect(found?.nome).toBe('Resp 2');
  });

  it('deve criar responsável', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'id-1' }),
    });

    const service = new ResponsavelService();
    const id = await service.criar({
      nome: 'Novo Resp',
      email: 'novo@escola.com',
      status: 'Ativo',
      filhos: ['a1', 'a2'],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(id).toBe('id-1');
  });

  it('deve atualizar responsável', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const service = new ResponsavelService();
    await service.atualizar('r1', { nome: 'Resp Atualizado', filhos: ['a1', 'a2'] });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          domain: 'responsavel',
          action: 'atualizar',
          id: 'r1',
          responsavel: { nome: 'Resp Atualizado', filhos: ['a1', 'a2'] },
        }),
      }),
    );
  });

  it('deve excluir responsável', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const service = new ResponsavelService();
    await service.excluir('r1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ domain: 'responsavel', action: 'excluir', id: 'r1' }),
      }),
    );
  });

  it('deve preservar campos não atualizados em update parcial', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const service = new ResponsavelService();
    await service.atualizar('r1', { nome: 'Novo Nome' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          domain: 'responsavel',
          action: 'atualizar',
          id: 'r1',
          responsavel: { nome: 'Novo Nome' },
        }),
      }),
    );
  });
});
