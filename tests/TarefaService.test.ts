import { TarefaService, UrlValidationResult } from '../src/services/data/TarefaService';
import { Tarefa } from '../src/models/Tarefa';
import { Entrega } from '../src/models/Entrega';

jest.mock('jspdf', () => {
  class JsPDFMock {
    text = jest.fn();
    save = jest.fn();
  }

  return {
    __esModule: true,
    default: JsPDFMock,
  };
});

jest.mock('jspdf-autotable', () => {
  return {
    __esModule: true,
    default: jest.fn(),
  };
});

jest.mock('xlsx', () => {
  const writeFile = jest.fn();
  return {
    utils: {
      json_to_sheet: jest.fn(() => ({})),
      book_new: jest.fn(() => ({})),
      book_append_sheet: jest.fn(),
    },
    writeFile,
  };
});

const makeTarefa = (overrides: Partial<Tarefa> = {}): Tarefa => ({
  id: overrides.id ?? '1',
  materiaId: overrides.materiaId ?? 'M1',
  titulo: overrides.titulo ?? 'Tarefa 1',
  descricao: overrides.descricao ?? 'Descrição',
  turmaId: overrides.turmaId ?? 'T1',
  anoLetivo: overrides.anoLetivo ?? '2024',
  dataEntrega: overrides.dataEntrega ?? new Date().toISOString(),
  professorId: overrides.professorId ?? 'P1',
  excluida: overrides.excluida,
  bloqueado: overrides.bloqueado,
  links: overrides.links,
});

const makeEntrega = (overrides: Partial<Entrega> = {}): Entrega => ({
  id: overrides.id ?? '1',
  alunoId: overrides.alunoId ?? 'A1',
  tarefaId: overrides.tarefaId ?? 'T1',
  dataEntrega: overrides.dataEntrega ?? new Date().toISOString(),
  status: overrides.status ?? 'pendente',
  dataConclusao: overrides.dataConclusao,
  anexoUrl: overrides.anexoUrl,
  observacoes: overrides.observacoes,
});

describe('TarefaService', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  describe('CRUD de tarefas (Cloud Function)', () => {
    it('listarTarefas deve chamar a Cloud Function com action "listar"', async () => {
      const tarefasMock = [makeTarefa({ id: '1' }), makeTarefa({ id: '2' })];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => tarefasMock,
      });

      const service = new TarefaService();
      const result = await service.listarTarefas();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'tarefa', action: 'listar' }),
        }),
      );
      expect(result.map(t => t.id)).toEqual(['1', '2']);
    });

    it('listarTarefasPorTurmas deve enviar turmaIds', async () => {
      const tarefasMock = [makeTarefa({ id: '2', turmaId: 'T2' })];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => tarefasMock,
      });

      const service = new TarefaService();
      const result = await service.listarTarefasPorTurmas(['T2']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'tarefa', action: 'listarPorTurmas', turmaIds: ['T2'] }),
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('buscarTarefaPorId deve enviar id', async () => {
      const tarefaMock = makeTarefa({ id: '2' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => tarefaMock,
      });

      const service = new TarefaService();
      const found = await service.buscarTarefaPorId('2');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'tarefa', action: 'buscarPorId', id: '2' }),
        }),
      );
      expect(found?.id).toBe('2');
    });

    it('criarTarefa deve enviar dados da tarefa', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'id-1' }),
      });

      const service = new TarefaService();
      const id = await service.criarTarefa({
        materiaId: 'M1',
        titulo: 'Nova tarefa',
        descricao: 'Desc',
        turmaId: 'T1',
        anoLetivo: '2024',
        dataEntrega: new Date().toISOString(),
        professorId: 'P1',
        links: [],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(id).toBe('id-1');
    });

    it('atualizarTarefa deve enviar id e dados parciais', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const service = new TarefaService();
      await service.atualizarTarefa('1', { titulo: 'Nova' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'tarefa', action: 'atualizar', id: '1', tarefa: { titulo: 'Nova' } }),
        }),
      );
    });

    it('excluirTarefa deve enviar id', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const service = new TarefaService();
      await service.excluirTarefa('1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'tarefa', action: 'excluir', id: '1' }),
        }),
      );
    });
  });

  describe('CRUD de entregas (Cloud Function)', () => {
    it('listarEntregas deve chamar a Cloud Function com action "listarEntregas"', async () => {
      const entregasMock = [makeEntrega({ id: 'e1' }), makeEntrega({ id: 'e2' })];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => entregasMock,
      });

      const service = new TarefaService();
      const result = await service.listarEntregas();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'tarefa', action: 'listarEntregas' }),
        }),
      );
      expect(result.map(e => e.id)).toEqual(['e1', 'e2']);
    });

    it('buscarEntregaPorId deve enviar id', async () => {
      const entregaMock = makeEntrega({ id: 'e1' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => entregaMock,
      });

      const service = new TarefaService();
      const found = await service.buscarEntregaPorId('e1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'tarefa', action: 'buscarEntregaPorId', id: 'e1' }),
        }),
      );
      expect(found?.id).toBe('e1');
    });

    it('buscarEntregaPorAlunoETarefa deve enviar alunoId e tarefaId', async () => {
      const entregaMock = makeEntrega({ alunoId: 'A1', tarefaId: 'T1' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => entregaMock,
      });

      const service = new TarefaService();
      const found = await service.buscarEntregaPorAlunoETarefa('A1', 'T1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'tarefa', action: 'buscarEntregaPorAlunoETarefa', alunoId: 'A1', tarefaId: 'T1' }),
        }),
      );
      expect(found?.alunoId).toBe('A1');
    });

    it('atualizarOuCriarEntrega deve enviar alunoId, tarefaId e status', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'e-nova' }),
      });

      const service = new TarefaService();
      const id = await service.atualizarOuCriarEntrega('A1', 'T1', 'concluida');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'tarefa', action: 'atualizarOuCriarEntrega', alunoId: 'A1', tarefaId: 'T1', status: 'concluida' }),
        }),
      );
      expect(id).toBe('e-nova');
    });

    it('atualizarObservacoes deve enviar entregaId e observacoes', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const service = new TarefaService();
      await service.atualizarObservacoes('e1', 'Observação teste');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'tarefa', action: 'atualizarObservacoes', entregaId: 'e1', observacoes: 'Observação teste' }),
        }),
      );
    });
  });

  describe('Validação de URL e links', () => {
    it('validarUrl deve delegar para validateUrlFn', async () => {
      const service = new TarefaService();

      const mockValidate = jest.fn<Promise<UrlValidationResult>, [string]>(async url => ({
        isValid: true,
        sanitizedUrl: url + '/safe',
      }));

      const result = await service.validarUrl('http://exemplo.com', mockValidate);

      expect(mockValidate).toHaveBeenCalledWith('http://exemplo.com');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedUrl).toBe('http://exemplo.com/safe');
    });

    it('processarValidacaoLink deve tratar URL inválida com erro', () => {
      const service = new TarefaService();

      const result = service.processarValidacaoLink({
        isValid: false,
        error: 'Malicioso',
      });

      expect(result.erro).toContain('BLOQUEADO');
      expect(result.avisos).toHaveLength(0);
    });

    it('processarValidacaoLink deve tratar categorias trusted e educational', () => {
      const service = new TarefaService();

      const trusted = service.processarValidacaoLink({
        isValid: true,
        securityScore: 95,
        domainCategory: 'trusted',
      });
      expect(trusted.sucesso).toContain('confiável');

      const educational = service.processarValidacaoLink({
        isValid: true,
        securityScore: 90,
        domainCategory: 'educational',
      });
      expect(educational.sucesso).toContain('educacional');
    });

    it('processarValidacaoLink deve tratar categoria unknown com allowWithWarning', () => {
      const service = new TarefaService();

      const result = service.processarValidacaoLink({
        isValid: true,
        securityScore: 85,
        domainCategory: 'unknown',
        allowWithWarning: true,
        warnings: ['Aviso existente'],
      });

      expect(result.sucesso).toContain('aceito com verificação extra');
      expect(result.avisos.length).toBeGreaterThanOrEqual(2);
    });

    it('processarValidacaoLink deve adicionar aviso quando score < 80', () => {
      const service = new TarefaService();

      const result = service.processarValidacaoLink({
        isValid: true,
        securityScore: 70,
        domainCategory: 'trusted',
        warnings: [],
      });

      expect(result.avisos.some(a => a.includes('Score de segurança moderado'))).toBe(true);
    });

    it('validarESanitizarLinks deve manter apenas links válidos e usar sanitizedUrl', async () => {
      const service = new TarefaService();

      const validateFn = jest.fn<Promise<UrlValidationResult>, [string]>(async url => {
        if (url.includes('bad')) {
          return { isValid: false };
        }
        return { isValid: true, sanitizedUrl: url + '/safe' };
      });

      const links = [
        { url: 'http://ok.com', titulo: 'Ok' },
        { url: 'http://bad.com', titulo: 'Bad' },
      ];

      const result = await service.validarESanitizarLinks(links, validateFn);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('http://ok.com/safe');
    });

    it('filtrarLinksSegurosDeTarefas deve manter apenas links seguros por tarefa', async () => {
      const service = new TarefaService();

      const isSafeFn = jest.fn<Promise<boolean>, [string]>(async url => !url.includes('bad'));

      const tarefas: Tarefa[] = [
        makeTarefa({ id: 'T1', links: [
          { url: 'http://ok.com', titulo: 'Ok' },
          { url: 'http://bad.com', titulo: 'Bad' },
        ] }),
        makeTarefa({ id: 'T2', links: [] }),
        makeTarefa({ id: 'T3' }),
      ];

      const result = await service.filtrarLinksSegurosDeTarefas(tarefas, isSafeFn);

      expect(result['T1']).toHaveLength(1);
      expect(result['T1'][0].url).toBe('http://ok.com');
      expect(result['T2']).toEqual([]);
      expect(result['T3']).toEqual([]);
    });
  });

  describe('Preparação e validação de tarefa', () => {
    it('prepararDadosTarefa deve montar payload com links e possivel bloqueado', () => {
      const service = new TarefaService();

      const validatedLinks = [
        { url: 'http://ok.com', titulo: 'Ok' },
      ];

      const payload = service.prepararDadosTarefa(
        'M1',
        'Titulo',
        'Descricao',
        'T1',
        '2024',
        '2024-01-01',
        'P1',
        validatedLinks,
        2, // originalLinksCount maior que validatedLinks.length
      );

      expect(payload.links).toEqual(validatedLinks);
      expect(payload.bloqueado).toBe(false);
    });

    it('validarFormularioTarefa deve validar campos obrigatórios', () => {
      const service = new TarefaService();

      expect(service.validarFormularioTarefa('', 'desc', 'T1', '2024-01-01').valido).toBe(false);
      expect(service.validarFormularioTarefa('M1', '', 'T1', '2024-01-01').valido).toBe(false);
      expect(service.validarFormularioTarefa('M1', '  ', 'T1', '2024-01-01').valido).toBe(false);
      expect(service.validarFormularioTarefa('M1', 'desc', '', '2024-01-01').valido).toBe(false);
      expect(service.validarFormularioTarefa('M1', 'desc', 'T1', '').valido).toBe(false);

      expect(
        service.validarFormularioTarefa('M1', 'desc', 'T1', '2024-01-01').valido,
      ).toBe(true);
    });
  });

  describe('Filtros, ordenação e status', () => {
    it('filtrarTarefas deve filtrar por turma, materia e excluida', () => {
      const service = new TarefaService();

      const tarefas: Tarefa[] = [
        makeTarefa({ id: '1', turmaId: 'T1', materiaId: 'M1', excluida: false }),
        makeTarefa({ id: '2', turmaId: 'T1', materiaId: 'M2', excluida: false }),
        makeTarefa({ id: '3', turmaId: 'T2', materiaId: 'M1', excluida: false }),
        makeTarefa({ id: '4', turmaId: 'T1', materiaId: 'M1', excluida: true }),
      ];

      const result = service.filtrarTarefas(tarefas, 'T1', 'M1');
      expect(result.map(t => t.id)).toEqual(['1']);
    });

    it('filtrarTarefasPorMaterias deve manter apenas materias permitidas', () => {
      const service = new TarefaService();

      const tarefas: Tarefa[] = [
        makeTarefa({ id: '1', materiaId: 'M1' }),
        makeTarefa({ id: '2', materiaId: 'M2' }),
        makeTarefa({ id: '3', materiaId: 'M3' }),
      ];

      const result = service.filtrarTarefasPorMaterias(tarefas, ['M1', 'M3']);
      expect(result.map(t => t.id).sort()).toEqual(['1', '3']);
    });

    it('ordenarTarefas deve ordenar por titulo e por data', () => {
      const service = new TarefaService();

      const tarefas: Tarefa[] = [
        makeTarefa({ id: '1', titulo: 'B', dataEntrega: '2024-01-02' }),
        makeTarefa({ id: '2', titulo: 'A', dataEntrega: '2024-01-03' }),
        makeTarefa({ id: '3', titulo: 'C', dataEntrega: '2024-01-01' }),
      ];

      const porTitulo = service.ordenarTarefas(tarefas, 'titulo');
      expect(porTitulo.map(t => t.id)).toEqual(['2', '1', '3']);

      const porData = service.ordenarTarefas(tarefas, 'data');
      expect(porData.map(t => t.id)).toEqual(['2', '1', '3']); // data desc
    });

    it('calcularStatusTarefa deve considerar dataEntrega em relação a hoje', () => {
      const service = new TarefaService();

      const hoje = new Date();
      const ontem = new Date(hoje);
      ontem.setDate(hoje.getDate() - 1);
      const amanha = new Date(hoje);
      amanha.setDate(hoje.getDate() + 1);

      // Usa o ISO completo para evitar efeitos de fuso horário
      const fmt = (d: Date) => d.toISOString();

      expect(service.calcularStatusTarefa('')).toBe('sem_data');
      expect(service.calcularStatusTarefa(fmt(ontem))).toBe('concluida');
      expect(service.calcularStatusTarefa(fmt(hoje))).toBe('em_andamento');
      expect(service.calcularStatusTarefa(fmt(amanha))).toBe('em_andamento');
    });

    it('obterLabelStatus deve retornar label e classe corretos', () => {
      const service = new TarefaService();

      expect(service.obterLabelStatus('concluida')).toEqual({
        label: 'Concluída',
        className: 'status-badge enviado',
      });

      expect(service.obterLabelStatus('em_andamento')).toEqual({
        label: 'Em andamento',
        className: 'status-badge agendado',
      });

      expect(service.obterLabelStatus('sem_data')).toEqual({
        label: 'Sem data',
        className: 'status-badge rascunho',
      });
    });
  });

  describe('Exportação e utilitários', () => {
    it('exportarPDF deve gerar relatório sem erros', () => {
      const service = new TarefaService();

      const tarefa = makeTarefa({ id: 'T1', titulo: 'Tarefa' });
      const alunos = [
        { id: 'A1', nome: 'Ana' },
        { id: 'A2', nome: 'Bruno' },
      ];

      const entregas: Entrega[] = [
        makeEntrega({ id: 'e1', alunoId: 'A1', tarefaId: 'T1', status: 'concluida', dataConclusao: '2024-01-01' }),
      ];

      const formatarDataBR = (data: string) => `br-${data}`;

      expect(() => service.exportarPDF(tarefa, alunos, entregas, formatarDataBR)).not.toThrow();
    });

    it('exportarExcel deve gerar relatório sem erros', () => {
      const service = new TarefaService();

      const tarefa = makeTarefa({ id: 'T1', titulo: 'Tarefa' });
      const alunos = [
        { id: 'A1', nome: 'Ana' },
        { id: 'A2', nome: 'Bruno' },
      ];

      const entregas: Entrega[] = [
        makeEntrega({ id: 'e1', alunoId: 'A1', tarefaId: 'T1', status: 'concluida', dataConclusao: '2024-01-01' }),
      ];

      const formatarDataBR = (data: string) => `br-${data}`;

      expect(() => service.exportarExcel(tarefa, alunos, entregas, formatarDataBR)).not.toThrow();
    });

    it('formatarDataBR deve formatar datas no formato brasileiro', () => {
      const service = new TarefaService();

      const dataISO = '2024-01-15';
      const formattedISO = service.formatarDataBR(dataISO);
      expect(formattedISO).toMatch(/15\/01\/2024|15\/1\/2024/);

      const dataFull = new Date(2024, 0, 20).toISOString();
      const formattedFull = service.formatarDataBR(dataFull);
      expect(formattedFull).toMatch(/20\/01\/2024|20\/1\/2024/);

      expect(service.formatarDataBR('')).toBe('-');
      expect(service.formatarDataBR('invalid')).toBe('invalid');
    });

    it('contarEntregasPorStatus deve contar corretamente por tarefa', () => {
      const service = new TarefaService();

      const entregas: Entrega[] = [
        makeEntrega({ tarefaId: 'T1', status: 'concluida' }),
        makeEntrega({ tarefaId: 'T1', status: 'nao_entregue' }),
        makeEntrega({ tarefaId: 'T1', status: 'pendente' }),
        makeEntrega({ tarefaId: 'T2', status: 'concluida' }),
      ];

      const stats = service.contarEntregasPorStatus(entregas, 'T1');

      expect(stats).toEqual({
        concluidas: 1,
        naoEntregues: 1,
        pendentes: 1,
        total: 3,
      });
    });
  });
});
