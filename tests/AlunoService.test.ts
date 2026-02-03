import { AlunoService } from '../src/services/usuario/AlunoService';
import { Aluno } from '../src/models/Aluno';
import { IAlunoRepository } from '../src/repositories/aluno/IAlunoRepository';
import { INotaRepository } from '../src/repositories/nota/INotaRepository';
import { IFrequenciaRepository } from '../src/repositories/frequencia/IFrequenciaRepository';

class FakeAlunoRepository implements IAlunoRepository {
  public alunos: Aluno[];

  constructor(initialAlunos: Aluno[] = []) {
    this.alunos = [...initialAlunos];
  }

  async findAll(): Promise<Aluno[]> {
    return this.alunos;
  }

  async findById(id: string): Promise<Aluno | null> {
    return this.alunos.find(a => a.id === id) ?? null;
  }

  async create(aluno: Omit<Aluno, 'id'>): Promise<string> {
    const id = `id-${this.alunos.length + 1}`;
    this.alunos.push({ id, ...aluno });
    return id;
  }

  async update(id: string, aluno: Partial<Omit<Aluno, 'id'>>): Promise<void> {
    this.alunos = this.alunos.map(a => (a.id === id ? { ...a, ...aluno } : a));
  }

  async delete(id: string): Promise<void> {
    this.alunos = this.alunos.filter(a => a.id !== id);
  }

  async findByTurmaEAnoLetivo(turmaId: string, anoLetivo: string): Promise<Aluno[]> {
    return this.alunos.filter(a => a.turmaId === turmaId && a.historicoTurmas?.[anoLetivo] !== undefined);
  }

  async updateHistorico(
    alunoId: string,
    anoAtual: string,
    anoDestino: string,
    turmaId: string,
    status: 'promovido' | 'reprovado' | 'transferido',
  ): Promise<void> {
    this.alunos = this.alunos.map(aluno => {
      if (aluno.id !== alunoId) return aluno;
      const historicoTurmas = { ...(aluno.historicoTurmas || {}) };
      const historicoStatus = { ...(aluno.historicoStatus || {}) };
      historicoTurmas[anoDestino] = turmaId;
      historicoStatus[anoDestino] = status;
      return { ...aluno, historicoTurmas, historicoStatus };
    });
  }
}

class FakeNotaRepository implements INotaRepository {
  constructor(public notas: any[] = [], public copiarNotasCalled: any[] = []) {}

  async findAll() { return this.notas as any; }
  async findById() { return null as any; }
  async create() { return 'id-1'; }
  async update() { }
  async delete() { }
  async findByAlunoUid() { return this.notas as any; }
  async findByAlunoUidETurma(alunoUid: string, turmaId: string) {
    return this.notas.filter(n => n.alunoUid === alunoUid && n.turmaId === turmaId) as any;
  }
  async findByTurmaId() { return [] as any; }
  async copiarNotas(alunoUid: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    this.copiarNotasCalled.push({ alunoUid, turmaOrigemId, turmaDestinoId });
  }
}

class FakeFrequenciaRepository implements IFrequenciaRepository {
  constructor(public copiarFrequenciasCalled: any[] = []) {}

  async findAll() { return [] as any; }
  async findById() { return null as any; }
  async create() { return 'id-1'; }
  async update() { }
  async delete() { }
  async findByAlunoId() { return [] as any; }
  async findByAlunoIdETurma() { return [] as any; }
  async findByTurmaId() { return [] as any; }
  async findByTurmaMateria() { return [] as any; }
  async findByAlunoIdEPeriodo() { return [] as any; }
  async findByPeriodo() { return [] as any; }
  async salvarEmLote() { }
  async copiarFrequencias(alunoId: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    this.copiarFrequenciasCalled.push({ alunoId, turmaOrigemId, turmaDestinoId });
  }
}

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

describe('AlunoService - operações básicas e histórico', () => {
  it('listar deve delegar para o repositório', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1' }),
      makeAluno({ id: 'a2' }),
    ]);
    const service = new AlunoService(repo);

    const result = await service.listar();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a1');
    expect(result[1].id).toBe('a2');
  });

  it('buscarPorId deve retornar aluno correto ou null', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1' }),
      makeAluno({ id: 'a2' }),
    ]);
    const service = new AlunoService(repo);

    const found = await service.buscarPorId('a2');
    const notFound = await service.buscarPorId('a3');

    expect(found?.id).toBe('a2');
    expect(notFound).toBeNull();
  });

  it('promoverAluno, reprovarAluno e transferirAluno devem delegar para updateHistorico com status correto', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1' }),
    ]);
    const service = new AlunoService(repo);

    await service.promoverAluno('a1', '2023', '2024', 'turma-2');
    await service.reprovarAluno('a1', '2024', '2024', 'turma-3');
    await service.transferirAluno('a1', '2024', '2024', 'turma-4');

    const aluno = await service.buscarPorId('a1');
    expect(aluno?.historicoTurmas).toEqual({
      '2024': 'turma-4',
    });
    expect(aluno?.historicoStatus).toEqual({
      '2024': 'transferido',
    });
  });

  it('listarPorTurmaEAnoLetivo deve delegar para o repositório', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1', turmaId: 't1', historicoTurmas: { '2024': 't1' } }),
      makeAluno({ id: 'a2', turmaId: 't2', historicoTurmas: { '2024': 't2' } }),
    ]);
    const service = new AlunoService(repo);

    const result = await service.listarPorTurmaEAnoLetivo('t1', '2024');

    expect(result.map(a => a.id)).toEqual(['a1']);
  });

  it('atualizar deve manter campos não atualizados', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1', nome: 'Original', email: 'orig@escola.com', status: 'Ativo' }),
    ]);
    const service = new AlunoService(repo);

    await service.atualizar('a1', { nome: 'Atualizado' });

    const aluno = await service.buscarPorId('a1');
    expect(aluno?.nome).toBe('Atualizado');
    expect(aluno?.email).toBe('orig@escola.com');
    expect(aluno?.status).toBe('Ativo');
  });

  it('updateHistorico deve delegar corretamente para o repositório', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1' }),
    ]);
    const service = new AlunoService(repo);

    await service.updateHistorico('a1', '2023', '2024', 'turma-2', 'promovido');

    const aluno = await service.buscarPorId('a1');
    expect(aluno?.historicoTurmas).toEqual({ '2024': 'turma-2' });
    expect(aluno?.historicoStatus).toEqual({ '2024': 'promovido' });
  });
});

describe('AlunoService - obterTurmaDoAno', () => {
  it('deve retornar turma do histórico quando existir para o ano', () => {
    const repo = new FakeAlunoRepository();
    const service = new AlunoService(repo);

    const aluno = makeAluno({ turmaId: 'turma-atual', historicoTurmas: { '2024': 'turma-historico' } });

    const turma = service.obterTurmaDoAno(aluno, 2024);
    expect(turma).toBe('turma-historico');
  });

  it('deve retornar turmaId atual quando não houver histórico para o ano', () => {
    const repo = new FakeAlunoRepository();
    const service = new AlunoService(repo);

    const aluno = makeAluno({ turmaId: 'turma-atual', historicoTurmas: { '2023': 'outra-turma' } });

    const turma = service.obterTurmaDoAno(aluno, 2024);
    expect(turma).toBe('turma-atual');
  });
});

describe('AlunoService - calcularStatusAluno', () => {
  it('deve lançar erro se notaRepository não for injetado', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1' }),
    ]);
    const service = new AlunoService(repo);

    await expect(service.calcularStatusAluno(makeAluno({ id: 'a1' }), 2024)).rejects.toThrow(
      'NotaRepository não foi injetado no AlunoService',
    );
  });

  it('deve retornar "Em Andamento" quando não há notas', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1' }),
    ]);
    const notaRepo = new FakeNotaRepository([]);
    const service = new AlunoService(repo, notaRepo);

    const status = await service.calcularStatusAluno(makeAluno({ id: 'a1' }), 2024);
    expect(status).toBe('Em Andamento');
  });

  it('deve retornar "Em Andamento" quando não há notas dos 4 bimestres', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1', turmaId: 't1' }),
    ]);
    const notaRepo = new FakeNotaRepository([
      { id: 'n1', alunoUid: 'a1', turmaId: 't1', materiaId: 'm1', bimestre: '1º' },
    ]);
    const service = new AlunoService(repo, notaRepo);

    const status = await service.calcularStatusAluno(makeAluno({ id: 'a1', turmaId: 't1' }), 2024);
    expect(status).toBe('Em Andamento');
  });

  it('deve retornar "Em Andamento" quando há notas incompletas', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1', turmaId: 't1' }),
    ]);
    const notasIncompletas = [
      { id: 'n1', alunoUid: 'a1', turmaId: 't1', materiaId: 'm1', bimestre: '1º', notaParcial: 7 },
    ];
    const notaRepo = new FakeNotaRepository(notasIncompletas);
    const service = new AlunoService(repo, notaRepo);

    const status = await service.calcularStatusAluno(makeAluno({ id: 'a1', turmaId: 't1' }), 2024);
    expect(status).toBe('Em Andamento');
  });

  it('deve retornar "Aprovado" quando média geral >= 6', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1', turmaId: 't1' }),
    ]);
    const notas = [
      {
        id: 'n1',
        alunoUid: 'a1',
        turmaId: 't1',
        materiaId: 'm1',
        bimestre: '1º',
        notaParcial: 7,
        notaGlobal: 7,
        notaParticipacao: 7,
      },
      {
        id: 'n2',
        alunoUid: 'a1',
        turmaId: 't1',
        materiaId: 'm1',
        bimestre: '2º',
        notaParcial: 7,
        notaGlobal: 7,
        notaParticipacao: 7,
      },
      {
        id: 'n3',
        alunoUid: 'a1',
        turmaId: 't1',
        materiaId: 'm1',
        bimestre: '3º',
        notaParcial: 7,
        notaGlobal: 7,
        notaParticipacao: 7,
      },
      {
        id: 'n4',
        alunoUid: 'a1',
        turmaId: 't1',
        materiaId: 'm1',
        bimestre: '4º',
        notaParcial: 7,
        notaGlobal: 7,
        notaParticipacao: 7,
      },
    ];
    const notaRepo = new FakeNotaRepository(notas);
    const service = new AlunoService(repo, notaRepo);

    const status = await service.calcularStatusAluno(makeAluno({ id: 'a1', turmaId: 't1' }), 2024);
    expect(status).toBe('Aprovado');
  });

  it('deve considerar nota de recuperação se existir', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1', turmaId: 't1' }),
    ]);
    const notas = [
      {
        id: 'n1',
        alunoUid: 'a1',
        turmaId: 't1',
        materiaId: 'm1',
        bimestre: '1º',
        notaParcial: 4,
        notaGlobal: 4,
        notaParticipacao: 4,
        notaRecuperacao: 8,
      },
      {
        id: 'n2',
        alunoUid: 'a1',
        turmaId: 't1',
        materiaId: 'm1',
        bimestre: '2º',
        notaParcial: 7,
        notaGlobal: 7,
        notaParticipacao: 7,
      },
      {
        id: 'n3',
        alunoUid: 'a1',
        turmaId: 't1',
        materiaId: 'm1',
        bimestre: '3º',
        notaParcial: 7,
        notaGlobal: 7,
        notaParticipacao: 7,
      },
      {
        id: 'n4',
        alunoUid: 'a1',
        turmaId: 't1',
        materiaId: 'm1',
        bimestre: '4º',
        notaParcial: 7,
        notaGlobal: 7,
        notaParticipacao: 7,
      },
    ];
    const notaRepo = new FakeNotaRepository(notas);
    const service = new AlunoService(repo, notaRepo);

    const status = await service.calcularStatusAluno(makeAluno({ id: 'a1', turmaId: 't1' }), 2024);
    expect(status).toBe('Aprovado');
  });

  it('deve retornar "Reprovado" quando média geral < 6', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1', turmaId: 't1' }),
    ]);
    const notas = [
      {
        id: 'n1',
        alunoUid: 'a1',
        turmaId: 't1',
        materiaId: 'm1',
        bimestre: '1º',
        notaParcial: 4,
        notaGlobal: 4,
        notaParticipacao: 4,
      },
      {
        id: 'n2',
        alunoUid: 'a1',
        turmaId: 't1',
        materiaId: 'm1',
        bimestre: '2º',
        notaParcial: 4,
        notaGlobal: 4,
        notaParticipacao: 4,
      },
      {
        id: 'n3',
        alunoUid: 'a1',
        turmaId: 't1',
        materiaId: 'm1',
        bimestre: '3º',
        notaParcial: 4,
        notaGlobal: 4,
        notaParticipacao: 4,
      },
      {
        id: 'n4',
        alunoUid: 'a1',
        turmaId: 't1',
        materiaId: 'm1',
        bimestre: '4º',
        notaParcial: 4,
        notaGlobal: 4,
        notaParticipacao: 4,
      },
    ];
    const notaRepo = new FakeNotaRepository(notas);
    const service = new AlunoService(repo, notaRepo);

    const status = await service.calcularStatusAluno(makeAluno({ id: 'a1', turmaId: 't1' }), 2024);
    expect(status).toBe('Reprovado');
  });

  it('deve retornar "Em Andamento" se ocorrer erro inesperado', async () => {
    const repo = new FakeAlunoRepository([
      makeAluno({ id: 'a1', turmaId: 't1' }),
    ]);
    const notaRepo = new FakeNotaRepository();
    jest.spyOn(notaRepo, 'findByAlunoUidETurma').mockRejectedValueOnce(new Error('falha inesperada'));

    const service = new AlunoService(repo, notaRepo);

    const status = await service.calcularStatusAluno(makeAluno({ id: 'a1', turmaId: 't1' }), 2024);
    expect(status).toBe('Em Andamento');
  });
});

describe('AlunoService - copiarDadosAcademicos', () => {
  it('deve chamar copiarNotas e copiarFrequencias quando repositórios estiverem disponíveis', async () => {
    const repo = new FakeAlunoRepository();
    const notaRepo = new FakeNotaRepository();
    const freqRepo = new FakeFrequenciaRepository();

    const service = new AlunoService(repo, notaRepo, freqRepo);

    await service.copiarDadosAcademicos('a1', 't-origem', 't-destino');

    expect(notaRepo.copiarNotasCalled).toEqual([
      { alunoUid: 'a1', turmaOrigemId: 't-origem', turmaDestinoId: 't-destino' },
    ]);
    expect(freqRepo.copiarFrequenciasCalled).toEqual([
      { alunoId: 'a1', turmaOrigemId: 't-origem', turmaDestinoId: 't-destino' },
    ]);
  });

  it('não deve falhar quando repositórios opcionais não são injetados', async () => {
    const repo = new FakeAlunoRepository();
    const service = new AlunoService(repo);

    await expect(
      service.copiarDadosAcademicos('a1', 't-origem', 't-destino'),
    ).resolves.toBeUndefined();
  });

  it('deve propagar erro se copiarNotas/copiarFrequencias falhar', async () => {
    const repo = new FakeAlunoRepository();
    const notaRepo = new FakeNotaRepository();
    const freqRepo = new FakeFrequenciaRepository();

    jest
      .spyOn(notaRepo, 'copiarNotas')
      .mockRejectedValueOnce(new Error('erro na cópia de notas'));

    const service = new AlunoService(repo, notaRepo, freqRepo);

    await expect(
      service.copiarDadosAcademicos('a1', 't-origem', 't-destino'),
    ).rejects.toThrow('erro na cópia de notas');
  });
});
