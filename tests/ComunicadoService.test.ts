import { ComunicadoService } from '../src/services/data/ComunicadoService';
import { Comunicado } from '../src/models/Comunicado';
import { IComunicadoRepository } from '../src/repositories/comunicado/IComunicadoRepository';
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

class FakeComunicadoRepository implements IComunicadoRepository {
  private comunicados: Comunicado[];

  constructor(initial: Comunicado[] = []) {
    this.comunicados = [...initial];
  }

  async listar(): Promise<Comunicado[]> {
    return this.comunicados;
  }

  async listarPorTurmas(turmaIds: string[]): Promise<Comunicado[]> {
    return this.comunicados.filter(c => turmaIds.includes(c.turmaId));
  }

  async buscarPorId(id: string): Promise<Comunicado | null> {
    return this.comunicados.find(c => c.id === id) ?? null;
  }

  async criar(comunicado: Omit<Comunicado, 'id'>): Promise<string> {
    const id = `id-${this.comunicados.length + 1}`;
    this.comunicados.push({ id, ...comunicado });
    return id;
  }

  async atualizar(id: string, comunicado: Partial<Omit<Comunicado, 'id'>>): Promise<void> {
    this.comunicados = this.comunicados.map(c => (c.id === id ? { ...c, ...comunicado } : c));
  }

  async deletar(id: string): Promise<void> {
    this.comunicados = this.comunicados.filter(c => c.id !== id);
  }
}

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
  describe('métodos de repositório', () => {
    it('deve listar comunicados', async () => {
      const repo = new FakeComunicadoRepository([
        makeComunicado({ id: '1' }),
        makeComunicado({ id: '2' }),
      ]);
      const service = new ComunicadoService(repo);

      const result = await service.listar();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });

    it('deve listar comunicados por múltiplas turmas', async () => {
      const repo = new FakeComunicadoRepository([
        makeComunicado({ id: '1', turmaId: 'A' }),
        makeComunicado({ id: '2', turmaId: 'B' }),
        makeComunicado({ id: '3', turmaId: 'C' }),
      ]);
      const service = new ComunicadoService(repo);

      const result = await service.listarPorTurmas(['A', 'C']);

      expect(result.map(c => c.id)).toEqual(['1', '3']);
    });

    it('deve buscar comunicado por id', async () => {
      const repo = new FakeComunicadoRepository([
        makeComunicado({ id: '1' }),
        makeComunicado({ id: '2' }),
      ]);
      const service = new ComunicadoService(repo);

      const found = await service.buscarPorId('2');
      const notFound = await service.buscarPorId('3');

      expect(found?.id).toBe('2');
      expect(notFound).toBeNull();
    });

    it('deve criar comunicado', async () => {
      const repo = new FakeComunicadoRepository();
      const service = new ComunicadoService(repo);

      const id = await service.criar({
        assunto: 'Novo',
        mensagem: 'Mensagem nova',
        turmaId: 'T1',
        turmaNome: 'Turma 1',
        data: mockNow as Timestamp,
        status: 'enviado',
      });

      expect(id).toBe('id-1');
      const all = await service.listar();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(id);
    });

    it('deve atualizar comunicado', async () => {
      const repo = new FakeComunicadoRepository([
        makeComunicado({ id: '1', assunto: 'Antigo' }),
      ]);
      const service = new ComunicadoService(repo);

      await service.atualizar('1', { assunto: 'Atualizado' });

      const updated = await service.buscarPorId('1');
      expect(updated?.assunto).toBe('Atualizado');
    });

    it('deve deletar comunicado', async () => {
      const repo = new FakeComunicadoRepository([
        makeComunicado({ id: '1' }),
        makeComunicado({ id: '2' }),
      ]);
      const service = new ComunicadoService(repo);

      await service.deletar('1');

      const all = await service.listar();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('2');
    });
  });

  describe('filtros simples', () => {
    const repo = new FakeComunicadoRepository();
    const service = new ComunicadoService(repo);

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
    const repo = new FakeComunicadoRepository();
    const service = new ComunicadoService(repo);

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
    const repo = new FakeComunicadoRepository();
    const service = new ComunicadoService(repo);

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
    const repo = new FakeComunicadoRepository();
    const service = new ComunicadoService(repo);

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
    const repo = new FakeComunicadoRepository();
    const service = new ComunicadoService(repo);

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
    it('deve criar comunicados para cada turma usando status enviado', async () => {
      const repo = new FakeComunicadoRepository();
      const service = new ComunicadoService(repo);

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
      const all = await repo.listar();
      expect(all).toHaveLength(2);
      expect(all.map(c => c.turmaId)).toEqual(['T1', 'T2']);
      expect(all.every(c => c.status === 'enviado')).toBe(true);
      expect(all.every(c => c.data === mockNow)).toBe(true);
      // não deve ter dataAgendamento quando não for agendado
      expect(all.every(c => c.dataAgendamento === undefined)).toBe(true);
    });

    it('deve preencher dataAgendamento quando status for agendado e data fornecida', async () => {
      const repo = new FakeComunicadoRepository();
      const service = new ComunicadoService(repo);
      const agendamento = new Date();

      const dados = {
        assunto: 'Aviso',
        mensagem: 'Mensagem',
        status: 'agendado' as const,
        dataAgendamento: agendamento,
      };

      const turmas = [{ id: 'T1', nome: 'Turma 1' }];

      const count = await service.criarParaMultiplasTurmas(dados, turmas);

      expect(count).toBe(1);
      const all = await repo.listar();
      expect(all).toHaveLength(1);
      expect(all[0].status).toBe('agendado');
      expect(all[0].dataAgendamento).toEqual(mockFromDate(agendamento));
    });
  });

  describe('prepararPayloadAtualizacao', () => {
    it('deve montar payload básico com timestamp atual', () => {
      const repo = new FakeComunicadoRepository();
      const service = new ComunicadoService(repo);

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
      const repo = new FakeComunicadoRepository();
      const service = new ComunicadoService(repo);
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
