import { turmaService } from '../src/services/data/TurmaService';
import { Turma } from '../src/models/Turma';

// Mock do repositório FirebaseTurmaRepository usado dentro de TurmaService
jest.mock('../src/repositories/turma/FirebaseTurmaRepository', () => {
  const findAllMock = jest.fn<Promise<Turma[]>, []>();
  const findByIdMock = jest.fn<Promise<Turma | null>, [string]>();
  const createMock = jest.fn<Promise<string>, [Omit<Turma, 'id' | 'turmaOriginalId'>]>();
  const updateMock = jest.fn<
    Promise<void>,
    [string, Partial<Omit<Turma, 'id' | 'turmaOriginalId'>>]
  >();
  const deleteMock = jest.fn<Promise<void>, [string]>();

  class FirebaseTurmaRepository {
    findAll = findAllMock;
    findById = findByIdMock;
    create = createMock;
    update = updateMock;
    delete = deleteMock;
  }

  return {
    __esModule: true,
    FirebaseTurmaRepository,
    findAllMock,
    findByIdMock,
    createMock,
    updateMock,
    deleteMock,
  };
});

// Mocka o módulo de firebase para evitar avaliação de import.meta.env
jest.mock('../src/services/firebase/firebase', () => ({
  db: {},
}), { virtual: true });

// Mock mínimo de firebase/firestore para os métodos usados
jest.mock('firebase/firestore', () => {
  return {
    collection: jest.fn((db, path) => ({ db, path })),
    query: jest.fn((...args) => ({ args })),
    where: jest.fn((field, op, value) => ({ field, op, value })),
    getDocs: jest.fn(async () => ({
      empty: true,
      docs: [],
    })),
    addDoc: jest.fn(async () => ({})),
  };
});

const getRepoMocks = () =>
  jest.requireMock('../src/repositories/turma/FirebaseTurmaRepository') as {
    findAllMock: jest.Mock;
    findByIdMock: jest.Mock;
    createMock: jest.Mock;
    updateMock: jest.Mock;
    deleteMock: jest.Mock;
  };

const makeTurma = (overrides: Partial<Turma> = {}): Turma => ({
  id: overrides.id ?? '1',
  nome: overrides.nome ?? '7 A',
  anoLetivo: overrides.anoLetivo ?? '2024',
  turno: overrides.turno ?? 'Manhã',
  isVirtual: overrides.isVirtual,
  turmaOriginalId: overrides.turmaOriginalId,
});

describe('turmaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('operações básicas com repositório', () => {
    it('listarTodas deve delegar para findAll', async () => {
      const turmas = [makeTurma({ id: '1' }), makeTurma({ id: '2' })];
      const { findAllMock } = getRepoMocks();
      findAllMock.mockResolvedValueOnce(turmas);

      const result = await turmaService.listarTodas();

      expect(findAllMock).toHaveBeenCalled();
      expect(result).toEqual(turmas);
    });

    it('buscarPorId deve delegar para findById', async () => {
      const turma = makeTurma({ id: '1' });
      const { findByIdMock } = getRepoMocks();
      findByIdMock.mockResolvedValueOnce(turma);

      const result = await turmaService.buscarPorId('1');

      expect(findByIdMock).toHaveBeenCalledWith('1');
      expect(result).toEqual(turma);
    });

    it('criar deve validar dados obrigatórios e delegar para create', async () => {
      const { createMock } = getRepoMocks();
      createMock.mockResolvedValueOnce('new-id');

      const payload = {
        nome: '7 A',
        anoLetivo: '2024',
        turno: 'Manhã',
      } as Omit<Turma, 'id' | 'turmaOriginalId'>;

      const id = await turmaService.criar(payload);
      expect(id).toBe('new-id');
  expect(createMock).toHaveBeenCalledWith(payload);
    });

    it('criar deve lançar erro se dados obrigatórios faltarem', async () => {
      await expect(
        turmaService.criar({ nome: '', anoLetivo: '', turno: '' } as any),
      ).rejects.toThrow('Dados obrigatórios da turma não preenchidos');
    });

    it('atualizar deve delegar para update', async () => {
      const { updateMock } = getRepoMocks();
      updateMock.mockResolvedValueOnce(undefined as any);

      await turmaService.atualizar('1', { nome: 'Nova' });

  expect(updateMock).toHaveBeenCalledWith('1', { nome: 'Nova' });
    });

    it('excluir deve delegar para delete', async () => {
      const { deleteMock } = getRepoMocks();
      deleteMock.mockResolvedValueOnce(undefined as any);

      await turmaService.excluir('1');

  expect(deleteMock).toHaveBeenCalledWith('1');
    });
  });

  describe('listarPorAnoLetivo e virtualização', () => {
    it('listarPorAnoLetivo deve filtrar por anoLetivo', async () => {
      const turmas = [
        makeTurma({ id: '1', anoLetivo: '2024' }),
        makeTurma({ id: '2', anoLetivo: '2023' }),
      ];
      const { findAllMock } = getRepoMocks();
      findAllMock.mockResolvedValueOnce(turmas);

      const result = await turmaService.listarPorAnoLetivo('2024');
      expect(result.map(t => t.id)).toEqual(['1']);
    });

    it('listarComVirtualizacao deve criar turmas virtuais do ano anterior quando possível', async () => {
      const turmas = [
        // Ano atual 2024, reais
        makeTurma({ id: '1', anoLetivo: '2024', nome: '7 A', isVirtual: false }),
        makeTurma({ id: '2', anoLetivo: '2024', nome: '8 A', isVirtual: true }),
        // Ano anterior 2023
        makeTurma({ id: '3', anoLetivo: '2023', nome: '7 A', isVirtual: true }), // já existe igual em 2024 => não virtualiza
        makeTurma({ id: '4', anoLetivo: '2023', nome: '9 A', isVirtual: true }), // será virtualizada
        makeTurma({ id: '5', anoLetivo: '2023', nome: '10 A', isVirtual: false }), // isVirtual === false => não virtualiza
      ];
      const { findAllMock } = getRepoMocks();
      findAllMock.mockResolvedValueOnce(turmas);

      const result = await turmaService.listarComVirtualizacao('2024');

      const ids = result.map(t => t.id).sort();
      expect(ids).toContain('1');
      expect(ids).toContain('2');
      expect(ids).toContain('virtual_2024_4');
      expect(ids).not.toContain('virtual_2024_3');
      expect(ids).not.toContain('virtual_2024_5');
    });

    it('obterProximoAnoComVirtualizacao deve combinar turmas reais e virtualizadas do próximo ano', async () => {
      const turmas = [
        // Ano atual 2024
        makeTurma({ id: '1', anoLetivo: '2024', nome: '7 A', isVirtual: true }),
        // 8 A é virtualizável (isVirtual !== false), então deve gerar turma virtual em 2025
        makeTurma({ id: '2', anoLetivo: '2024', nome: '8 A' }),
        // Próximo ano 2025 reais
        makeTurma({ id: '3', anoLetivo: '2025', nome: '7 A', isVirtual: false }),
      ];
      const { findAllMock } = getRepoMocks();
      findAllMock.mockResolvedValueOnce(turmas);

      const result = await turmaService.obterProximoAnoComVirtualizacao('2024');

      const nomes = result.map(t => t.nome);
      expect(nomes).toContain('7 A'); // turma real já existe em 2025
      expect(nomes).toContain('8 A'); // deve ser virtualizada para 2025
      // A virtualizada deve ter id começando com virtual_2025_
      const virtual = result.find(t => t.nome === '8 A');
      expect(virtual?.id.startsWith('virtual_2025_')).toBe(true);
    });

    it('gerarTurmasVirtualizadas deve criar novas turmas para o ano informado', async () => {
      const turmasAtuais = [
        makeTurma({ id: '1', anoLetivo: '2024', nome: '7 A', isVirtual: true }),
        makeTurma({ id: '2', anoLetivo: '2024', nome: '8 A', isVirtual: false }),
      ];

      const result = await turmaService.gerarTurmasVirtualizadas(turmasAtuais, '2025');

      expect(result.map(t => t.id)).toEqual(['virtual_2025_1']);
      expect(result[0].turmaOriginalId).toBe('1');
    });
  });

  describe('promoção, reprovação e transferência', () => {
    it('resolverDestinoReprovacao deve priorizar mesma turma no próximo ano', async () => {
      const turmaAtual = makeTurma({ id: '1', nome: '7 A', anoLetivo: '2024' });
      const proximoAnoTurmas = [
        makeTurma({ id: '2', nome: '7 A', anoLetivo: '2025' }),
        makeTurma({ id: '3', nome: '8 A', anoLetivo: '2025' }),
      ];

      const { findAllMock } = getRepoMocks();
      findAllMock.mockResolvedValueOnce([
        turmaAtual,
        ...proximoAnoTurmas,
      ]);

      const destino = await turmaService.resolverDestinoReprovacao(turmaAtual, '2024');
      expect(destino.id).toBe('2');
    });

    it('resolverDestinoReprovacao deve escolher primeira da mesma série quando não houver mesma turma', async () => {
      const turmaAtual = makeTurma({ id: '1', nome: '7 A Regular', anoLetivo: '2024', isVirtual: false });
      const proximoAnoTurmas = [
        // Mesma série (prefixo "7 A"), mas turma diferente
        makeTurma({ id: '2', nome: '7 A Integral', anoLetivo: '2025' }),
        makeTurma({ id: '3', nome: '8 A', anoLetivo: '2025' }),
      ];

      const { findAllMock } = getRepoMocks();
      findAllMock.mockResolvedValueOnce([
        turmaAtual,
        ...proximoAnoTurmas,
      ]);

      const destino = await turmaService.resolverDestinoReprovacao(turmaAtual, '2024');
      expect(destino.id).toBe('2');
    });

    it('resolverDestinoReprovacao deve criar turma virtual como fallback', async () => {
      const turmaAtual = makeTurma({ id: '1', nome: '7 A', anoLetivo: '2024' });
      const proximoAnoTurmas: Turma[] = [];

      const { findAllMock } = getRepoMocks();
      findAllMock.mockResolvedValueOnce([
        turmaAtual,
        ...proximoAnoTurmas,
      ]);

      const destino = await turmaService.resolverDestinoReprovacao(turmaAtual, '2024');

      expect(destino.id).toBe('virtual_2025_1');
      expect(destino.turmaOriginalId).toBe('1');
      expect(destino.anoLetivo).toBe('2025');
    });

    it('validarPromocao deve impedir promoção para série não superior', () => {
      const turmaAtual = makeTurma({ nome: '7 A' });
      const turmaDestinoIgual = makeTurma({ nome: '7 B' });
      const turmaDestinoInferior = makeTurma({ nome: '6 A' });
      const turmaDestinoSuperior = makeTurma({ nome: '8 A' });

      expect(turmaService.validarPromocao(turmaAtual, turmaDestinoIgual).ok).toBe(false);
      expect(turmaService.validarPromocao(turmaAtual, turmaDestinoInferior).ok).toBe(false);
      expect(turmaService.validarPromocao(turmaAtual, turmaDestinoSuperior).ok).toBe(true);
    });

    it('validarTransferencia deve impedir salto de mais de uma série', () => {
      const turmaAtual = makeTurma({ nome: '7 A' });
      const turmaDestinoOk = makeTurma({ nome: '8 A' });
      const turmaDestinoMuitoSuperior = makeTurma({ nome: '9 A' });

      expect(turmaService.validarTransferencia(turmaAtual, turmaDestinoOk).ok).toBe(true);
      expect(turmaService.validarTransferencia(turmaAtual, turmaDestinoMuitoSuperior).ok).toBe(
        false,
      );
    });

    it('resolverDestinoPromocao deve usar lista do próximo ano e validar promoção', async () => {
      const turmaAtual = makeTurma({ id: '1', nome: '7 A', anoLetivo: '2024' });
      const turmaDestino = makeTurma({ id: '2', nome: '8 A', anoLetivo: '2025' });

      const { findAllMock } = getRepoMocks();
      findAllMock.mockResolvedValueOnce([
        turmaAtual,
        turmaDestino,
      ]);

      const destino = await turmaService.resolverDestinoPromocao(turmaAtual, '2024', '2');

      expect(destino?.id).toBe('2');
    });

    it('resolverDestinoPromocao deve retornar null se validação de promoção falhar', async () => {
      const turmaAtual = makeTurma({ id: '1', nome: '7 A', anoLetivo: '2024' });
      const turmaDestino = makeTurma({ id: '2', nome: '7 B', anoLetivo: '2025' });

      const { findAllMock } = getRepoMocks();
      findAllMock.mockResolvedValueOnce([
        turmaAtual,
        turmaDestino,
      ]);

      const destino = await turmaService.resolverDestinoPromocao(turmaAtual, '2024', '2');

      expect(destino).toBeNull();
    });
  });

  describe('materialização de turmas', () => {
    it('materializarTurma deve criar nova turma e atualizar original para isVirtual false', async () => {
      const { createMock, updateMock } = getRepoMocks();
      createMock.mockResolvedValueOnce('nova-turma-id');
      updateMock.mockResolvedValueOnce(undefined as any);

      const turmaVirtual: Turma = {
        id: 'virtual_2025_1',
        nome: '7 A',
        anoLetivo: '2025',
        turno: 'Manhã',
        turmaOriginalId: '1',
      };

      const novaId = await turmaService.materializarTurma(turmaVirtual);

      expect(novaId).toBe('nova-turma-id');
      expect(createMock).toHaveBeenCalledWith({
        nome: '7 A',
        anoLetivo: '2025',
        turno: 'Manhã',
      });
      expect(updateMock).toHaveBeenCalledWith('1', { isVirtual: false });
    });

    it('materializarTurma deve lançar erro se turma não for virtualizada', async () => {
      const turmaNaoVirtual: Turma = {
        id: '1',
        nome: '7 A',
        anoLetivo: '2025',
        turno: 'Manhã',
      };

      await expect(turmaService.materializarTurma(turmaNaoVirtual)).rejects.toThrow(
        'Turma não é virtualizada',
      );
    });

    it('materializarTurmaVirtualComDados deve retornar ID original se turma não for virtual', async () => {
      const turmaReal: Turma = makeTurma({ id: '1', turmaOriginalId: undefined });
      const { findByIdMock } = getRepoMocks();
      findByIdMock.mockResolvedValueOnce(turmaReal);

      const id = await turmaService.materializarTurmaVirtualComDados('1');
      expect(id).toBe('1');
    });

    it('materializarTurmaVirtualComDados deve materializar turma virtual quando não existir real', async () => {
      const { getDocs } = jest.requireMock('firebase/firestore');

      // getDocs para turmas reais: retorna vazio (nenhuma turma real ainda)
      (getDocs as jest.Mock).mockResolvedValueOnce({ empty: true, docs: [] });
      const { createMock, updateMock } = getRepoMocks();
      createMock.mockResolvedValueOnce('turma-real-id');
      updateMock.mockResolvedValueOnce(undefined as any);

      const turmaVirtual: Turma = {
        id: 'virtual_2025_1',
        nome: '7 A',
        anoLetivo: '2025',
        turno: 'Manhã',
        turmaOriginalId: '1',
      };

      const id = await turmaService.materializarTurmaVirtualComDados(turmaVirtual);

      expect(id).toBe('turma-real-id');
      expect(createMock).toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledWith('1', { isVirtual: false });
    });
  });
});
