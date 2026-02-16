import { NotaService } from '../src/services/data/NotaService';
import { Nota } from '../src/models/Nota';
import { Aluno } from '../src/models/Aluno';
import { MateriaService } from '../src/services/data/MateriaService';
import { Materia } from '../src/models/Materia';

class FakeMateriaService {
  private materias: Materia[];

  constructor(initial: Materia[] = []) {
    this.materias = [...initial];
  }

  async listar(): Promise<Materia[]> {
    return this.materias;
  }

  async buscarPorId(): Promise<Materia | null> {
    return null;
  }

  async criar(): Promise<string> {
    return 'id';
  }

  async atualizar(): Promise<void> {
    return;
  }

  async excluir(): Promise<void> {
    return;
  }
}

const makeNota = (overrides: Partial<Nota> = {}): Nota => ({
  id: overrides.id ?? '1',
  alunoUid: overrides.alunoUid ?? 'aluno-1',
  bimestre: overrides.bimestre ?? '1º',
  dataLancamento: overrides.dataLancamento ?? new Date('2025-03-10'),
  materiaId: overrides.materiaId ?? 'MAT1',
  notaGlobal: overrides.notaGlobal ?? 8,
  notaParcial: overrides.notaParcial ?? 6,
  notaParticipacao: overrides.notaParticipacao ?? 1,
  notaRecuperacao: overrides.notaRecuperacao ?? null,
  turmaId: overrides.turmaId ?? 'T1',
  nomeAluno: overrides.nomeAluno,
});

const makeAluno = (overrides: Partial<Aluno> = {}): Aluno => ({
  id: overrides.id ?? 'aluno-1',
  nome: overrides.nome ?? 'Aluno 1',
  email: overrides.email ?? 'aluno1@example.com',
  turmaId: overrides.turmaId ?? 'T1',
  status: overrides.status ?? 'Ativo',
  modoAcesso: overrides.modoAcesso,
  historicoTurmas: overrides.historicoTurmas,
  historicoStatus: overrides.historicoStatus,
  dataCriacao: overrides.dataCriacao,
  ultimaAtualizacao: overrides.ultimaAtualizacao,
});
describe('NotaService', () => {
  describe('métodos de dados (Cloud Function)', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('listarPorAluno deve chamar a Cloud Function com action "listarPorAluno" e retornar notas', async () => {
      const notasMock = [
        makeNota({ id: '1', alunoUid: 'A' }),
        makeNota({ id: '2', alunoUid: 'A' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => notasMock,
      });

      const service = new NotaService();
      const result = await service.listarPorAluno('A');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'notas', action: 'listarPorAluno', alunoUid: 'A' }),
        }),
      );
      expect(result).toEqual(notasMock);
    });

    it('listarPorAlunoETurma deve chamar a Cloud Function com alunoUid e turmaId', async () => {
      const notasMock = [
        makeNota({ id: '1', alunoUid: 'A', turmaId: 'T1' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => notasMock,
      });

      const service = new NotaService();
      const result = await service.listarPorAlunoETurma('A', 'T1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'notas', action: 'listarPorAlunoETurma', alunoUid: 'A', turmaId: 'T1' }),
        }),
      );
      expect(result).toEqual(notasMock);
    });

    it('listarPorTurma deve chamar a Cloud Function com turmaId', async () => {
      const notasMock = [makeNota({ id: '1', turmaId: 'T1' })];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => notasMock,
      });

      const service = new NotaService();
      const result = await service.listarPorTurma('T1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'notas', action: 'listarPorTurma', turmaId: 'T1' }),
        }),
      );
      expect(result).toEqual(notasMock);
    });

    it('listarTodas deve chamar a Cloud Function com action "listar"', async () => {
      const notasMock = [makeNota({ id: '1' }), makeNota({ id: '2' })];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => notasMock,
      });

      const service = new NotaService();
      const result = await service.listarTodas();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: "notas", action: 'listar' }),
        }),
      );
      expect(result).toEqual(notasMock);
    });

    it('buscarPorId deve chamar a Cloud Function com action "buscarPorId" e id', async () => {
      const notaMock = makeNota({ id: '2' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => notaMock,
      });

      const service = new NotaService();
      const found = await service.buscarPorId('2');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: "notas", action: 'buscarPorId', id: '2' }),
        }),
      );
      expect(found).toEqual(notaMock);
    });

    it('salvar deve enviar dados da nota e retornar id gerado', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'id-1' }),
      });

      const service = new NotaService();

      const id = await service.salvar({
        alunoUid: 'A',
        bimestre: '1º',
        dataLancamento: new Date('2025-03-10'),
        materiaId: 'MAT1',
        notaGlobal: 8,
        notaParcial: 6,
        notaParticipacao: 1,
        notaRecuperacao: null,
        turmaId: 'T1',
        nomeAluno: 'Aluno 1',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"domain":"notas"'),
        }),
      );
      expect(id).toBe('id-1');
    });

    it('atualizar deve enviar id e dados parciais da nota', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const service = new NotaService();
      await service.atualizar('1', { notaGlobal: 7 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: "notas", action: 'atualizar', id: '1', nota: { notaGlobal: 7 } }),
        }),
      );
    });

    it('excluir deve enviar id para a Cloud Function', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const service = new NotaService();
      await service.excluir('1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: "notas", action: 'excluir', id: '1' }),
        }),
      );
    });

    it('copiarNotas deve enviar alunoUid, turmaOrigemId e turmaDestinoId', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const service = new NotaService();
      await service.copiarNotas('A', 'T1', 'T2');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            domain: 'notas',
            action: 'copiarNotas',
            alunoUid: 'A',
            turmaOrigemId: 'T1',
            turmaDestinoId: 'T2',
          }),
        }),
      );
    });
  });

  describe('calcularMediasPorTurma', () => {
    it('deve calcular média por turma sem filtros', () => {
      const service = new NotaService();

      const notas: Nota[] = [
        makeNota({ turmaId: 'T1', notaParcial: 6, notaGlobal: 8, notaParticipacao: 1 }), // ((6+8)/2)+1 = 8
        makeNota({ turmaId: 'T1', notaParcial: 4, notaGlobal: 6, notaParticipacao: 0 }), // ((4+6)/2)+0 = 5
        makeNota({ turmaId: 'T2', notaParcial: 10, notaGlobal: 10, notaParticipacao: 0 }),
      ];

      const turmas = [
        { id: 'T1', nome: 'Turma 1' },
        { id: 'T2', nome: 'Turma 2' },
      ];

      const result = service.calcularMediasPorTurma(notas, turmas);

      expect(result).toEqual([
        { turma: 'Turma 1', media: parseFloat(((8 + 5) / 2).toFixed(2)) },
        { turma: 'Turma 2', media: 10 },
      ]);
    });

    it('deve filtrar por matéria quando especificada', () => {
      const service = new NotaService();

      const notas: Nota[] = [
        makeNota({ turmaId: 'T1', materiaId: 'MAT1', notaParcial: 6, notaGlobal: 8, notaParticipacao: 1 }),
        makeNota({ turmaId: 'T1', materiaId: 'MAT2', notaParcial: 0, notaGlobal: 0, notaParticipacao: 0 }),
      ];

      const turmas = [{ id: 'T1', nome: 'Turma 1' }];

      const result = service.calcularMediasPorTurma(notas, turmas, { materiaId: 'MAT1' });

      expect(result[0].media).toBe(8);
    });

    it('deve retornar 0 quando turma não tiver notas', () => {
      const service = new NotaService();

      const notas: Nota[] = [];
      const turmas = [{ id: 'T1', nome: 'Turma 1' }];

      const result = service.calcularMediasPorTurma(notas, turmas);

      expect(result[0].media).toBe(0);
    });

    it('deve usar grupoTurmas quando fornecido', () => {
      const service = new NotaService();

      const notas: Nota[] = [
        makeNota({ turmaId: 'T1', notaParcial: 6, notaGlobal: 8, notaParticipacao: 1 }),
        makeNota({ turmaId: 'T2', notaParcial: 10, notaGlobal: 10, notaParticipacao: 0 }),
      ];

      const turmas = [
        { id: 'T1', nome: 'Turma 1' },
        { id: 'T2', nome: 'Turma 2' },
      ];

      const grupo = [{ id: 'T2', nome: 'Turma 2' }];

      const result = service.calcularMediasPorTurma(notas, turmas, { grupoTurmas: grupo });

      expect(result).toHaveLength(1);
      expect(result[0].turma).toBe('Turma 2');
    });
  });

  describe('calcularMediasFinais e distribuirPorDesempenho', () => {
    it('deve calcular médias finais limitando a 10', () => {
      const service = new NotaService();

      const notas: Nota[] = [
        makeNota({ notaParcial: 10, notaGlobal: 10, notaParticipacao: 0 }), // ((10+10)/2)+0 = 10
        makeNota({ notaParcial: 10, notaGlobal: 10, notaParticipacao: 5 }), // 15 -> 10
      ];

      const medias = service.calcularMediasFinais(notas);

      expect(medias).toEqual([10, 10]);
    });

    it('deve distribuir por faixas de desempenho', () => {
      const service = new NotaService();

      const medias = [5, 6.5, 9.2];
      const dist = service.distribuirPorDesempenho(medias);

      expect(dist).toEqual([
        { faixa: 'Baixa (< 6)', value: 1 },
        { faixa: 'Regular (6–9)', value: 1 },
        { faixa: 'Excelente (≥ 9)', value: 1 },
      ]);
    });
  });

  describe('calcularMediaPorMateria', () => {
    it('deve retornar null se não houver notas válidas', () => {
      const service = new NotaService();

      const result = service.calcularMediaPorMateria([null, undefined]);
      expect(result).toBeNull();
    });

    it('deve calcular média com 1 casa decimal', () => {
      const service = new NotaService();

      const result = service.calcularMediaPorMateria([7, 8, null]);
      expect(result).toBe('7.5');
    });
  });

  describe('calcularMediaFinalAluno', () => {
    it('deve retornar null se aluno não tiver notas', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const service = new NotaService();
      const aluno = makeAluno({ id: 'A1', turmaId: 'T1' });

      const media = await service.calcularMediaFinalAluno(aluno, 2025);
      expect(media).toBeNull();
    });

    it('deve usar historicoTurmas quando disponível para ano letivo', async () => {
      const notasMock = [
        makeNota({ id: '1', alunoUid: 'A1', turmaId: 'T2024', notaParcial: 9, notaGlobal: 9, notaParticipacao: 9 }),
      ];

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => notasMock,
      });

      const service = new NotaService();
      const aluno = makeAluno({
        id: 'A1',
        turmaId: 'T1',
        historicoTurmas: { '2025': 'T2024' },
      });

      const media = await service.calcularMediaFinalAluno(aluno, 2025);

      // média = ((9 + 9) / 2) + 9 = 18, limitado a 10
      expect(media).toBe(10);
    });

    it('deve considerar recuperação quando maior que média', async () => {
      const notasMock = [
        makeNota({
          id: '1',
          alunoUid: 'A1',
          turmaId: 'T1',
          notaParcial: 4,
          notaGlobal: 4,
          notaParticipacao: 4,
          notaRecuperacao: 8,
        }),
      ];

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => notasMock,
      });

      const service = new NotaService();
      const aluno = makeAluno({ id: 'A1', turmaId: 'T1' });

      const media = await service.calcularMediaFinalAluno(aluno, 2025);

      // média das três notas = 4, recuperação = 8 -> usa 8
      expect(media).toBe(8);
    });
  });

  describe('gerarBoletimAluno', () => {
    it('deve lançar erro se materiaRepository não for injetado', async () => {
      const service = new NotaService();
      const aluno = makeAluno({ id: 'A1', turmaId: 'T1' });

      await expect(service.gerarBoletimAluno(aluno, 2025)).rejects.toThrow(
        'MateriaService não foi injetado no NotaService',
      );
    });

    it('deve gerar boletim organizado por matéria e bimestre', async () => {
      const materias: Materia[] = [
        { id: 'MAT1', codigo: 'C1', nome: 'Matemática' },
        { id: 'MAT2', codigo: 'C2', nome: 'História' },
      ];
      const materiaRepo = new FakeMateriaService(materias) as any as MateriaService;
      const service = new NotaService(materiaRepo);
      const aluno = makeAluno({ id: 'A1', turmaId: 'T1' });

      const notasMock = [
        makeNota({
          id: '1',
          alunoUid: 'A1',
          turmaId: 'T1',
          materiaId: 'MAT1',
          bimestre: '1º',
          notaParcial: 6,
          notaGlobal: 8,
          notaParticipacao: 1,
        }),
        makeNota({
          id: '2',
          alunoUid: 'A1',
          turmaId: 'T1',
          materiaId: 'MAT2',
          bimestre: '2º',
          notaParcial: 5,
          notaGlobal: 7,
          notaParticipacao: 0,
        }),
      ];

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => notasMock,
      });

      const boletim = await service.gerarBoletimAluno(aluno, 2025);

      expect(boletim).not.toBeNull();
      expect(boletim?.materias.sort()).toEqual(['História', 'Matemática'].sort());
      expect(boletim?.bimestres).toEqual(['1º', '2º', '3º', '4º']);
      expect(boletim?.notas['1º']['Matemática'].mediaFinal).toBeCloseTo(8); // ((6+8)/2)+1
      expect(boletim?.notas['2º']['História'].mediaFinal).toBeCloseTo(6); // ((5+7)/2)+0
    });

    it('deve retornar null quando não houver notas', async () => {
      const materiaRepo = new FakeMateriaService([]) as any as MateriaService;
      const service = new NotaService(materiaRepo);
      const aluno = makeAluno({ id: 'A1', turmaId: 'T1' });

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const boletim = await service.gerarBoletimAluno(aluno, 2025);
      expect(boletim).toBeNull();
    });
  });

  describe('prepararDadosNota e validarNotaPreenchida', () => {
    it('prepararDadosNota deve converter strings para números e null', () => {
      const service = new NotaService();

      const dados = service.prepararDadosNota({
        notaParcial: '7.5',
        notaGlobal: '8',
        notaParticipacao: '',
        notaRecuperacao: '9',
        turmaId: 'T1',
        alunoUid: 'A1',
        materiaId: 'MAT1',
        bimestre: '1º',
      });

      expect(dados.notaParcial).toBe(7.5);
      expect(dados.notaGlobal).toBe(8);
      expect(dados.notaParticipacao).toBeNull();
      expect(dados.notaRecuperacao).toBe(9);
      expect(dados.dataLancamento).toBeInstanceOf(Date);
    });

    it('prepararDadosNota deve incluir id quando fornecido', () => {
      const service = new NotaService();

      const dados = service.prepararDadosNota({
        notaParcial: '7',
        notaGlobal: '8',
        notaParticipacao: '1',
        notaRecuperacao: '',
        turmaId: 'T1',
        alunoUid: 'A1',
        materiaId: 'MAT1',
        bimestre: '1º',
        id: '123',
      });

      expect((dados as any).id).toBe('123');
    });

    it('validarNotaPreenchida deve retornar true se houver ao menos um campo com valor', () => {
      const service = new NotaService();

      expect(
        service.validarNotaPreenchida({ notaParcial: '', notaGlobal: '7', notaParticipacao: '' }),
      ).toBe(true);
      expect(
        service.validarNotaPreenchida({ notaParcial: ' ', notaGlobal: ' ', notaParticipacao: ' ' }),
      ).toBe(false);
    });
  });

  describe('filtrarPorMaterias', () => {
    it('deve filtrar notas por lista de materias', () => {
      const service = new NotaService();

      const notas: Nota[] = [
        makeNota({ id: '1', materiaId: 'MAT1' }),
        makeNota({ id: '2', materiaId: 'MAT2' }),
      ];

      const result = service.filtrarPorMaterias(notas, ['MAT2']);

      expect(result.map(n => n.id)).toEqual(['2']);
    });
  });

  describe('campoAlterado', () => {
    it('deve retornar true quando campo foi alterado em relação à nota original', () => {
      const service = new NotaService();

      const original = makeNota({ notaGlobal: 7 });
      const editada = { notaGlobal: '8' } as Record<string, any>;

      expect(service.campoAlterado(editada, original, 'notaGlobal')).toBe(true);
    });

    it('deve retornar false quando nota original inexistente e campo vazio', () => {
      const service = new NotaService();

      const editada = { notaGlobal: '' } as Record<string, any>;

      expect(service.campoAlterado(editada, undefined, 'notaGlobal')).toBe(false);
    });
  });

  describe('buscarNotaPorFiltros', () => {
    it('deve buscar nota que corresponda a todos os filtros', () => {
      const service = new NotaService();

      const notas: Nota[] = [
        makeNota({
          id: '1',
          turmaId: 'T1',
          materiaId: 'MAT1',
          bimestre: '1º',
          alunoUid: 'A1',
        }),
      ];

      const found = service.buscarNotaPorFiltros(notas, 'T1', 'MAT1', '1º', 'A1');
      expect(found?.id).toBe('1');
    });
  });

  describe('calcularMediaFinal e getNotaColor', () => {
    it('deve calcular média final usando participação e recuperação quando maior', () => {
      const service = new NotaService();

      const nota: Nota = makeNota({
        notaParcial: 6,
        notaGlobal: 8,
        notaParticipacao: 1,
        notaRecuperacao: 9,
      });

      const media = service.calcularMediaFinal(nota);
      // média base = ((6+8)/2)+1 = 8, recuperação=9 -> 9
      expect(media).toBe(9);
    });

    it('getNotaColor deve retornar classes de cor corretas', () => {
      const service = new NotaService();

      expect(service.getNotaColor(null)).toBe('');
      expect(service.getNotaColor(5)).toBe('text-danger');
      expect(service.getNotaColor(7)).toBe('text-warning');
      expect(service.getNotaColor(9)).toBe('text-success');
    });
  });

  describe('formatarData e parseData', () => {
    it('formatarData deve formatar Date em DD/MM/YYYY', () => {
      const service = new NotaService();

      const data = new Date(2025, 2, 10); // 10/03/2025
      const str = service.formatarData(data);

      expect(str).toBe('10/03/2025');
    });

    it('parseData deve converter string DD/MM/YYYY para Date', () => {
      const service = new NotaService();

      const data = service.parseData('10/03/2025');

      expect(data.getFullYear()).toBe(2025);
      expect(data.getMonth()).toBe(2);
      expect(data.getDate()).toBe(10);
    });

    it('parseData deve retornar Date quando já for Date', () => {
      const service = new NotaService();

      const now = new Date();
      expect(service.parseData(now)).toBe(now);
    });
  });

  describe('deduplicarNotasPorAluno', () => {
    it('deve manter apenas a nota mais recente por aluno/matéria e aplicar filtros', () => {
      const service = new NotaService();

      const notas: Nota[] = [
        makeNota({
          id: '1',
          alunoUid: 'A1',
          materiaId: 'MAT1',
          turmaId: 'T1',
          bimestre: '1º',
          dataLancamento: new Date('2025-03-10'),
          nomeAluno: 'Ana',
        }),
        makeNota({
          id: '2',
          alunoUid: 'A1',
          materiaId: 'MAT1',
          turmaId: 'T1',
          bimestre: '1º',
          dataLancamento: new Date('2025-03-15'),
          nomeAluno: 'Ana',
        }),
        makeNota({
          id: '3',
          alunoUid: 'A2',
          materiaId: 'MAT2',
          turmaId: 'T2',
          bimestre: '2º',
          dataLancamento: new Date('2025-03-20'),
          nomeAluno: 'Bruno',
        }),
      ];

      const result = service.deduplicarNotasPorAluno(
        notas,
        'T1',
        'MAT1',
        '1º',
        'ana',
        ['MAT1'],
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2'); // mais recente
    });
  });

  describe('calcularEstatisticasTurma', () => {
    it('deve calcular estatísticas da turma', () => {
      const service = new NotaService();

      const notas: Nota[] = [
        makeNota({ notaParcial: 10, notaGlobal: 10, notaParticipacao: 0 }), // 10
        makeNota({ notaParcial: 8, notaGlobal: 8, notaParticipacao: 0 }), // 8
        makeNota({ notaParcial: 6, notaGlobal: 6, notaParticipacao: 0 }), // 6
        makeNota({ notaParcial: 4, notaGlobal: 4, notaParticipacao: 0 }), // 4
      ];

      const stats = service.calcularEstatisticasTurma(notas);

      expect(stats.totalAlunos).toBe(4);
      expect(stats.mediaTurma).toBe('7.0');
      expect(stats.excelentes).toBeGreaterThanOrEqual(1);
      expect(stats.boas).toBeGreaterThanOrEqual(1);
      expect(stats.regulares).toBeGreaterThanOrEqual(1);
      expect(stats.baixas).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ordenarNotas e paginarNotas', () => {
    it('deve ordenar por nome, campos numéricos, média e data', () => {
      const service = new NotaService();

      const notas: Nota[] = [
        makeNota({ id: '1', nomeAluno: 'Bruno', notaParcial: 8, notaGlobal: 7, notaParticipacao: 0, dataLancamento: new Date('2025-03-10') }),
        makeNota({ id: '2', nomeAluno: 'Ana', notaParcial: 6, notaGlobal: 9, notaParticipacao: 0, dataLancamento: new Date('2025-03-12') }),
      ];

      const porNome = service.ordenarNotas(notas, 'nome');
      expect(porNome.map(n => n.nomeAluno)).toEqual(['Ana', 'Bruno']);

      const porParcial = service.ordenarNotas(notas, 'parcial');
      expect(porParcial[0].notaParcial).toBe(8);

      const porGlobal = service.ordenarNotas(notas, 'global');
      expect(porGlobal[0].notaGlobal).toBe(9);

      const porMedia = service.ordenarNotas(notas, 'media');
      // média nota 1: ((8+7)/2)+0 = 7.5; nota 2: ((6+9)/2)+0 = 7.5
      // empate mantém ordem relativa, então primeiro continua sendo id '1'
      expect(porMedia[0].id).toBe('1');

      const porData = service.ordenarNotas(notas, 'data');
      expect(porData[0].id).toBe('2');
    });

    it('deve paginar notas corretamente', () => {
      const service = new NotaService();

      const notas: Nota[] = [
        makeNota({ id: '1' }),
        makeNota({ id: '2' }),
        makeNota({ id: '3' }),
      ];

      const page1 = service.paginarNotas(notas, 1, 2);
      const page2 = service.paginarNotas(notas, 2, 2);

      expect(page1.map(n => n.id)).toEqual(['1', '2']);
      expect(page2.map(n => n.id)).toEqual(['3']);
    });
  });
});
