import { ProfessorMateriaService } from '../src/services/data/ProfessorMateriaService';
import { ProfessorMateria } from '../src/models/ProfessorMateria';

const makeVinculo = (overrides: Partial<ProfessorMateria> = {}): ProfessorMateria => ({
  id: overrides.id ?? '1',
  professorId: overrides.professorId ?? 'P1',
  materiaId: overrides.materiaId ?? 'M1',
  turmaId: overrides.turmaId ?? 'T1',
});

describe('ProfessorMateriaService', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  describe('métodos básicos de repositório', () => {
    it('listar deve delegar para findAll', async () => {
      const mockVinculos = [
        makeVinculo({ id: '1' }),
        makeVinculo({ id: '2' }),
      ];
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVinculos,
      });

      const service = new ProfessorMateriaService();
      const result = await service.listar();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'professor_materia', action: 'listar' }),
        })
      );
      expect(result.map(v => v.id)).toEqual(['1', '2']);
    });

    it('buscarPorId deve delegar para findById', async () => {
      const mockVinculo = makeVinculo({ id: '2' });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockVinculo,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => null,
        });

      const service = new ProfessorMateriaService();
      const found = await service.buscarPorId('2');
      const notFound = await service.buscarPorId('3');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'professor_materia', action: 'buscarPorId', id: '2' }),
        })
      );
      expect(found?.id).toBe('2');
      expect(notFound).toBeNull();
    });

    it('criar deve delegar para create', async () => {
      const newId = 'id-1';
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => newId,
      });

      const service = new ProfessorMateriaService();
      const id = await service.criar({
        professorId: 'P1',
        materiaId: 'M1',
        turmaId: 'T1',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            domain: 'professor_materia',
            action: 'criar',
            professorMateria: { professorId: 'P1', materiaId: 'M1', turmaId: 'T1' },
          }),
        })
      );
      expect(id).toBe('id-1');
    });

    it('atualizar deve delegar para update', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => undefined,
      });

      const service = new ProfessorMateriaService();
      await service.atualizar('1', { turmaId: 'T2' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            domain: 'professor_materia',
            action: 'atualizar',
            id: '1',
            professorMateria: { turmaId: 'T2' },
          }),
        })
      );
    });

    it('excluir deve delegar para delete', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => undefined,
      });

      const service = new ProfessorMateriaService();
      await service.excluir('1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'professor_materia', action: 'excluir', id: '1' }),
        })
      );
    });
  });

  describe('consultas específicas', () => {
    it('listarPorProfessor deve usar findByProfessorId', async () => {
      const mockVinculos = [
        makeVinculo({ id: '1', professorId: 'P1' }),
      ];
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVinculos,
      });

      const service = new ProfessorMateriaService();
      const result = await service.listarPorProfessor('P1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'professor_materia', action: 'buscarPorProfessorId', professorId: 'P1' }),
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('listarPorMateria deve usar findByMateriaId', async () => {
      const mockVinculos = [
        makeVinculo({ id: '2', materiaId: 'M2' }),
      ];
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVinculos,
      });

      const service = new ProfessorMateriaService();
      const result = await service.listarPorMateria('M2');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'professor_materia', action: 'buscarPorMateriaId', materiaId: 'M2' }),
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('listarPorTurma deve usar findByTurmaId', async () => {
      const mockVinculos = [
        makeVinculo({ id: '2', turmaId: 'T2' }),
      ];
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVinculos,
      });

      const service = new ProfessorMateriaService();
      const result = await service.listarPorTurma('T2');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'professor_materia', action: 'buscarPorTurmaId', turmaId: 'T2' }),
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('buscarVinculoEspecifico deve delegar para findByProfessorMateriaETurma', async () => {
      const mockVinculo = makeVinculo({ id: '1', professorId: 'P1', materiaId: 'M1', turmaId: 'T1' });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockVinculo,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => null,
        });

      const service = new ProfessorMateriaService();
      const vinculo = await service.buscarVinculoEspecifico('P1', 'M1', 'T1');
      const inexistente = await service.buscarVinculoEspecifico('P2', 'M1', 'T1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            domain: 'professor_materia',
            action: 'buscarPorProfessorMateriaETurma',
            professorId: 'P1',
            materiaId: 'M1',
            turmaId: 'T1',
          }),
        })
      );
      expect(vinculo?.id).toBe('1');
      expect(inexistente).toBeNull();
    });

    it('copiarVinculos deve delegar para copiarVinculos do repositório', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => undefined,
      });

      const service = new ProfessorMateriaService();
      await service.copiarVinculos('T1', 'T3');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            domain: 'professor_materia',
            action: 'copiarVinculos',
            turmaOrigemId: 'T1',
            turmaDestinoId: 'T3',
          }),
        })
      );
    });
  });

  describe('métodos utilitários', () => {
    it('professorLecionaMateriaNaTurma deve retornar true quando vínculo existir', async () => {
      const mockVinculo = makeVinculo({ professorId: 'P1', materiaId: 'M1', turmaId: 'T1' });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockVinculo,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => null,
        });

      const service = new ProfessorMateriaService();
      const leciona = await service.professorLecionaMateriaNaTurma('P1', 'M1', 'T1');
      const naoLeciona = await service.professorLecionaMateriaNaTurma('P1', 'M2', 'T1');

      expect(leciona).toBe(true);
      expect(naoLeciona).toBe(false);
    });

    it('listarMateriasDoProfessorNaTurma deve retornar materiaIds corretos', async () => {
      const mockVinculos = [
        makeVinculo({ professorId: 'P1', materiaId: 'M1', turmaId: 'T1' }),
        makeVinculo({ professorId: 'P1', materiaId: 'M2', turmaId: 'T1' }),
        makeVinculo({ professorId: 'P1', materiaId: 'M3', turmaId: 'T2' }),
        makeVinculo({ professorId: 'P2', materiaId: 'M1', turmaId: 'T1' }),
      ];
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVinculos,
      });

      const service = new ProfessorMateriaService();
      const materias = await service.listarMateriasDoProfessorNaTurma('P1', 'T1');
      expect(materias.sort()).toEqual(['M1', 'M2'].sort());
    });

    it('listarProfessoresDaMateriaNaTurma deve retornar professorIds corretos', async () => {
      const mockVinculos = [
        makeVinculo({ professorId: 'P1', materiaId: 'M1', turmaId: 'T1' }),
        makeVinculo({ professorId: 'P2', materiaId: 'M1', turmaId: 'T1' }),
        makeVinculo({ professorId: 'P3', materiaId: 'M2', turmaId: 'T1' }),
        makeVinculo({ professorId: 'P4', materiaId: 'M1', turmaId: 'T2' }),
      ];
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVinculos,
      });

      const service = new ProfessorMateriaService();
      const professores = await service.listarProfessoresDaMateriaNaTurma('M1', 'T1');
      expect(professores.sort()).toEqual(['P1', 'P2'].sort());
    });

    it('listarMateriasPorProfessor deve retornar materiaIds únicos', async () => {
      const mockVinculosP1 = [
        makeVinculo({ professorId: 'P1', materiaId: 'M1', turmaId: 'T1' }),
        makeVinculo({ professorId: 'P1', materiaId: 'M1', turmaId: 'T2' }),
        makeVinculo({ professorId: 'P1', materiaId: 'M2', turmaId: 'T1' }),
      ];
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockVinculosP1,
      });

      const service = new ProfessorMateriaService();
      const materias = await service.listarMateriasPorProfessor('P1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'professor_materia', action: 'buscarPorProfessorId', professorId: 'P1' }),
        })
      );
      expect(materias.sort()).toEqual(['M1', 'M2'].sort());
    });

    it('obterMateriaIdsDaTurma deve filtrar por turma e retornar materiaIds', () => {
      const service = new ProfessorMateriaService();

      const vinculos = [
        makeVinculo({ turmaId: 'T1', materiaId: 'M1' }),
        makeVinculo({ turmaId: 'T1', materiaId: 'M2' }),
        makeVinculo({ turmaId: 'T2', materiaId: 'M3' }),
      ];

      const materias = service.obterMateriaIdsDaTurma(vinculos, 'T1');
      expect(materias.sort()).toEqual(['M1', 'M2'].sort());
    });
  });
});
