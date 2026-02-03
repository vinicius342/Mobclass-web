import { ResponsavelService } from '../src/services/usuario/ResponsavelService';
import { Responsavel } from '../src/models/Responsavel';
import { IResponsavelRepository } from '../src/repositories/responsavel/IResponsavelRepository';

class FakeResponsavelRepository implements IResponsavelRepository {
  private responsaveis: Responsavel[];

  constructor(initialResponsaveis: Responsavel[] = []) {
    this.responsaveis = [...initialResponsaveis];
  }

  async findAll(): Promise<Responsavel[]> {
    return this.responsaveis;
  }

  async findById(id: string): Promise<Responsavel | null> {
    return this.responsaveis.find(r => r.id === id) ?? null;
  }

  async create(responsavel: Omit<Responsavel, 'id'>): Promise<string> {
    const id = `id-${this.responsaveis.length + 1}`;
    this.responsaveis.push({ id, ...responsavel });
    return id;
  }

  async update(id: string, responsavel: Partial<Omit<Responsavel, 'id'>>): Promise<void> {
    this.responsaveis = this.responsaveis.map(r =>
      r.id === id ? { ...r, ...responsavel } : r,
    );
  }

  async delete(id: string): Promise<void> {
    this.responsaveis = this.responsaveis.filter(r => r.id !== id);
  }
}

const makeResponsavel = (overrides: Partial<Responsavel> = {}): Responsavel => ({
  id: overrides.id ?? 'r1',
  nome: overrides.nome ?? 'Responsável 1',
  email: overrides.email ?? 'resp1@escola.com',
  status: overrides.status ?? 'Ativo',
  filhos: overrides.filhos ?? ['a1'],
  dataCriacao: overrides.dataCriacao,
});

describe('ResponsavelService', () => {
  it('deve listar responsáveis', async () => {
    const repo = new FakeResponsavelRepository([
      makeResponsavel({ id: 'r1', nome: 'Resp 1' }),
      makeResponsavel({ id: 'r2', nome: 'Resp 2' }),
    ]);
    const service = new ResponsavelService(repo);

    const result = await service.listar();

    expect(result).toHaveLength(2);
    expect(result[0].nome).toBe('Resp 1');
    expect(result[1].nome).toBe('Resp 2');
  });

  it('deve buscar responsável por id', async () => {
    const repo = new FakeResponsavelRepository([
      makeResponsavel({ id: 'r1', nome: 'Resp 1' }),
      makeResponsavel({ id: 'r2', nome: 'Resp 2' }),
    ]);
    const service = new ResponsavelService(repo);

    const found = await service.buscarPorId('r2');
    const notFound = await service.buscarPorId('r3');

    expect(found?.id).toBe('r2');
    expect(found?.nome).toBe('Resp 2');
    expect(notFound).toBeNull();
  });

  it('deve criar responsável', async () => {
    const repo = new FakeResponsavelRepository();
    const service = new ResponsavelService(repo);

    const id = await service.criar({
      nome: 'Novo Resp',
      email: 'novo@escola.com',
      status: 'Ativo',
      filhos: ['a1', 'a2'],
    });

    expect(id).toBe('id-1');
    const all = await service.listar();
    expect(all).toHaveLength(1);
    expect(all[0].nome).toBe('Novo Resp');
    expect(all[0].filhos).toEqual(['a1', 'a2']);
  });

  it('deve atualizar responsável', async () => {
    const repo = new FakeResponsavelRepository([
      makeResponsavel({ id: 'r1', nome: 'Resp Original', email: 'orig@escola.com', filhos: ['a1'] }),
    ]);
    const service = new ResponsavelService(repo);

    await service.atualizar('r1', { nome: 'Resp Atualizado', filhos: ['a1', 'a2'] });

    const updated = await service.buscarPorId('r1');
    expect(updated?.nome).toBe('Resp Atualizado');
    expect(updated?.email).toBe('orig@escola.com');
    expect(updated?.filhos).toEqual(['a1', 'a2']);
  });

  it('deve excluir responsável', async () => {
    const repo = new FakeResponsavelRepository([
      makeResponsavel({ id: 'r1', nome: 'Resp 1' }),
      makeResponsavel({ id: 'r2', nome: 'Resp 2' }),
    ]);
    const service = new ResponsavelService(repo);

    await service.excluir('r1');

    const all = await service.listar();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('r2');
  });

  it('deve preservar campos não atualizados em update parcial', async () => {
    const repo = new FakeResponsavelRepository([
      makeResponsavel({
        id: 'r1',
        nome: 'Resp Original',
        email: 'orig@escola.com',
        status: 'Ativo',
        filhos: ['a1'],
      }),
    ]);
    const service = new ResponsavelService(repo);

    await service.atualizar('r1', { nome: 'Novo Nome' });

    const updated = await service.buscarPorId('r1');
    expect(updated?.nome).toBe('Novo Nome');
    expect(updated?.email).toBe('orig@escola.com');
    expect(updated?.status).toBe('Ativo');
    expect(updated?.filhos).toEqual(['a1']);
  });
});
