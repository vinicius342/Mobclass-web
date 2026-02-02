import { ProfessorService } from '../src/services/data/ProfessorService';
import { Professor } from '../src/models/Professor';
import { IProfessorRepository } from '../src/repositories/professor/IProfessorRepository';

class FakeProfessorRepository implements IProfessorRepository {
  private professores: Professor[];

  constructor(initial: Professor[] = []) {
    this.professores = [...initial];
  }

  async findAll(): Promise<Professor[]> {
    return this.professores;
  }

  async findById(id: string): Promise<Professor | null> {
    return this.professores.find(p => p.id === id) ?? null;
  }

  async create(professor: Omit<Professor, 'id'>): Promise<string> {
    const id = `id-${this.professores.length + 1}`;
    this.professores.push({ id, ...professor });
    return id;
  }

  async update(id: string, professor: Partial<Omit<Professor, 'id'>>): Promise<void> {
    this.professores = this.professores.map(p => (p.id === id ? { ...p, ...professor } : p));
  }

  async delete(id: string): Promise<void> {
    this.professores = this.professores.filter(p => p.id !== id);
  }
}

const makeProfessor = (overrides: Partial<Professor> = {}): Professor => ({
  id: overrides.id ?? '1',
  nome: overrides.nome ?? 'Professor 1',
  email: overrides.email ?? 'p1@example.com',
  status: overrides.status ?? 'ativo',
  turmas: overrides.turmas ?? ['T1'],
  polivalente: overrides.polivalente ?? false,
  dataCriacao: overrides.dataCriacao,
});

describe('ProfessorService', () => {
  describe('métodos de repositório', () => {
    it('listar deve delegar para findAll', async () => {
      const repo = new FakeProfessorRepository([
        makeProfessor({ id: '1' }),
        makeProfessor({ id: '2' }),
      ]);
      const service = new ProfessorService(repo);

      const result = await service.listar();
      expect(result.map(p => p.id)).toEqual(['1', '2']);
    });

    it('buscarPorId deve delegar para findById', async () => {
      const repo = new FakeProfessorRepository([
        makeProfessor({ id: '1' }),
        makeProfessor({ id: '2' }),
      ]);
      const service = new ProfessorService(repo);

      const found = await service.buscarPorId('2');
      const notFound = await service.buscarPorId('3');

      expect(found?.id).toBe('2');
      expect(notFound).toBeNull();
    });

    it('criar deve delegar para create', async () => {
      const repo = new FakeProfessorRepository();
      const service = new ProfessorService(repo);

      const id = await service.criar({
        nome: 'Novo Professor',
        email: 'novo@example.com',
        status: 'ativo',
        turmas: ['T1', 'T2'],
        polivalente: true,
        dataCriacao: new Date(),
      });

      expect(id).toBe('id-1');
      const all = await repo.findAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ nome: 'Novo Professor', email: 'novo@example.com' });
    });

    it('atualizar deve delegar para update', async () => {
      const repo = new FakeProfessorRepository([
        makeProfessor({ id: '1', nome: 'Antigo' }),
      ]);
      const service = new ProfessorService(repo);

      await service.atualizar('1', { nome: 'Atualizado' });
      const updated = await repo.findById('1');

      expect(updated?.nome).toBe('Atualizado');
    });

    it('excluir deve delegar para delete', async () => {
      const repo = new FakeProfessorRepository([
        makeProfessor({ id: '1' }),
        makeProfessor({ id: '2' }),
      ]);
      const service = new ProfessorService(repo);

      await service.excluir('1');
      const all = await repo.findAll();

      expect(all.map(p => p.id)).toEqual(['2']);
    });
  });
});
