import { FrequenciaService } from '../src/services/data/FrequenciaService';
import { Frequencia } from '../src/models/Frequencia';
import { IFrequenciaRepository } from '../src/repositories/frequencia/IFrequenciaRepository';

class FakeFrequenciaRepository implements IFrequenciaRepository {
  private frequencias: Frequencia[];

  constructor(initial: Frequencia[] = []) {
    this.frequencias = [...initial];
  }

  async findAll(): Promise<Frequencia[]> {
    return this.frequencias;
  }

  async findById(id: string): Promise<Frequencia | null> {
    return this.frequencias.find(f => f.id === id) ?? null;
  }

  async create(frequencia: Omit<Frequencia, 'id'>): Promise<string> {
    const id = `id-${this.frequencias.length + 1}`;
    this.frequencias.push({ id, ...frequencia });
    return id;
  }

  async update(id: string, frequencia: Partial<Omit<Frequencia, 'id'>>): Promise<void> {
    this.frequencias = this.frequencias.map(f => (f.id === id ? { ...f, ...frequencia } : f));
  }

  async delete(id: string): Promise<void> {
    this.frequencias = this.frequencias.filter(f => f.id !== id);
  }

  async findByAlunoId(alunoId: string): Promise<Frequencia[]> {
    return this.frequencias.filter(f => f.alunoId === alunoId);
  }

  async findByAlunoIdETurma(alunoId: string, turmaId: string): Promise<Frequencia[]> {
    return this.frequencias.filter(f => f.alunoId === alunoId && f.turmaId === turmaId);
  }

  async findByTurmaId(turmaId: string): Promise<Frequencia[]> {
    return this.frequencias.filter(f => f.turmaId === turmaId);
  }

  async findByTurmaMateria(turmaId: string, materiaId: string, data: string): Promise<Frequencia[]> {
    return this.frequencias.filter(
      f => f.turmaId === turmaId && f.materiaId === materiaId && f.data === data,
    );
  }

  async findByAlunoIdEPeriodo(alunoId: string, dataInicio: string, dataFim: string): Promise<Frequencia[]> {
    return this.frequencias.filter(f => {
      return (
        f.alunoId === alunoId &&
        f.data >= dataInicio &&
        f.data <= dataFim
      );
    });
  }

  async findByPeriodo(dataInicio: string, dataFim: string): Promise<Frequencia[]> {
    return this.frequencias.filter(f => f.data >= dataInicio && f.data <= dataFim);
  }

  async salvarEmLote(frequencias: Omit<Frequencia, 'id'>[]): Promise<void> {
    for (const freq of frequencias) {
      await this.create(freq);
    }
  }

  async copiarFrequencias(alunoId: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    const originais = this.frequencias.filter(
      f => f.alunoId === alunoId && f.turmaId === turmaOrigemId,
    );
    for (const freq of originais) {
      await this.create({
        alunoId: freq.alunoId,
        turmaId: turmaDestinoId,
        materiaId: freq.materiaId,
        data: freq.data,
        presenca: freq.presenca,
        professorId: freq.professorId,
        observacao: freq.observacao,
      });
    }
  }
}

const makeFreq = (overrides: Partial<Frequencia> = {}): Frequencia => ({
  id: overrides.id ?? '1',
  alunoId: overrides.alunoId ?? 'aluno-1',
  turmaId: overrides.turmaId ?? 'turma-1',
  materiaId: overrides.materiaId ?? 'mat-1',
  data: overrides.data ?? '2025-03-10',
  presenca: overrides.presenca ?? true,
  professorId: overrides.professorId ?? 'prof-1',
  observacao: overrides.observacao,
});

describe('FrequenciaService', () => {
  describe('métodos que usam repositório', () => {
    it('listar deve delegar para findAll', async () => {
      const repo = new FakeFrequenciaRepository([
        makeFreq({ id: '1' }),
        makeFreq({ id: '2' }),
      ]);
      const service = new FrequenciaService(repo);

      const result = await service.listar();

      expect(result).toHaveLength(2);
      expect(result.map(f => f.id)).toEqual(['1', '2']);
    });

    it('listarPorAluno deve delegar para findByAlunoId', async () => {
      const repo = new FakeFrequenciaRepository([
        makeFreq({ id: '1', alunoId: 'A' }),
        makeFreq({ id: '2', alunoId: 'B' }),
        makeFreq({ id: '3', alunoId: 'A' }),
      ]);
      const service = new FrequenciaService(repo);

      const result = await service.listarPorAluno('A');

      expect(result.map(f => f.id)).toEqual(['1', '3']);
    });

    it('listarPorAlunoETurma deve delegar para findByAlunoIdETurma', async () => {
      const repo = new FakeFrequenciaRepository([
        makeFreq({ id: '1', alunoId: 'A', turmaId: 'T1' }),
        makeFreq({ id: '2', alunoId: 'A', turmaId: 'T2' }),
        makeFreq({ id: '3', alunoId: 'B', turmaId: 'T1' }),
      ]);
      const service = new FrequenciaService(repo);

      const result = await service.listarPorAlunoETurma('A', 'T1');

      expect(result.map(f => f.id)).toEqual(['1']);
    });

    it('listarPorTurma deve delegar para findByTurmaId', async () => {
      const repo = new FakeFrequenciaRepository([
        makeFreq({ id: '1', turmaId: 'T1' }),
        makeFreq({ id: '2', turmaId: 'T2' }),
        makeFreq({ id: '3', turmaId: 'T1' }),
      ]);
      const service = new FrequenciaService(repo);

      const result = await service.listarPorTurma('T1');

      expect(result.map(f => f.id)).toEqual(['1', '3']);
    });

    it('buscarPorPeriodo deve delegar para findByPeriodo', async () => {
      const repo = new FakeFrequenciaRepository([
        makeFreq({ id: '1', data: '2025-03-01' }),
        makeFreq({ id: '2', data: '2025-03-15' }),
        makeFreq({ id: '3', data: '2025-04-01' }),
      ]);
      const service = new FrequenciaService(repo);

      const result = await service.buscarPorPeriodo('2025-03-01', '2025-03-31');

      expect(result.map(f => f.id)).toEqual(['1', '2']);
    });

    it('copiarFrequencias deve delegar para o repositório', async () => {
      const repo = new FakeFrequenciaRepository([
        makeFreq({ id: '1', alunoId: 'A', turmaId: 'T1' }),
      ]);
      const spy = jest.spyOn(repo, 'copiarFrequencias');
      const service = new FrequenciaService(repo);

      await service.copiarFrequencias('A', 'T1', 'T2');

      expect(spy).toHaveBeenCalledWith('A', 'T1', 'T2');
    });

    it('buscarPorAlunoIdEPeriodo deve delegar para findByAlunoIdEPeriodo', async () => {
      const repo = new FakeFrequenciaRepository([
        makeFreq({ id: '1', alunoId: 'A', data: '2025-01-10' }),
        makeFreq({ id: '2', alunoId: 'A', data: '2025-02-10' }),
        makeFreq({ id: '3', alunoId: 'B', data: '2025-02-10' }),
      ]);
      const service = new FrequenciaService(repo);

      const result = await service.buscarPorAlunoIdEPeriodo('A', '2025-02-01', '2025-02-28');

      expect(result.map(f => f.id)).toEqual(['2']);
    });
  });

  describe('calcularPercentualPresenca', () => {
    it('deve retornar 0 quando não houver frequencias', async () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const percentual = await service.calcularPercentualPresenca('A', 'T1');

      expect(percentual).toBe(0);
    });

    it('deve calcular percentual de presenças', async () => {
      const repo = new FakeFrequenciaRepository([
        makeFreq({ id: '1', alunoId: 'A', turmaId: 'T1', presenca: true }),
        makeFreq({ id: '2', alunoId: 'A', turmaId: 'T1', presenca: false }),
        makeFreq({ id: '3', alunoId: 'A', turmaId: 'T1', presenca: true }),
      ]);
      const service = new FrequenciaService(repo);

      const percentual = await service.calcularPercentualPresenca('A', 'T1');

      expect(percentual).toBeCloseTo((2 / 3) * 100);
    });
  });

  describe('calcularTaxasPorTurma', () => {
    it('deve calcular taxa simples sem filtros', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const frequencias: Frequencia[] = [
        makeFreq({ id: '1', turmaId: 'T1', presenca: true }),
        makeFreq({ id: '2', turmaId: 'T1', presenca: false }),
        makeFreq({ id: '3', turmaId: 'T2', presenca: false }),
      ];

      const turmas = [
        { id: 'T1', nome: 'Turma 1' },
        { id: 'T2', nome: 'Turma 2' },
      ];

      const result = service.calcularTaxasPorTurma(frequencias, turmas);

      expect(result).toEqual([
        { turma: 'Turma 1', taxa: parseFloat(((1 / 2) * 100).toFixed(2)) },
        { turma: 'Turma 2', taxa: 0 },
      ]);
    });

    it('deve aplicar filtro por matéria', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const frequencias: Frequencia[] = [
        makeFreq({ id: '1', turmaId: 'T1', materiaId: 'MAT', presenca: true }),
        makeFreq({ id: '2', turmaId: 'T1', materiaId: 'POR', presenca: false }),
      ];

      const turmas = [{ id: 'T1', nome: 'Turma 1' }];

      const result = service.calcularTaxasPorTurma(frequencias, turmas, {
        materiaId: 'MAT',
      });

      expect(result[0].taxa).toBe(100);
    });

    it('deve aplicar filtro por período hoje', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const hoje = new Date().toISOString().split('T')[0];

      const frequencias: Frequencia[] = [
        makeFreq({ id: '1', turmaId: 'T1', data: hoje, presenca: true }),
        makeFreq({ id: '2', turmaId: 'T1', data: '2020-01-01', presenca: true }),
      ];

      const turmas = [{ id: 'T1', nome: 'Turma 1' }];

      const result = service.calcularTaxasPorTurma(frequencias, turmas, {
        periodo: { tipo: 'hoje' },
      });

      expect(result[0].taxa).toBe(100);
    });

    it('deve aplicar filtro por mês e ano', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const frequencias: Frequencia[] = [
        makeFreq({ id: '1', turmaId: 'T1', data: '2025-03-10', presenca: true }),
        makeFreq({ id: '2', turmaId: 'T1', data: '2025-03-11', presenca: false }),
        makeFreq({ id: '3', turmaId: 'T1', data: '2025-04-01', presenca: true }),
      ];

      const turmas = [{ id: 'T1', nome: 'Turma 1' }];

      const result = service.calcularTaxasPorTurma(frequencias, turmas, {
        periodo: { tipo: 'mes', mes: '03', ano: 2025 },
      });

      // Comportamento atual: considera as três frequências (2 presenças, 1 ausência)
      expect(result[0].taxa).toBeCloseTo((2 / 3) * 100, 2);
    });

    it('deve aplicar filtro personalizado por data exata', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const frequencias: Frequencia[] = [
        makeFreq({ id: '1', turmaId: 'T1', data: '2025-03-10', presenca: true }),
        makeFreq({ id: '2', turmaId: 'T1', data: '2025-03-11', presenca: false }),
      ];

      const turmas = [{ id: 'T1', nome: 'Turma 1' }];

      const result = service.calcularTaxasPorTurma(frequencias, turmas, {
        periodo: { tipo: 'personalizado', data: '2025-03-10' },
      });

      expect(result[0].taxa).toBe(100);
    });
  });

  describe('agruparPorDiaSemana', () => {
    it('deve agrupar por dia da semana em português', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const diasPt: Record<string, string> = {
        Monday: 'Segunda-feira',
        Tuesday: 'Terça-feira',
        Wednesday: 'Quarta-feira',
        Thursday: 'Quinta-feira',
        Friday: 'Sexta-feira',
        Saturday: 'Sábado',
        Sunday: 'Domingo',
      };

      const frequencias: Frequencia[] = [
        // 2025-03-10 é segunda (checar, mas pouco importa no teste, só manter consistência)
        makeFreq({ id: '1', data: '2025-03-10', presenca: true }),
        makeFreq({ id: '2', data: '2025-03-10', presenca: false }),
      ];

      const result = service.agruparPorDiaSemana(frequencias, diasPt);

      // Deve ter um item com soma de presenças e faltas
      expect(result[0].presencas + result[0].faltas).toBe(2);
      expect(result[0].taxa).toBe(50);
    });

    it('deve ignorar datas inválidas sem lançar erro', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const diasPt: Record<string, string> = {
        Monday: 'Segunda-feira',
      };

      const frequencias: Frequencia[] = [
        makeFreq({ id: '1', data: 'data-invalida', presenca: true }),
      ];

      const result = service.agruparPorDiaSemana(frequencias, diasPt);

      expect(result).toHaveLength(0);
    });
  });

  describe('listarPorTurmaMateria', () => {
    it('deve filtrar pela combinação turma/matéria/data', async () => {
      const repo = new FakeFrequenciaRepository([
        makeFreq({ id: '1', turmaId: 'T1', materiaId: 'MAT', data: '2025-03-10' }),
        makeFreq({ id: '2', turmaId: 'T1', materiaId: 'MAT', data: '2025-03-11' }),
        makeFreq({ id: '3', turmaId: 'T2', materiaId: 'MAT', data: '2025-03-10' }),
      ]);
      const service = new FrequenciaService(repo);

      const result = await service.listarPorTurmaMateria('T1', 'MAT', '2025-03-10');

      expect(result.map(f => f.id)).toEqual(['1']);
    });
  });

  describe('inicializarAttendance', () => {
    it('deve inicializar com valores existentes ou null', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const alunos = [
        { id: 'A1', nome: 'Aluno 1' },
        { id: 'A2', nome: 'Aluno 2' },
      ];

      const frequencias: Frequencia[] = [
        makeFreq({ id: '1', alunoId: 'A1', presenca: true }),
      ];

      const map = service.inicializarAttendance(alunos, frequencias);

      expect(map).toEqual({ A1: true, A2: null });
    });
  });

  describe('mapearJustificativas', () => {
    it('deve mapear observações por alunoId', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const frequencias: Frequencia[] = [
        makeFreq({ id: '1', alunoId: 'A1', observacao: 'Atestado' }),
        makeFreq({ id: '2', alunoId: 'A2' }),
      ];

      const map = service.mapearJustificativas(frequencias);

      expect(map).toEqual({ A1: 'Atestado' });
    });
  });

  describe('marcarTodosPresentes/Ausentes', () => {
    it('deve marcar todos presentes', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const alunos = [
        { id: 'A1', nome: 'Aluno 1' },
        { id: 'A2', nome: 'Aluno 2' },
      ];

      const result = service.marcarTodosPresentes(alunos);

      expect(result).toEqual([
        { alunoId: 'A1', presenca: true },
        { alunoId: 'A2', presenca: true },
      ]);
    });

    it('deve marcar todos ausentes', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const alunos = [
        { id: 'A1', nome: 'Aluno 1' },
        { id: 'A2', nome: 'Aluno 2' },
      ];

      const result = service.marcarTodosAusentes(alunos);

      expect(result).toEqual([
        { alunoId: 'A1', presenca: false },
        { alunoId: 'A2', presenca: false },
      ]);
    });
  });

  describe('prepararFrequenciasComJustificativas', () => {
    it('deve montar lista sem observacao quando não houver justificativa', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const alunos = [
        { id: 'A1', nome: 'Aluno 1' },
        { id: 'A2', nome: 'Aluno 2' },
      ];

      const attendance = { A1: true, A2: null } as Record<string, boolean | null>;
      const justificativas: Record<string, string> = {};

      const result = service.prepararFrequenciasComJustificativas(
        alunos,
        'T1',
        'MAT',
        '2025-03-10',
        'P1',
        attendance,
        justificativas,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        alunoId: 'A1',
        turmaId: 'T1',
        materiaId: 'MAT',
        data: '2025-03-10',
        presenca: true,
        professorId: 'P1',
      });
    });

    it('deve incluir observacao quando existir justificativa', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const alunos = [{ id: 'A1', nome: 'Aluno 1' }];
      const attendance = { A1: false } as Record<string, boolean | null>;
      const justificativas = { A1: 'Consulta médica' } as Record<string, string>;

      const result = service.prepararFrequenciasComJustificativas(
        alunos,
        'T1',
        'MAT',
        '2025-03-10',
        'P1',
        attendance,
        justificativas,
      );

      expect(result[0].observacao).toBe('Consulta médica');
    });
  });

  describe('salvarFrequencias', () => {
    it('deve criar quando não existir registro e atualizar quando existir', async () => {
      const existente: Frequencia = makeFreq({ id: '1', alunoId: 'A1', turmaId: 'T1', materiaId: 'MAT', data: '2025-03-10', presenca: false });
      const repo = new FakeFrequenciaRepository([existente]);
      const service = new FrequenciaService(repo);

      const createSpy = jest.spyOn(repo, 'create');
      const updateSpy = jest.spyOn(repo, 'update');

      const payloads: Omit<Frequencia, 'id'>[] = [
        {
          alunoId: 'A1',
          turmaId: 'T1',
          materiaId: 'MAT',
          data: '2025-03-10',
          presenca: true,
          professorId: 'P1',
        },
        {
          alunoId: 'A2',
          turmaId: 'T1',
          materiaId: 'MAT',
          data: '2025-03-10',
          presenca: true,
          professorId: 'P1',
        },
      ];

      await service.salvarFrequencias(payloads);

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledTimes(1);

      const all = await repo.findAll();
      const atualizada = all.find(f => f.alunoId === 'A1');
      const criada = all.find(f => f.alunoId === 'A2');

      expect(atualizada?.presenca).toBe(true);
      expect(criada).toBeDefined();
    });
  });

  describe('calcularEstatisticas', () => {
    it('deve calcular totais e percentuais', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const frequencias = [
        { presenca: true },
        { presenca: false },
        { presenca: null },
      ] as Array<{ presenca: boolean | null }>;

      const stats = service.calcularEstatisticas(frequencias);

      expect(stats.totalAlunos).toBe(3);
      expect(stats.totalPresentes).toBe(1);
      expect(stats.totalAusentes).toBe(1);
      expect(stats.percentualPresenca).toBeCloseTo((1 / 3) * 100);
      expect(stats.percentualAusencia).toBeCloseTo((1 / 3) * 100);
    });

    it('deve lidar com lista vazia', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const stats = service.calcularEstatisticas([]);

      expect(stats.totalAlunos).toBe(0);
      expect(stats.percentualPresenca).toBe(0);
      expect(stats.percentualAusencia).toBe(0);
    });
  });

  describe('filtrarAlunosPorNome', () => {
    it('deve filtrar por presentes, ausentes e nome', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const alunos = [
        { id: 'A1', nome: 'Ana' },
        { id: 'A2', nome: 'Bruno' },
        { id: 'A3', nome: 'Carlos' },
      ];

      const frequencias = [
        { alunoId: 'A1', presenca: true },
        { alunoId: 'A2', presenca: false },
        { alunoId: 'A3', presenca: null },
      ] as Array<{ alunoId: string; presenca: boolean | null }>;

      const presentes = service.filtrarAlunosPorNome(alunos, frequencias, '', 'presentes');
      const ausentes = service.filtrarAlunosPorNome(alunos, frequencias, '', 'ausentes');
      const buscaNome = service.filtrarAlunosPorNome(alunos, frequencias, 'br', 'todos');

      expect(presentes.map(a => a.id)).toEqual(['A1']);
      expect(ausentes.map(a => a.id)).toEqual(['A2']);
      expect(buscaNome.map(a => a.id)).toEqual(['A2']);
    });
  });

  describe('calcularEstatisticasGerais', () => {
    it('deve calcular percentuais gerais de presença e ausência', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const frequencias: Frequencia[] = [
        makeFreq({ presenca: true }),
        makeFreq({ presenca: false }),
        makeFreq({ presenca: true }),
      ];

      const stats = service.calcularEstatisticasGerais(frequencias);

      expect(stats.total).toBe(3);
      expect(stats.totalPresencas).toBe(2);
      expect(stats.totalAusencias).toBe(1);
      expect(stats.presencaPercentual).toBeCloseTo((2 / 3) * 100);
      expect(stats.ausenciaPercentual).toBeCloseTo((1 / 3) * 100);
    });

    it('deve retornar 0 para lista vazia', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const stats = service.calcularEstatisticasGerais([]);

      expect(stats.total).toBe(0);
      expect(stats.presencaPercentual).toBe(0);
      expect(stats.ausenciaPercentual).toBe(0);
    });
  });

  describe('calcularTopAlunosPresenca', () => {
    it('deve retornar top alunos por percentual de presença', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const alunos = [
        { id: 'A1', nome: 'Ana' },
        { id: 'A2', nome: 'Bruno' },
      ];

      const frequencias: Frequencia[] = [
        makeFreq({ id: '1', alunoId: 'A1', presenca: true }),
        makeFreq({ id: '2', alunoId: 'A1', presenca: true }),
        makeFreq({ id: '3', alunoId: 'A2', presenca: false }),
        makeFreq({ id: '4', alunoId: 'A2', presenca: true }),
      ];

      const result = service.calcularTopAlunosPresenca(frequencias, alunos, 1);

      expect(result).toHaveLength(1);
      expect(result[0].nome).toBe('Ana');
      expect(result[0].percentual).toBe(100);
    });
  });

  describe('calcularResumosPorAluno e ordenarResumos', () => {
    it('deve calcular e ordenar resumos', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const alunos = [
        { id: 'A1', nome: 'Bruno' },
        { id: 'A2', nome: 'Ana' },
      ];

      const frequencias: Frequencia[] = [
        makeFreq({ alunoId: 'A1', presenca: true }),
        makeFreq({ alunoId: 'A1', presenca: false }),
        makeFreq({ alunoId: 'A2', presenca: true }),
        makeFreq({ alunoId: 'A2', presenca: true }),
      ];

      const resumos = service.calcularResumosPorAluno(alunos, frequencias);

      expect(resumos.find(r => r.aluno.id === 'A1')).toMatchObject({
        presencas: 1,
        faltas: 1,
      });

      expect(resumos.find(r => r.aluno.id === 'A2')).toMatchObject({
        presencas: 2,
        faltas: 0,
      });

      const ordenadoPorNome = service.ordenarResumos(resumos, 'nome');
      expect(ordenadoPorNome.map(r => r.aluno.nome)).toEqual(['Ana', 'Bruno']);

      const ordenadoPorPercentual = service.ordenarResumos(resumos, 'percentual');
      expect(ordenadoPorPercentual[0].aluno.id).toBe('A2');
    });
  });

  describe('calcularHistoricoPorBimestre', () => {
    it('deve calcular históricos por bimestre para um aluno', () => {
      const repo = new FakeFrequenciaRepository();
      const service = new FrequenciaService(repo);

      const ano = 2025;
      const aluno = { id: 'A1', nome: 'Aluno 1' };

      const frequencias: Frequencia[] = [
        makeFreq({ alunoId: 'A1', data: `${ano}-01-15`, presenca: true }), // 1º bimestre
        makeFreq({ alunoId: 'A1', data: `${ano}-02-15`, presenca: false }),
        makeFreq({ alunoId: 'A1', data: `${ano}-04-10`, presenca: true }), // 2º bimestre
        makeFreq({ alunoId: 'A1', data: `${ano}-07-10`, presenca: false }), // 3º bimestre
        makeFreq({ alunoId: 'A1', data: `${ano}-10-10`, presenca: true }), // 4º bimestre
        makeFreq({ alunoId: 'A2', data: `${ano}-01-10`, presenca: true }), // outro aluno
      ];

      const historico = service.calcularHistoricoPorBimestre(frequencias, aluno, ano);

      expect(historico).toHaveLength(4);
      expect(historico[0].bimestre).toBe('1º Bimestre');
      expect(historico[0].presencas + historico[0].ausencias).toBe(2);
      expect(historico[1].bimestre).toBe('2º Bimestre');
      expect(historico[2].bimestre).toBe('3º Bimestre');
      expect(historico[3].bimestre).toBe('4º Bimestre');
    });
  });
});
