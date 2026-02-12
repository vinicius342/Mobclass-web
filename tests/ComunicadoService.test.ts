import { ComunicadoService } from '../src/services/data/ComunicadoService';
import { Comunicado } from '../src/models/Comunicado';
import { Timestamp } from 'firebase/firestore';

// Mock simples para Timestamp para facilitar asserções
const mockNow = { source: 'now' } as unknown as Timestamp;
const mockFromDate = (date: Date) => ({ source: 'fromDate', date } as unknown as Timestamp);

jest.mock('firebase/firestore', () => {
  return {
    Timestamp: {
      now: jest.fn(() => mockNow),
      fromDate: jest.fn((date: Date) => mockFromDate(date)),
    },
  };
});

const makeComunicado = (overrides: Partial<Comunicado> = {}): Comunicado => ({
  id: overrides.id ?? '1',
  assunto: overrides.assunto ?? 'Aviso',
  mensagem: overrides.mensagem ?? 'Mensagem padrão',
  turmaId: overrides.turmaId ?? 'turma-1',
  turmaNome: overrides.turmaNome ?? 'Turma 1',
  data: overrides.data ?? (mockNow as Timestamp),
  status: overrides.status ?? 'enviado',
  dataAgendamento: overrides.dataAgendamento,
});

describe('ComunicadoService', () => {
  let service: ComunicadoService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new ComunicadoService();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  describe('métodos de repositório', () => {
    it('deve listar comunicados', async () => {
      const mockComunicados = [
        makeComunicado({ id: '1' }),
        makeComunicado({ id: '2' }),
      ];
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockComunicados,
      });

      const result = await service.listar();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'comunicado', action: 'listar' }),
        })
      );
    });

    it('deve listar comunicados por múltiplas turmas', async () => {
      const mockComunicados = [
        makeComunicado({ id: '1', turmaId: 'A' }),
        makeComunicado({ id: '3', turmaId: 'C' }),
      ];
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockComunicados,
      });

      const result = await service.listarPorTurmas(['A', 'C']);

      expect(result.map(c => c.id)).toEqual(['1', '3']);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'comunicado', action: 'listarPorTurmas', turmaIds: ['A', 'C'] }),
        })
      );
    });

    it('deve buscar comunicado por id', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => makeComunicado({ id: '2' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => null,
        });

      const found = await service.buscarPorId('2');
      const notFound = await service.buscarPorId('3');

      expect(found?.id).toBe('2');
      expect(notFound).toBeNull();
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ domain: 'comunicado', action: 'buscarPorId', id: '2' }),
        })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ domain: 'comunicado', action: 'buscarPorId', id: '3' }),
        })
      );
    });

    it('deve criar comunicado', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'id-1' }),
      });

      const id = await service.criar({
        assunto: 'Novo',
        mensagem: 'Mensagem nova',
        turmaId: 'T1',
        turmaNome: 'Turma 1',
        data: mockNow as Timestamp,
        status: 'enviado',
      });

      expect(id).toBe('id-1');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            domain: 'comunicado',
            action: 'criar',
            comunicado: {
              assunto: 'Novo',
              mensagem: 'Mensagem nova',
              turmaId: 'T1',
              turmaNome: 'Turma 1',
              data: mockNow,
              status: 'enviado',
            },
          }),
        })
      );
    });

    it('deve atualizar comunicado', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => undefined,
      });

      await service.atualizar('1', { assunto: 'Atualizado' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            domain: 'comunicado',
            action: 'atualizar',
            id: '1',
            comunicado: { assunto: 'Atualizado' },
          }),
        })
      );
    });

    it('deve deletar comunicado', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => undefined,
      });

      await service.deletar('1');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ domain: 'comunicado', action: 'deletar', id: '1' }),
        })
      );
    });
  });

  describe('filtros simples', () => {
    const service = new ComunicadoService();

    const comunicados: Comunicado[] = [
      makeComunicado({ id: '1', status: 'enviado', turmaId: 'A', assunto: 'Prova' }),
      makeComunicado({ id: '2', status: 'agendado', turmaId: 'B', assunto: 'Reunião' }),
      makeComunicado({ id: '3', status: 'rascunho', turmaId: 'A', assunto: 'Aviso' }),
    ];

    it('filtrarPorStatus deve retornar todos quando status vazio', () => {
      expect(service.filtrarPorStatus(comunicados, '')).toHaveLength(3);
    });

    it('filtrarPorStatus deve filtrar pelo status correto', () => {
      const result = service.filtrarPorStatus(comunicados, 'agendado');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('filtrarPorTurma deve retornar todos quando turmaId vazio', () => {
      expect(service.filtrarPorTurma(comunicados, '')).toHaveLength(3);
    });

    it('filtrarPorTurma deve filtrar pela turma correta', () => {
      const result = service.filtrarPorTurma(comunicados, 'A');
      expect(result.map(c => c.id)).toEqual(['1', '3']);
    });

    it('filtrarPorAssunto deve retornar todos quando assunto vazio', () => {
      expect(service.filtrarPorAssunto(comunicados, '')).toHaveLength(3);
    });

    it('filtrarPorAssunto deve filtrar pelo assunto correto', () => {
      const result = service.filtrarPorAssunto(comunicados, 'Reunião');
      expect(result.map(c => c.id)).toEqual(['2']);
    });
  });

  describe('buscarPorTexto', () => {
    const service = new ComunicadoService();

    const comunicados: Comunicado[] = [
      makeComunicado({ id: '1', assunto: 'Prova de Matemática', mensagem: 'Estudem capítulo 1', turmaNome: '6º ano A' }),
      makeComunicado({ id: '2', assunto: 'Reunião de Pais', mensagem: 'Pauta da reunião', turmaNome: '6º ano B' }),
      makeComunicado({ id: '3', assunto: 'Aviso geral', mensagem: 'Biblioteca fechada', turmaNome: 'Biblioteca' }),
    ];

    it('deve retornar todos quando texto vazio', () => {
      expect(service.buscarPorTexto(comunicados, '')).toHaveLength(3);
    });

    it('deve buscar em assunto, mensagem e turmaNome (case insensitive)', () => {
      const porAssunto = service.buscarPorTexto(comunicados, 'matemática');
      const porMensagem = service.buscarPorTexto(comunicados, 'pauta');
      const porTurmaNome = service.buscarPorTexto(comunicados, 'biblioteca');

      expect(porAssunto.map(c => c.id)).toEqual(['1']);
      expect(porMensagem.map(c => c.id)).toEqual(['2']);
      expect(porTurmaNome.map(c => c.id)).toEqual(['3']);
    });
  });

  describe('aplicarFiltros', () => {
    const service = new ComunicadoService();

    const comunicados: Comunicado[] = [
      makeComunicado({ id: '1', assunto: 'Prova', mensagem: 'Matemática', turmaId: 'A', turmaNome: 'Turma A', status: 'enviado' }),
      makeComunicado({ id: '2', assunto: 'Prova', mensagem: 'Português', turmaId: 'B', turmaNome: 'Turma B', status: 'agendado' }),
      makeComunicado({ id: '3', assunto: 'Reunião', mensagem: 'Geral', turmaId: 'A', turmaNome: 'Turma A', status: 'enviado' }),
    ];

    it('deve aplicar múltiplos filtros em cadeia', () => {
      const resultado = service.aplicarFiltros(comunicados, {
        busca: 'prova',
        turmaId: 'B',
        assunto: 'Prova',
        status: 'agendado',
      });

      expect(resultado.map(c => c.id)).toEqual(['2']);
    });

    it('deve retornar todos quando nenhum filtro informado', () => {
      const resultado = service.aplicarFiltros(comunicados, {});
      expect(resultado).toHaveLength(3);
    });
  });

  describe('extrairAssuntos', () => {
    const service = new ComunicadoService();

    it('deve extrair assuntos únicos e ordenados', () => {
      const comunicados: Comunicado[] = [
        makeComunicado({ assunto: 'Prova' }),
        makeComunicado({ assunto: 'Reunião' }),
        makeComunicado({ assunto: 'Prova' }),
      ];

      const assuntos = service.extrairAssuntos(comunicados);

      expect(assuntos).toEqual(['Prova', 'Reunião'].sort());
    });

    it('deve retornar array vazio quando não houver comunicados', () => {
      const assuntos = service.extrairAssuntos([]);
      expect(assuntos).toEqual([]);
    });
  });

  describe('validarComunicado', () => {
    const service = new ComunicadoService();

    const baseDados = {
      assunto: 'Assunto',
      mensagem: 'Mensagem',
      turmasSelecionadas: ['T1'],
      status: 'enviado',
      dataAgendamento: null as Date | null,
    };

    it('deve falhar quando assunto ou mensagem estiverem vazios', () => {
      const r1 = service.validarComunicado({ ...baseDados, assunto: '', mensagem: 'x' });
      const r2 = service.validarComunicado({ ...baseDados, assunto: 'x', mensagem: '' });

      expect(r1.valido).toBe(false);
      expect(r2.valido).toBe(false);
    });

    it('deve falhar quando nenhuma turma for selecionada', () => {
      const r = service.validarComunicado({ ...baseDados, turmasSelecionadas: [] });
      expect(r.valido).toBe(false);
    });

    it('deve exigir dataAgendamento quando status for agendado', () => {
      const r1 = service.validarComunicado({ ...baseDados, status: 'agendado', dataAgendamento: null });
      const r2 = service.validarComunicado({ ...baseDados, status: 'agendado', dataAgendamento: new Date() });

      expect(r1.valido).toBe(false);
      expect(r2.valido).toBe(true);
    });

    it('deve ser válido em cenário feliz', () => {
      const r = service.validarComunicado(baseDados);
      expect(r.valido).toBe(true);
    });
  });

  describe('criarParaMultiplasTurmas', () => {
    let service: ComunicadoService;
    let fetchMock: jest.Mock;

    beforeEach(() => {
      service = new ComunicadoService();
      fetchMock = jest.fn();
      global.fetch = fetchMock;
    });

    it('deve criar comunicados para cada turma usando status enviado', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'id-1' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'id-2' }) });

      const dados = {
        assunto: 'Aviso',
        mensagem: 'Mensagem',
        status: 'enviado' as const,
      };

      const turmas = [
        { id: 'T1', nome: 'Turma 1' },
        { id: 'T2', nome: 'Turma 2' },
      ];

      const count = await service.criarParaMultiplasTurmas(dados, turmas);

      expect(count).toBe(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            domain: 'comunicado',
            action: 'criar',
            comunicado: {
              assunto: 'Aviso',
              mensagem: 'Mensagem',
              turmaId: 'T1',
              turmaNome: 'Turma 1',
              data: mockNow,
              status: 'enviado',
            },
          }),
        })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            domain: 'comunicado',
            action: 'criar',
            comunicado: {
              assunto: 'Aviso',
              mensagem: 'Mensagem',
              turmaId: 'T2',
              turmaNome: 'Turma 2',
              data: mockNow,
              status: 'enviado',
            },
          }),
        })
      );
    });

    it('deve preencher dataAgendamento quando status for agendado e data fornecida', async () => {
      const agendamento = new Date();
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'id-1' }) });

      const dados = {
        assunto: 'Aviso',
        mensagem: 'Mensagem',
        status: 'agendado' as const,
        dataAgendamento: agendamento,
      };

      const turmas = [{ id: 'T1', nome: 'Turma 1' }];

      const count = await service.criarParaMultiplasTurmas(dados, turmas);

      expect(count).toBe(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            domain: 'comunicado',
            action: 'criar',
            comunicado: {
              assunto: 'Aviso',
              mensagem: 'Mensagem',
              turmaId: 'T1',
              turmaNome: 'Turma 1',
              data: mockNow,
              status: 'agendado',
              dataAgendamento: mockFromDate(agendamento),
            },
          }),
        })
      );
    });
  });

  describe('prepararPayloadAtualizacao', () => {
    it('deve montar payload básico com timestamp atual', () => {
      const service = new ComunicadoService();

      const dados = {
        assunto: 'Assunto',
        mensagem: 'Mensagem',
        turmaId: 'T1',
        turmaNome: 'Turma 1',
        status: 'enviado' as const,
      };

      const payload = service.prepararPayloadAtualizacao(dados);

      expect(payload).toMatchObject({
        assunto: 'Assunto',
        mensagem: 'Mensagem',
        turmaId: 'T1',
        turmaNome: 'Turma 1',
        status: 'enviado',
      });
      expect(payload.data).toBe(mockNow);
      expect(payload).not.toHaveProperty('dataAgendamento');
    });

    it('deve incluir dataAgendamento quando status for agendado e data fornecida', () => {
      const service = new ComunicadoService();
      const agendamento = new Date();

      const dados = {
        assunto: 'Assunto',
        mensagem: 'Mensagem',
        turmaId: 'T1',
        turmaNome: 'Turma 1',
        status: 'agendado' as const,
        dataAgendamento: agendamento,
      };

      const payload = service.prepararPayloadAtualizacao(dados);

      expect(payload.status).toBe('agendado');
      expect(payload.dataAgendamento).toEqual(mockFromDate(agendamento));
    });
  });
});
