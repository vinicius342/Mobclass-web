import { ProfessorService } from '../src/services/data/ProfessorService';
import { Professor } from '../src/models/Professor';

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
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  describe('CRUD de professores (Cloud Function)', () => {
    it('listar deve chamar a Cloud Function com action "listar"', async () => {
      const professoresMock = [makeProfessor({ id: '1' }), makeProfessor({ id: '2' })];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => professoresMock,
      });

      const service = new ProfessorService();
      const result = await service.listar();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'professor', action: 'listar' }),
        }),
      );
      expect(result.map(p => p.id)).toEqual(['1', '2']);
    });

    it('buscarPorId deve enviar id', async () => {
      const professorMock = makeProfessor({ id: '2' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => professorMock,
      });

      const service = new ProfessorService();
      const found = await service.buscarPorId('2');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'professor', action: 'buscarPorId', id: '2' }),
        }),
      );
      expect(found?.id).toBe('2');
    });

    it('criar deve enviar dados do professor', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'id-1' }),
      });

      const service = new ProfessorService();
      const id = await service.criar({
        nome: 'Novo Professor',
        email: 'novo@example.com',
        status: 'ativo',
        turmas: ['T1', 'T2'],
        polivalente: true,
        dataCriacao: new Date(),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(id).toBe('id-1');
    });

    it('atualizar deve enviar id e dados parciais', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const service = new ProfessorService();
      await service.atualizar('1', { nome: 'Atualizado' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'professor', action: 'atualizar', id: '1', professor: { nome: 'Atualizado' } }),
        }),
      );
    });

    it('excluir deve enviar id', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const service = new ProfessorService();
      await service.excluir('1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'professor', action: 'excluir', id: '1' }),
        }),
      );
    });
  });
});
