import { ProfessorMateriaService } from '../src/services/data/ProfessorMateriaService';
import { ProfessorMateria } from '../src/models/ProfessorMateria';
import { IProfessorMateriaRepository } from '../src/repositories/professor_materia/IProfessorMateriaRepository';

class FakeProfessorMateriaRepository implements IProfessorMateriaRepository {
  private vinculos: ProfessorMateria[];

  constructor(initial: ProfessorMateria[] = []) {
    this.vinculos = [...initial];
  }

  async findAll(): Promise<ProfessorMateria[]> {
    return this.vinculos;
  }

  async findById(id: string): Promise<ProfessorMateria | null> {
    return this.vinculos.find(v => v.id === id) ?? null;
  }

  async create(professorMateria: Omit<ProfessorMateria, 'id'>): Promise<string> {
    const id = `id-${this.vinculos.length + 1}`;
    this.vinculos.push({ id, ...professorMateria });
    return id;
  }

  async update(id: string, professorMateria: Partial<Omit<ProfessorMateria, 'id'>>): Promise<void> {
    this.vinculos = this.vinculos.map(v => (v.id === id ? { ...v, ...professorMateria } : v));
  }

  async delete(id: string): Promise<void> {
    this.vinculos = this.vinculos.filter(v => v.id !== id);
  }

  async findByProfessorId(professorId: string): Promise<ProfessorMateria[]> {
    return this.vinculos.filter(v => v.professorId === professorId);
  }

  async findByMateriaId(materiaId: string): Promise<ProfessorMateria[]> {
    return this.vinculos.filter(v => v.materiaId === materiaId);
  }

  async findByTurmaId(turmaId: string): Promise<ProfessorMateria[]> {
    return this.vinculos.filter(v => v.turmaId === turmaId);
  }

  async findByProfessorMateriaETurma(
    professorId: string,
    materiaId: string,
    turmaId: string,
  ): Promise<ProfessorMateria | null> {
    return (
      this.vinculos.find(
        v => v.professorId === professorId && v.materiaId === materiaId && v.turmaId === turmaId,
      ) ?? null
    );
  }

  async copiarVinculos(turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    const origem = this.vinculos.filter(v => v.turmaId === turmaOrigemId);
    const novos = origem.map(v => ({ ...v, id: `copied-${v.id}-${turmaDestinoId}`, turmaId: turmaDestinoId }));
    this.vinculos.push(...novos);
  }
}

const makeVinculo = (overrides: Partial<ProfessorMateria> = {}): ProfessorMateria => ({
  id: overrides.id ?? '1',
  professorId: overrides.professorId ?? 'P1',
  materiaId: overrides.materiaId ?? 'M1',
  turmaId: overrides.turmaId ?? 'T1',
});

describe('ProfessorMateriaService', () => {
  describe('métodos básicos de repositório', () => {
    it('listar deve delegar para findAll', async () => {
      const repo = new FakeProfessorMateriaRepository([
        makeVinculo({ id: '1' }),
        makeVinculo({ id: '2' }),
      ]);
      const service = new ProfessorMateriaService(repo);

      const result = await service.listar();
      expect(result.map(v => v.id)).toEqual(['1', '2']);
    });

    it('buscarPorId deve delegar para findById', async () => {
      const repo = new FakeProfessorMateriaRepository([
        makeVinculo({ id: '1' }),
        makeVinculo({ id: '2' }),
      ]);
      const service = new ProfessorMateriaService(repo);

      const found = await service.buscarPorId('2');
      const notFound = await service.buscarPorId('3');

      expect(found?.id).toBe('2');
      expect(notFound).toBeNull();
    });

    it('criar deve delegar para create', async () => {
      const repo = new FakeProfessorMateriaRepository();
      const service = new ProfessorMateriaService(repo);

      const id = await service.criar({
        professorId: 'P1',
        materiaId: 'M1',
        turmaId: 'T1',
      });

      expect(id).toBe('id-1');
      const all = await repo.findAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ professorId: 'P1', materiaId: 'M1', turmaId: 'T1' });
    });

    it('atualizar deve delegar para update', async () => {
      const repo = new FakeProfessorMateriaRepository([
        makeVinculo({ id: '1', turmaId: 'T1' }),
      ]);
      const service = new ProfessorMateriaService(repo);

      await service.atualizar('1', { turmaId: 'T2' });
      const updated = await repo.findById('1');

      expect(updated?.turmaId).toBe('T2');
    });

    it('excluir deve delegar para delete', async () => {
      const repo = new FakeProfessorMateriaRepository([
        makeVinculo({ id: '1' }),
        makeVinculo({ id: '2' }),
      ]);
      const service = new ProfessorMateriaService(repo);

      await service.excluir('1');
      const all = await repo.findAll();

      expect(all.map(v => v.id)).toEqual(['2']);
    });
  });

  describe('consultas específicas', () => {
    it('listarPorProfessor deve usar findByProfessorId', async () => {
      const repo = new FakeProfessorMateriaRepository([
        makeVinculo({ id: '1', professorId: 'P1' }),
        makeVinculo({ id: '2', professorId: 'P2' }),
      ]);
      const service = new ProfessorMateriaService(repo);

      const result = await service.listarPorProfessor('P1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('listarPorMateria deve usar findByMateriaId', async () => {
      const repo = new FakeProfessorMateriaRepository([
        makeVinculo({ id: '1', materiaId: 'M1' }),
        makeVinculo({ id: '2', materiaId: 'M2' }),
      ]);
      const service = new ProfessorMateriaService(repo);

      const result = await service.listarPorMateria('M2');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('listarPorTurma deve usar findByTurmaId', async () => {
      const repo = new FakeProfessorMateriaRepository([
        makeVinculo({ id: '1', turmaId: 'T1' }),
        makeVinculo({ id: '2', turmaId: 'T2' }),
      ]);
      const service = new ProfessorMateriaService(repo);

      const result = await service.listarPorTurma('T2');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('buscarVinculoEspecifico deve delegar para findByProfessorMateriaETurma', async () => {
      const repo = new FakeProfessorMateriaRepository([
        makeVinculo({ id: '1', professorId: 'P1', materiaId: 'M1', turmaId: 'T1' }),
        makeVinculo({ id: '2', professorId: 'P1', materiaId: 'M2', turmaId: 'T1' }),
      ]);
      const service = new ProfessorMateriaService(repo);

      const vinculo = await service.buscarVinculoEspecifico('P1', 'M1', 'T1');
      expect(vinculo?.id).toBe('1');

      const inexistente = await service.buscarVinculoEspecifico('P2', 'M1', 'T1');
      expect(inexistente).toBeNull();
    });

    it('copiarVinculos deve delegar para copiarVinculos do repositório', async () => {
      const repo = new FakeProfessorMateriaRepository([
        makeVinculo({ id: '1', turmaId: 'T1' }),
        makeVinculo({ id: '2', turmaId: 'T1' }),
        makeVinculo({ id: '3', turmaId: 'T2' }),
      ]);
      const service = new ProfessorMateriaService(repo);

      await service.copiarVinculos('T1', 'T3');

      const all = await repo.findAll();
      const copiados = all.filter(v => v.turmaId === 'T3');
      expect(copiados).toHaveLength(2);
      expect(copiados.map(v => v.professorId)).toEqual(['P1', 'P1']);
    });
  });

  describe('métodos utilitários', () => {
    it('professorLecionaMateriaNaTurma deve retornar true quando vínculo existir', async () => {
      const repo = new FakeProfessorMateriaRepository([
        makeVinculo({ professorId: 'P1', materiaId: 'M1', turmaId: 'T1' }),
      ]);
      const service = new ProfessorMateriaService(repo);

      const leciona = await service.professorLecionaMateriaNaTurma('P1', 'M1', 'T1');
      const naoLeciona = await service.professorLecionaMateriaNaTurma('P1', 'M2', 'T1');

      expect(leciona).toBe(true);
      expect(naoLeciona).toBe(false);
    });

    it('listarMateriasDoProfessorNaTurma deve retornar materiaIds corretos', async () => {
      const repo = new FakeProfessorMateriaRepository([
        makeVinculo({ professorId: 'P1', materiaId: 'M1', turmaId: 'T1' }),
        makeVinculo({ professorId: 'P1', materiaId: 'M2', turmaId: 'T1' }),
        makeVinculo({ professorId: 'P1', materiaId: 'M3', turmaId: 'T2' }),
        makeVinculo({ professorId: 'P2', materiaId: 'M1', turmaId: 'T1' }),
      ]);
      const service = new ProfessorMateriaService(repo);

      const materias = await service.listarMateriasDoProfessorNaTurma('P1', 'T1');
      expect(materias.sort()).toEqual(['M1', 'M2'].sort());
    });

    it('listarProfessoresDaMateriaNaTurma deve retornar professorIds corretos', async () => {
      const repo = new FakeProfessorMateriaRepository([
        makeVinculo({ professorId: 'P1', materiaId: 'M1', turmaId: 'T1' }),
        makeVinculo({ professorId: 'P2', materiaId: 'M1', turmaId: 'T1' }),
        makeVinculo({ professorId: 'P3', materiaId: 'M2', turmaId: 'T1' }),
        makeVinculo({ professorId: 'P4', materiaId: 'M1', turmaId: 'T2' }),
      ]);
      const service = new ProfessorMateriaService(repo);

      const professores = await service.listarProfessoresDaMateriaNaTurma('M1', 'T1');
      expect(professores.sort()).toEqual(['P1', 'P2'].sort());
    });

    it('listarMateriasPorProfessor deve retornar materiaIds únicos', async () => {
      const repo = new FakeProfessorMateriaRepository([
        makeVinculo({ professorId: 'P1', materiaId: 'M1', turmaId: 'T1' }),
        makeVinculo({ professorId: 'P1', materiaId: 'M1', turmaId: 'T2' }),
        makeVinculo({ professorId: 'P1', materiaId: 'M2', turmaId: 'T1' }),
        makeVinculo({ professorId: 'P2', materiaId: 'M3', turmaId: 'T1' }),
      ]);
      const service = new ProfessorMateriaService(repo);

      const materias = await service.listarMateriasPorProfessor('P1');
      expect(materias.sort()).toEqual(['M1', 'M2'].sort());
    });

    it('obterMateriaIdsDaTurma deve filtrar por turma e retornar materiaIds', () => {
      const repo = new FakeProfessorMateriaRepository();
      const service = new ProfessorMateriaService(repo);

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
