import { turmaService } from '../src/services/data/TurmaService';
import { Turma } from '../src/models/Turma';

describe('TurmaService', () => {
  const API_URL = 'https://mobclassapi-3ohr3pb77q-uc.a.run.app';

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  const makeTurma = (overrides: Partial<Turma> = {}): Turma => ({
    id: overrides.id ?? '1',
    nome: overrides.nome ?? '7 A',
    anoLetivo: overrides.anoLetivo ?? '2024',
    turno: overrides.turno ?? 'Manhã',
    isVirtual: overrides.isVirtual,
    turmaOriginalId: overrides.turmaOriginalId,
  });

  const mockFetchSuccess = (data: any) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    });
  };

  const mockFetchError = (statusText = 'Error') => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText,
    });
  };

  describe('operações básicas CRUD', () => {
    it('listarTodas deve chamar API com domain turma e action listar', async () => {
      const turmas = [makeTurma({ id: '1' }), makeTurma({ id: '2' })];
      mockFetchSuccess(turmas);

      const result = await turmaService.listarTodas();

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'turma', action: 'listar' })
      });
      expect(result).toEqual(turmas);
    });

    it('buscarPorId deve chamar API com id', async () => {
      const turma = makeTurma({ id: '1' });
      mockFetchSuccess(turma);

      const result = await turmaService.buscarPorId('1');

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'turma', action: 'buscarPorId', id: '1' })
      });
      expect(result).toEqual(turma);
    });

    it('criar deve validar dados obrigatórios e chamar API', async () => {
      mockFetchSuccess({ id: 'new-id' });

      const payload = {
        nome: '7 A',
        anoLetivo: '2024',
        turno: 'Manhã',
      } as Omit<Turma, 'id' | 'turmaOriginalId'>;

      const id = await turmaService.criar(payload);

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'turma', action: 'criar', turma: payload })
      });
      expect(id).toBe('new-id');
    });

    it('criar deve lançar erro se dados obrigatórios faltarem', async () => {
      await expect(
        turmaService.criar({ nome: '', anoLetivo: '', turno: '' } as any),
      ).rejects.toThrow('Dados obrigatórios da turma não preenchidos');
    });

    it('atualizar deve chamar API com id e dados', async () => {
      mockFetchSuccess({});

      await turmaService.atualizar('1', { nome: 'Nova' });

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'turma', action: 'atualizar', id: '1', turma: { nome: 'Nova' } })
      });
    });

    it('excluir deve chamar API com id', async () => {
      mockFetchSuccess({});

      await turmaService.excluir('1');

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'turma', action: 'excluir', id: '1' })
      });
    });
  });

  describe('listarPorAnoLetivo e virtualização', () => {
    it('listarPorAnoLetivo deve filtrar por anoLetivo', async () => {
      const turmas = [
        makeTurma({ id: '1', anoLetivo: '2024' }),
        makeTurma({ id: '2', anoLetivo: '2023' }),
      ];
      mockFetchSuccess(turmas);

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
      mockFetchSuccess(turmas);

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
      mockFetchSuccess(turmas);

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

      mockFetchSuccess([turmaAtual, ...proximoAnoTurmas]);

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

      mockFetchSuccess([turmaAtual, ...proximoAnoTurmas]);

      const destino = await turmaService.resolverDestinoReprovacao(turmaAtual, '2024');
      expect(destino.id).toBe('2');
    });

    it('resolverDestinoReprovacao deve criar turma virtual como fallback', async () => {
      const turmaAtual = makeTurma({ id: '1', nome: '7 A', anoLetivo: '2024' });
      const proximoAnoTurmas: Turma[] = [];

      mockFetchSuccess([turmaAtual, ...proximoAnoTurmas]);

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

      mockFetchSuccess([turmaAtual, turmaDestino]);

      const destino = await turmaService.resolverDestinoPromocao(turmaAtual, '2024', '2');

      expect(destino?.id).toBe('2');
    });

    it('resolverDestinoPromocao deve retornar null se validação de promoção falhar', async () => {
      const turmaAtual = makeTurma({ id: '1', nome: '7 A', anoLetivo: '2024' });
      const turmaDestino = makeTurma({ id: '2', nome: '7 B', anoLetivo: '2025' });

      mockFetchSuccess([turmaAtual, turmaDestino]);

      const destino = await turmaService.resolverDestinoPromocao(turmaAtual, '2024', '2');

      expect(destino).toBeNull();
    });
  });

  describe('materialização de turmas', () => {
    it('materializarTurma deve chamar API e retornar ID', async () => {
      mockFetchSuccess({ id: 'nova-turma-id' });

      const turmaVirtual: Turma = {
        id: 'virtual_2025_1',
        nome: '7 A',
        anoLetivo: '2025',
        turno: 'Manhã',
        turmaOriginalId: '1',
      };

      const novaId = await turmaService.materializarTurma(turmaVirtual);

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'turma', action: 'materializarTurma', turmaVirtual })
      });
      expect(novaId).toBe('nova-turma-id');
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
      mockFetchSuccess(turmaReal);

      const id = await turmaService.materializarTurmaVirtualComDados('1');
      expect(id).toBe('1');
    });

    it('materializarTurmaVirtualComDados deve chamar API quando turma for virtual', async () => {
      mockFetchSuccess({ id: 'turma-real-id' });

      const turmaVirtual: Turma = {
        id: 'virtual_2025_1',
        nome: '7 A',
        anoLetivo: '2025',
        turno: 'Manhã',
        turmaOriginalId: '1',
      };

      const id = await turmaService.materializarTurmaVirtualComDados(turmaVirtual);

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domain: 'turma', 
          action: 'materializarTurmaVirtualComDados', 
          turmaVirtual,
          excluirAgendasIds: undefined
        })
      });
      expect(id).toBe('turma-real-id');
    });
  });
});
