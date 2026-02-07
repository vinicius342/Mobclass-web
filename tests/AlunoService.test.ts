import { AlunoService } from '../src/services/usuario/AlunoService';
import { Aluno } from '../src/models/Aluno';

const makeAluno = (overrides: Partial<Aluno> = {}): Aluno => ({
  id: overrides.id ?? 'a1',
  nome: overrides.nome ?? 'Aluno 1',
  email: overrides.email ?? 'aluno1@escola.com',
  turmaId: overrides.turmaId ?? 'turma-1',
  status: overrides.status ?? 'Ativo',
  modoAcesso: overrides.modoAcesso,
  historicoTurmas: overrides.historicoTurmas,
  historicoStatus: overrides.historicoStatus,
  dataCriacao: overrides.dataCriacao,
  ultimaAtualizacao: overrides.ultimaAtualizacao,
});

describe('AlunoService (Cloud Function) - integração HTTP', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('listar deve chamar a Cloud Function com action "listar" e retornar alunos', async () => {
    const alunosMock = [makeAluno({ id: 'a1' }), makeAluno({ id: 'a2' })];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => alunosMock,
    });

    const service = new AlunoService();
    const result = await service.listar();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'listar' }),
      }),
    );
    expect(result).toEqual(alunosMock);
  });

  it('buscarPorId deve enviar id e retornar aluno ou null', async () => {
    const alunoMock = makeAluno({ id: 'a1' });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => alunoMock,
    });

    const service = new AlunoService();
    const result = await service.buscarPorId('a1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'buscarPorId', id: 'a1' }),
      }),
    );
    expect(result).toEqual(alunoMock);
  });

  it('promoverAluno, reprovarAluno e transferirAluno devem enviar dados corretos', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const service = new AlunoService();

    await service.promoverAluno('a1', '2023', '2024', 'turma-2');
    await service.reprovarAluno('a1', '2024', '2024', 'turma-3');
    await service.transferirAluno('a1', '2024', '2024', 'turma-4');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ action: 'promoverAluno', id: 'a1', anoAtual: '2023', anoDestino: '2024', turmaId: 'turma-2' }),
      }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ action: 'reprovarAluno', id: 'a1', anoAtual: '2024', anoDestino: '2024', turmaId: 'turma-3' }),
      }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ action: 'transferirAluno', id: 'a1', anoAtual: '2024', anoDestino: '2024', turmaId: 'turma-4' }),
      }),
    );
  });

  it('listarPorTurmaEAnoLetivo deve enviar turmaId e anoLetivo', async () => {
    const alunosMock = [makeAluno({ id: 'a1', turmaId: 't1' })];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => alunosMock,
    });

    const service = new AlunoService();
    const result = await service.listarPorTurmaEAnoLetivo('t1', '2024');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ action: 'listarPorTurmaEAnoLetivo', turmaId: 't1', anoLetivo: '2024' }),
      }),
    );
    expect(result).toEqual(alunosMock);
  });

  it('atualizar deve enviar id e dados parciais do aluno', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const service = new AlunoService();
    await service.atualizar('a1', { nome: 'Atualizado' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ action: 'atualizar', id: 'a1', aluno: { nome: 'Atualizado' } }),
      }),
    );
  });

  it('updateHistorico deve enviar payload completo com status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const service = new AlunoService();
    await service.updateHistorico('a1', '2023', '2024', 'turma-2', 'promovido');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          action: 'updateHistorico',
          id: 'a1',
          anoAtual: '2023',
          anoDestino: '2024',
          turmaId: 'turma-2',
          status: 'promovido',
        }),
      }),
    );
  });
});

describe('AlunoService - obterTurmaDoAno', () => {
  it('deve retornar turma do histórico quando existir para o ano', () => {
    const service = new AlunoService();

    const aluno = makeAluno({ turmaId: 'turma-atual', historicoTurmas: { '2024': 'turma-historico' } });

    const turma = service.obterTurmaDoAno(aluno, 2024);
    expect(turma).toBe('turma-historico');
  });

  it('deve retornar turmaId atual quando não houver histórico para o ano', () => {
    const service = new AlunoService();

    const aluno = makeAluno({ turmaId: 'turma-atual', historicoTurmas: { '2023': 'outra-turma' } });

    const turma = service.obterTurmaDoAno(aluno, 2024);
    expect(turma).toBe('turma-atual');
  });
});

describe('AlunoService - calcularStatusAluno (via Cloud Function)', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('deve enviar alunoId, turmaId e anoLetivo e retornar status da resposta', async () => {
    const aluno = makeAluno({ id: 'a1', turmaId: 't1', historicoTurmas: { '2024': 't1' } });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'Aprovado' }),
    });

    const service = new AlunoService();
    const status = await service.calcularStatusAluno(aluno, 2024);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          action: 'calcularStatusAluno',
          alunoId: 'a1',
          turmaId: 't1',
          anoLetivo: 2024,
        }),
      }),
    );
    expect(status).toBe('Aprovado');
  });

  it('deve retornar "Em Andamento" se a Cloud Function lançar erro', async () => {
    const aluno = makeAluno({ id: 'a1', turmaId: 't1' });

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('falha inesperada'));

    const service = new AlunoService();
    const status = await service.calcularStatusAluno(aluno, 2024);

    expect(status).toBe('Em Andamento');
  });
});

describe('AlunoService - calcularStatusAlunosEmLote (via Cloud Function)', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('deve enviar lista de itens e retornar mapa alunoId -> status', async () => {
    const alunos = [
      makeAluno({ id: 'a1', turmaId: 't1', historicoTurmas: { '2024': 't1' } }),
      makeAluno({ id: 'a2', turmaId: 't2', historicoTurmas: { '2024': 't2' } }),
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ resultados: { a1: 'Aprovado', a2: 'Reprovado' } }),
    });

    const service = new AlunoService();
    const resultados = await service.calcularStatusAlunosEmLote(alunos, 2024);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          action: 'calcularStatusAlunosEmLote',
          itens: [
            { alunoId: 'a1', turmaId: 't1', anoLetivo: 2024 },
            { alunoId: 'a2', turmaId: 't2', anoLetivo: 2024 },
          ],
        }),
      }),
    );

    expect(resultados).toEqual({ a1: 'Aprovado', a2: 'Reprovado' });
  });
});

describe('AlunoService - copiarDadosAcademicos (via Cloud Function)', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('deve enviar alunoId, turmaOrigemId e turmaDestinoId', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const service = new AlunoService();
    await service.copiarDadosAcademicos('a1', 't-origem', 't-destino');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          action: 'copiarDadosAcademicos',
          alunoId: 'a1',
          turmaOrigemId: 't-origem',
          turmaDestinoId: 't-destino',
        }),
      }),
    );
  });
});
