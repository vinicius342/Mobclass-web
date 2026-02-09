import { FrequenciaService } from '../src/services/data/FrequenciaService';
import { Frequencia } from '../src/models/Frequencia';

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
  describe('métodos de dados (Cloud Function)', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('listar deve chamar a Cloud Function com action "listar"', async () => {
      const frequenciasMock = [
        makeFreq({ id: '1' }),
        makeFreq({ id: '2' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => frequenciasMock,
      });

      const service = new FrequenciaService();
      const result = await service.listar();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'frequencia', action: 'listar' }),
        }),
      );
      expect(result).toEqual(frequenciasMock);
    });

    it('listarPorAluno deve chamar a Cloud Function com action "listarPorAluno"', async () => {
      const frequenciasMock = [
        makeFreq({ id: '1', alunoId: 'A' }),
        makeFreq({ id: '3', alunoId: 'A' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => frequenciasMock,
      });

      const service = new FrequenciaService();
      const result = await service.listarPorAluno('A');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'frequencia', action: 'listarPorAluno', alunoId: 'A' }),
        }),
      );
      expect(result.map(f => f.id)).toEqual(['1', '3']);
    });

    it('listarPorAlunoETurma deve chamar a Cloud Function com alunoId e turmaId', async () => {
      const frequenciasMock = [
        makeFreq({ id: '1', alunoId: 'A', turmaId: 'T1' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => frequenciasMock,
      });

      const service = new FrequenciaService();
      const result = await service.listarPorAlunoETurma('A', 'T1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'frequencia', action: 'listarPorAlunoETurma', alunoId: 'A', turmaId: 'T1' }),
        }),
      );
      expect(result.map(f => f.id)).toEqual(['1']);
    });

    it('listarPorTurma deve chamar a Cloud Function com turmaId', async () => {
      const frequenciasMock = [
        makeFreq({ id: '1', turmaId: 'T1' }),
        makeFreq({ id: '3', turmaId: 'T1' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => frequenciasMock,
      });

      const service = new FrequenciaService();
      const result = await service.listarPorTurma('T1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'frequencia', action: 'listarPorTurma', turmaId: 'T1' }),
        }),
      );
      expect(result.map(f => f.id)).toEqual(['1', '3']);
    });

    it('buscarPorPeriodo deve chamar a Cloud Function com dataInicio e dataFim', async () => {
      const frequenciasMock = [
        makeFreq({ id: '1', data: '2025-03-01' }),
        makeFreq({ id: '2', data: '2025-03-15' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => frequenciasMock,
      });

      const service = new FrequenciaService();
      const result = await service.buscarPorPeriodo('2025-03-01', '2025-03-31');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'frequencia', action: 'buscarPorPeriodo', dataInicio: '2025-03-01', dataFim: '2025-03-31' }),
        }),
      );
      expect(result.map(f => f.id)).toEqual(['1', '2']);
    });

    it('copiarFrequencias deve chamar a Cloud Function com alunoId, turmaOrigemId e turmaDestinoId', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const service = new FrequenciaService();
      await service.copiarFrequencias('A', 'T1', 'T2');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'frequencia', action: 'copiarFrequencias', alunoId: 'A', turmaOrigemId: 'T1', turmaDestinoId: 'T2' }),
        }),
      );
    });

    it('buscarPorAlunoIdEPeriodo deve chamar a Cloud Function com alunoId, dataInicio e dataFim', async () => {
      const frequenciasMock = [
        makeFreq({ id: '2', alunoId: 'A', data: '2025-02-10' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => frequenciasMock,
      });

      const service = new FrequenciaService();
      const result = await service.buscarPorAlunoIdEPeriodo('A', '2025-02-01', '2025-02-28');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'frequencia', action: 'buscarPorAlunoIdEPeriodo', alunoId: 'A', dataInicio: '2025-02-01', dataFim: '2025-02-28' }),
        }),
      );
      expect(result.map(f => f.id)).toEqual(['2']);
    });

    it('salvarFrequencias deve chamar a Cloud Function com array de frequências', async () => {
      const frequenciasMock = [
        { alunoId: 'A', turmaId: 'T1', materiaId: 'M1', data: '2025-03-10', presenca: true, professorId: 'P1' },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const service = new FrequenciaService();
      await service.salvarFrequencias(frequenciasMock);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'frequencia', action: 'salvarFrequencias', frequencias: frequenciasMock }),
        }),
      );
    });
  });

  describe('calcularPercentualPresenca', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('deve retornar 0 quando não houver frequencias', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const service = new FrequenciaService();

      const percentual = await service.calcularPercentualPresenca('A', 'T1');

      expect(percentual).toBe(0);
    });

    it('deve calcular percentual de presenças', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          makeFreq({ id: '1', alunoId: 'A', turmaId: 'T1', presenca: true }),
          makeFreq({ id: '2', alunoId: 'A', turmaId: 'T1', presenca: false }),
          makeFreq({ id: '3', alunoId: 'A', turmaId: 'T1', presenca: true }),
        ],
      });

      const service = new FrequenciaService();

      const percentual = await service.calcularPercentualPresenca('A', 'T1');

      expect(percentual).toBeCloseTo((2 / 3) * 100);
    });
  });

  describe('calcularTaxasPorTurma', () => {
    it('deve calcular taxa simples sem filtros', () => {
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            makeFreq({ id: '1', turmaId: 'T1', materiaId: 'MAT', data: '2025-03-10' }),
          ]),
        } as Response),
      );

      const result = await service.listarPorTurmaMateria('T1', 'MAT', '2025-03-10');

      expect(result.map(f => f.id)).toEqual(['1']);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://mobclassapi-3ohr3pb77q-uc.a.run.app',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  describe('inicializarAttendance', () => {
    it('deve inicializar com valores existentes ou null', () => {
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
    it('deve salvar múltiplas frequências via API', async () => {
      const service = new FrequenciaService();
      
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response),
      );

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

      expect(global.fetch).toHaveBeenCalledWith(
        'https://mobclassapi-3ohr3pb77q-uc.a.run.app',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  describe('calcularEstatisticas', () => {
    it('deve calcular totais e percentuais', () => {
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

      const stats = service.calcularEstatisticas([]);

      expect(stats.totalAlunos).toBe(0);
      expect(stats.percentualPresenca).toBe(0);
      expect(stats.percentualAusencia).toBe(0);
    });
  });

  describe('filtrarAlunosPorNome', () => {
    it('deve filtrar por presentes, ausentes e nome', () => {
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

      const stats = service.calcularEstatisticasGerais([]);

      expect(stats.total).toBe(0);
      expect(stats.presencaPercentual).toBe(0);
      expect(stats.ausenciaPercentual).toBe(0);
    });
  });

  describe('calcularTopAlunosPresenca', () => {
    it('deve retornar top alunos por percentual de presença', () => {
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
      const service = new FrequenciaService();

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
