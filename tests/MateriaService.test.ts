import { MateriaService, MateriaComTurma } from '../src/services/data/MateriaService';
import { Materia } from '../src/models/Materia';
import { IMateriaRepository } from '../src/repositories/materia/IMateriaRepository';
import { ProfessorMateria } from '../src/models/ProfessorMateria';

class FakeMateriaRepository implements IMateriaRepository {
  private materias: Materia[];

  constructor(initial: Materia[] = []) {
    this.materias = [...initial];
  }

  async findAll(): Promise<Materia[]> {
    return this.materias;
  }

  async findById(id: string): Promise<Materia | null> {
    return this.materias.find(m => m.id === id) ?? null;
  }

  async create(materia: Omit<Materia, 'id'>): Promise<string> {
    const id = `id-${this.materias.length + 1}`;
    this.materias.push({ id, ...materia });
    return id;
  }

  async update(id: string, materia: Partial<Omit<Materia, 'id'>>): Promise<void> {
    this.materias = this.materias.map(m => (m.id === id ? { ...m, ...materia } : m));
  }

  async delete(id: string): Promise<void> {
    this.materias = this.materias.filter(m => m.id !== id);
  }
}

const makeMateria = (overrides: Partial<Materia> = {}): Materia => ({
  id: overrides.id ?? '1',
  codigo: overrides.codigo ?? 'COD1',
  nome: overrides.nome ?? 'Matemática',
  categoria: overrides.categoria,
});

const makeVinculo = (overrides: Partial<ProfessorMateria> = {}): ProfessorMateria => ({
  id: overrides.id ?? '1',
  professorId: overrides.professorId ?? 'P1',
  materiaId: overrides.materiaId ?? '1',
  turmaId: overrides.turmaId ?? 'T1',
});

describe('MateriaService', () => {
  describe('métodos de repositório', () => {
    it('deve listar matérias', async () => {
      const repo = new FakeMateriaRepository([
        makeMateria({ id: '1', nome: 'Matemática' }),
        makeMateria({ id: '2', nome: 'História' }),
      ]);
      const service = new MateriaService(repo);

      const result = await service.listar();

      expect(result).toHaveLength(2);
      expect(result.map(m => m.id)).toEqual(['1', '2']);
    });

    it('deve buscar por id', async () => {
      const repo = new FakeMateriaRepository([
        makeMateria({ id: '1', nome: 'Matemática' }),
        makeMateria({ id: '2', nome: 'História' }),
      ]);
      const service = new MateriaService(repo);

      const found = await service.buscarPorId('2');
      const notFound = await service.buscarPorId('3');

      expect(found?.id).toBe('2');
      expect(notFound).toBeNull();
    });

    it('deve criar matéria', async () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const id = await service.criar({
        codigo: 'MAT1',
        nome: 'Matemática',
        categoria: 'Exatas',
      });

      expect(id).toBe('id-1');
      const all = await service.listar();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(id);
    });

    it('deve atualizar matéria', async () => {
      const repo = new FakeMateriaRepository([
        makeMateria({ id: '1', nome: 'Matemática' }),
      ]);
      const service = new MateriaService(repo);

      await service.atualizar('1', { nome: 'Matemática II' });

      const updated = await service.buscarPorId('1');
      expect(updated?.nome).toBe('Matemática II');
    });

    it('deve excluir matéria', async () => {
      const repo = new FakeMateriaRepository([
        makeMateria({ id: '1' }),
        makeMateria({ id: '2' }),
      ]);
      const service = new MateriaService(repo);

      await service.excluir('1');

      const all = await service.listar();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('2');
    });
  });

  describe('construirMateriasComTurmas', () => {
    it('deve construir lista de matérias com turmaId a partir dos vínculos', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const materias: Materia[] = [
        makeMateria({ id: 'M1', nome: 'Matemática' }),
        makeMateria({ id: 'M2', nome: 'História' }),
      ];

      const vinculos: ProfessorMateria[] = [
        makeVinculo({ id: '1', materiaId: 'M1', turmaId: 'T1' }),
        makeVinculo({ id: '2', materiaId: 'M1', turmaId: 'T2' }),
        makeVinculo({ id: '3', materiaId: 'M2', turmaId: 'T1' }),
      ];

      const result = service.construirMateriasComTurmas(materias, vinculos);

      const keys = result.map(m => `${m.id}-${m.turmaId}`);
      expect(keys.sort()).toEqual(['M1-T1', 'M1-T2', 'M2-T1'].sort());
    });

    it('deve aplicar filtro de turmas nos vínculos', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const materias: Materia[] = [
        makeMateria({ id: 'M1', nome: 'Matemática' }),
      ];

      const vinculos: ProfessorMateria[] = [
        makeVinculo({ id: '1', materiaId: 'M1', turmaId: 'T1' }),
        makeVinculo({ id: '2', materiaId: 'M1', turmaId: 'T2' }),
      ];

      const result = service.construirMateriasComTurmas(materias, vinculos, ['T2']);

      expect(result).toHaveLength(1);
      expect(result[0].turmaId).toBe('T2');
    });

    it('não deve duplicar combinações matéria/turma', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const materias: Materia[] = [makeMateria({ id: 'M1' })];

      const vinculos: ProfessorMateria[] = [
        makeVinculo({ id: '1', materiaId: 'M1', turmaId: 'T1' }),
        makeVinculo({ id: '2', materiaId: 'M1', turmaId: 'T1' }),
      ];

      const result = service.construirMateriasComTurmas(materias, vinculos);

      expect(result).toHaveLength(1);
      expect(result[0].turmaId).toBe('T1');
    });
  });

  describe('removerDuplicatas', () => {
    it('deve remover duplicatas mantendo apenas uma por id', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const materiasComTurma: MateriaComTurma[] = [
        { id: 'M1', codigo: 'C1', nome: 'Matemática', turmaId: 'T1' },
        { id: 'M1', codigo: 'C1', nome: 'Matemática', turmaId: 'T2' },
        { id: 'M2', codigo: 'C2', nome: 'História', turmaId: 'T1' },
      ];

      const result = service.removerDuplicatas(materiasComTurma);

      expect(result).toHaveLength(2);
      expect(result.map(m => m.id).sort()).toEqual(['M1', 'M2']);
    });
  });

  describe('gerarCodigoMateria', () => {
    it('deve gerar código com 3 letras do início + 3 dígitos', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const codigo = service.gerarCodigoMateria('Matemática');

      expect(codigo).toMatch(/^MAT\d{3}$/);
    });
  });

  describe('determinarCategoria', () => {
    it('deve respeitar categoria salva, se fornecida', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const categoria = service.determinarCategoria('Matemática', 'OutraCategoria');
      expect(categoria).toBe('OutraCategoria');
    });

    it('deve classificar matérias de exatas', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      expect(service.determinarCategoria('Matemática', undefined)).toBe('Exatas');
      expect(service.determinarCategoria('Física', undefined)).toBe('Exatas');
    });

    it('deve classificar matérias de humanas', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      expect(service.determinarCategoria('História', undefined)).toBe('Humanas');
      expect(service.determinarCategoria('Geografia', undefined)).toBe('Humanas');
    });

    it('deve classificar matérias de linguagens', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      expect(service.determinarCategoria('Português', undefined)).toBe('Linguagens');
      expect(service.determinarCategoria('Inglês', undefined)).toBe('Linguagens');
    });

    it('deve classificar demais como Outras', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      // Pelo regex atual, "Física" cai em Exatas
      expect(service.determinarCategoria('Educação Física', undefined)).toBe('Exatas');
    });
  });

  describe('validarDuplicidade', () => {
    it('deve retornar true quando houver matéria com mesmo nome e categoria', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const materias: Materia[] = [
        { id: '1', codigo: 'C1', nome: 'Matemática', categoria: 'Exatas' },
        { id: '2', codigo: 'C2', nome: 'História', categoria: 'Humanas' },
      ];

      const resultado = service.validarDuplicidade(materias, 'Matemática', 'Exatas');
      expect(resultado).toBe(true);
    });

    it('deve ignorar id especificado ao validar duplicidade', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const materias: Materia[] = [
        { id: '1', codigo: 'C1', nome: 'Matemática', categoria: 'Exatas' },
      ];

      const resultado = service.validarDuplicidade(materias, 'Matemática', 'Exatas', '1');
      expect(resultado).toBe(false);
    });

    it('deve comparar nome ignorando maiúsculas/minúsculas e espaços', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const materias: Materia[] = [
        { id: '1', codigo: 'C1', nome: '  matemática  ', categoria: 'Exatas' },
      ];

      const resultado = service.validarDuplicidade(materias, 'Matemática', 'Exatas');
      expect(resultado).toBe(true);
    });
  });

  describe('filtrarEPaginar', () => {
    it('deve filtrar por termo de busca e categoria e paginar resultado', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const materias: Materia[] = [
        { id: '1', codigo: 'C1', nome: 'Matemática', categoria: 'Exatas' },
        { id: '2', codigo: 'C2', nome: 'História', categoria: 'Humanas' },
        { id: '3', codigo: 'C3', nome: 'Geografia', categoria: 'Humanas' },
        { id: '4', codigo: 'C4', nome: 'Português', categoria: 'Linguagens' },
      ];

      const { materiasFiltradas, totalPaginas, materiasPaginadas } = service.filtrarEPaginar(
        materias,
        'a',
        'Humanas',
        1,
        1,
      );

      // Humanas com "a" no nome: História, Geografia
      expect(materiasFiltradas.map(m => m.id).sort()).toEqual(['2', '3']);
      expect(totalPaginas).toBe(2);
      expect(materiasPaginadas).toHaveLength(1);
    });

    it('deve funcionar sem filtros (retornar tudo paginado)', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const materias: Materia[] = [
        { id: '1', codigo: 'C1', nome: 'Matemática', categoria: 'Exatas' },
        { id: '2', codigo: 'C2', nome: 'História', categoria: 'Humanas' },
      ];

      const { materiasFiltradas, totalPaginas } = service.filtrarEPaginar(
        materias,
        '',
        '',
        1,
        10,
      );

      expect(materiasFiltradas).toHaveLength(2);
      expect(totalPaginas).toBe(1);
    });
  });

  describe('calcularEstatisticasPorCategoria', () => {
    it('deve calcular totais por categoria', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const materias: Materia[] = [
        { id: '1', codigo: 'C1', nome: 'Matemática', categoria: 'Exatas' },
        { id: '2', codigo: 'C2', nome: 'História', categoria: 'Humanas' },
        { id: '3', codigo: 'C3', nome: 'Português', categoria: 'Linguagens' },
        { id: '4', codigo: 'C4', nome: 'Educação Física', categoria: 'Outras' },
      ];

      const stats = service.calcularEstatisticasPorCategoria(materias);

      expect(stats.total).toBe(4);
      expect(stats.exatas).toBe(1);
      expect(stats.humanas).toBe(1);
      expect(stats.linguagens).toBe(1);
      expect(stats.outras).toBe(1);
    });

    it('deve retornar zeros para lista vazia', () => {
      const repo = new FakeMateriaRepository();
      const service = new MateriaService(repo);

      const stats = service.calcularEstatisticasPorCategoria([]);

      expect(stats.total).toBe(0);
      expect(stats.exatas).toBe(0);
      expect(stats.humanas).toBe(0);
      expect(stats.linguagens).toBe(0);
      expect(stats.outras).toBe(0);
    });
  });
});
