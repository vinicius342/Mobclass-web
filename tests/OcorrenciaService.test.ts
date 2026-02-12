import { OcorrenciaService, TIPOS_OCORRENCIA_PADRAO } from '../src/services/data/OcorrenciaService';
import { Ocorrencia } from '../src/models/Ocorrencia';

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

const makeOcorrencia = (overrides: Partial<Ocorrencia> = {}): Ocorrencia => ({
  id: overrides.id ?? '1',
  titulo: overrides.titulo ?? 'Ocorrência',
  descricao: overrides.descricao ?? 'Descrição',
  tipo: overrides.tipo ?? 'nao_fez_atividade',
  gravidade: overrides.gravidade ?? 'baixa',
  status: overrides.status ?? 'aberta',
  alunoId: overrides.alunoId ?? 'A1',
  alunoNome: overrides.alunoNome ?? 'Aluno 1',
  turmaId: overrides.turmaId ?? 'T1',
  turmaNome: overrides.turmaNome ?? 'Turma 1',
  professorId: overrides.professorId ?? 'P1',
  professorNome: overrides.professorNome ?? 'Professor 1',
  dataOcorrencia: overrides.dataOcorrencia ?? new Date().toISOString(),
  dataCriacao: overrides.dataCriacao ?? new Date().toISOString(),
  dataResolucao: overrides.dataResolucao,
  observacoes: overrides.observacoes,
  medidas: overrides.medidas,
});

describe('OcorrenciaService', () => {
  let service: OcorrenciaService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new OcorrenciaService();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  describe('métodos de repositório', () => {
    it('listar deve chamar API com domain ocorrencia', async () => {
      const mockOcorrencias = [
        makeOcorrencia({ id: '1' }),
        makeOcorrencia({ id: '2' }),
      ];
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOcorrencias,
      });

      const result = await service.listar();
      
      expect(result.map(o => o.id)).toEqual(['1', '2']);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domain: 'ocorrencia', action: 'listar' }),
        })
      );
    });

    it('buscarPorId deve chamar API com id', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => makeOcorrencia({ id: '2' }),
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
          body: JSON.stringify({ domain: 'ocorrencia', action: 'buscarPorId', id: '2' }),
        })
      );
    });

    it('criar deve chamar API e retornar id', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'id-1' }),
      });

      const id = await service.criar({
        titulo: 'Nova',
        descricao: 'Desc',
        tipo: 'nao_fez_atividade',
        gravidade: 'baixa',
        status: 'aberta',
        alunoId: 'A1',
        alunoNome: 'Aluno 1',
        turmaId: 'T1',
        turmaNome: 'Turma 1',
        professorId: 'P1',
        professorNome: 'Prof',
        dataOcorrencia: new Date().toISOString(),
        dataCriacao: new Date().toISOString(),
        observacoes: '',
        medidas: '',
      });

      expect(id).toBe('id-1');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"domain":"ocorrencia"'),
        })
      );
    });

    it('atualizar deve chamar API com id e dados', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => undefined,
      });

      await service.atualizar('1', { descricao: 'Nova' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            domain: 'ocorrencia',
            action: 'atualizar',
            id: '1',
            ocorrencia: { descricao: 'Nova' },
          }),
        })
      );
    });

    it('excluir deve chamar API com id', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => undefined,
      });

      await service.excluir('1');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ domain: 'ocorrencia', action: 'deletar', id: '1' }),
        })
      );
    });
  });

  describe('obterLabelTipo, extrairTiposPersonalizados, obterTodosOsTipos', () => {
    it('obterLabelTipo deve retornar label de tipo padrão', () => {
      const tipo = TIPOS_OCORRENCIA_PADRAO[0];
      expect(service.obterLabelTipo(tipo.value)).toBe(tipo.label);
    });

    it('obterLabelTipo deve retornar tipo personalizado quando presente na lista', () => {
      expect(service.obterLabelTipo('novo_tipo', ['novo_tipo'])).toBe('novo_tipo');
    });

    it('obterLabelTipo deve formatar fallback com espaços e capitalização', () => {
      expect(service.obterLabelTipo('tipo_personalizado')).toBe('Tipo personalizado');
    });

    it('extrairTiposPersonalizados deve retornar apenas tipos não padrão', () => {
      const ocorrencias: Ocorrencia[] = [
        makeOcorrencia({ tipo: TIPOS_OCORRENCIA_PADRAO[0].value }),
        makeOcorrencia({ tipo: 'personalizado' }),
        makeOcorrencia({ tipo: 'outro_tipo' }),
      ];

      const tipos = service.extrairTiposPersonalizados(ocorrencias);

      expect(tipos.map(t => t.value).sort()).toEqual(['outro_tipo', 'personalizado'].sort());
    });

    it('obterTodosOsTipos deve juntar padrão e personalizados', () => {
      const ocorrencias: Ocorrencia[] = [makeOcorrencia({ tipo: 'personalizado' })];

      const tipos = service.obterTodosOsTipos(ocorrencias);

      expect(tipos.length).toBe(TIPOS_OCORRENCIA_PADRAO.length + 1);
      expect(tipos.some(t => t.value === 'personalizado')).toBe(true);
    });
  });

  describe('filtrar', () => {
    it('deve aplicar filtros de tipo, turma, aluno e busca textual', () => {
      const ocorrencias: Ocorrencia[] = [
        makeOcorrencia({
          id: '1',
          tipo: 'nao_fez_atividade',
          turmaId: 'T1',
          alunoId: 'A1',
          alunoNome: 'Ana',
          descricao: 'Não fez a tarefa',
          turmaNome: 'Turma 1',
        }),
        makeOcorrencia({
          id: '2',
          tipo: 'esqueceu_material',
          turmaId: 'T2',
          alunoId: 'A2',
          alunoNome: 'Bruno',
          descricao: 'Esqueceu o livro',
          turmaNome: 'Turma 2',
        }),
      ];

      const filtrado = service.filtrar(
        ocorrencias,
        'nao_fez_atividade',
        'T1',
        'A1',
        'ana',
      );

      expect(filtrado.map(o => o.id)).toEqual(['1']);

      const buscaPorTipo = service.filtrar(ocorrencias, '', '', '', 'atividade');
      expect(buscaPorTipo.map(o => o.id)).toContain('1');

      const buscaPorTurma = service.filtrar(ocorrencias, '', '', '', 'turma 2');
      expect(buscaPorTurma.map(o => o.id)).toContain('2');
    });
  });

  describe('calcularEstatisticas e contarOcorrenciasAlunoNoAno', () => {
    it('deve calcular estatísticas básicas', () => {
      const now = new Date();
      const esteMes = now.toISOString();
      const outroMes = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const ocorrencias: Ocorrencia[] = [
        makeOcorrencia({ id: '1', dataCriacao: esteMes, gravidade: 'critica' }),
        makeOcorrencia({ id: '2', dataCriacao: esteMes, gravidade: 'baixa' }),
        makeOcorrencia({ id: '3', dataCriacao: outroMes, gravidade: 'critica' }),
      ];

      const stats = service.calcularEstatisticas(ocorrencias);

      expect(stats.total).toBe(3);
      expect(stats.feitasEsteMes).toBe(2);
      expect(stats.criticas).toBe(2);
    });

    it('deve contar ocorrências de aluno no ano atual', () => {
      const anoAtual = new Date().getFullYear();
      const esteAno = new Date(anoAtual, 0, 1).toISOString();
      const anoPassado = new Date(anoAtual - 1, 0, 1).toISOString();

      const ocorrencias: Ocorrencia[] = [
        makeOcorrencia({ id: '1', alunoId: 'A1', dataCriacao: esteAno }),
        makeOcorrencia({ id: '2', alunoId: 'A1', dataCriacao: anoPassado }),
        makeOcorrencia({ id: '3', alunoId: 'A2', dataCriacao: esteAno }),
      ];

      const count = service.contarOcorrenciasAlunoNoAno(ocorrencias, 'A1');
      expect(count).toBe(1);
    });
  });

  describe('prepararDadosOcorrencia e validarFormulario', () => {
    it('deve preparar dados para criação, incluindo dataCriacao e dataResolucao quando resolvida', () => {
      const formData = {
        tipo: 'nao_fez_atividade',
        tipoPersonalizado: '',
        gravidade: 'baixa' as const,
        status: 'resolvida' as const,
        alunoId: 'A1',
        turmaId: 'T1',
        observacoes: 'Obs',
        medidas: 'Medidas',
      };

      const aluno = { id: 'A1', nome: 'Aluno 1', turmaId: 'T1' };
      const turma = { id: 'T1', nome: 'Turma 1' };
      const professor = { uid: 'P1', nome: 'Professor 1', email: 'p1@example.com' };

      const dados = service.prepararDadosOcorrencia(formData, aluno, turma, professor, false);

      expect(dados.titulo).toBeDefined();
      // Deve priorizar as observações fornecidas no formulário
      expect(dados.descricao).toBe('Obs');
      expect(dados.alunoNome).toBe('Aluno 1');
      expect(dados.turmaNome).toBe('Turma 1');
      expect(dados.professorId).toBe('P1');
      expect(dados.professorNome).toBe('Professor 1');
      expect(dados.dataCriacao).toBeDefined();
      expect(dados.dataResolucao).toBeDefined();
    });

    it('deve usar tipoPersonalizado quando tipo for "outro"', () => {
      const formData = {
        tipo: 'outro',
        tipoPersonalizado: 'nova_ocorrencia',
        gravidade: 'baixa' as const,
        status: 'aberta' as const,
        alunoId: 'A1',
        turmaId: 'T1',
        observacoes: '',
        medidas: '',
      };

      const dados = service.prepararDadosOcorrencia(formData, undefined, undefined, undefined, false);

      expect(dados.tipo).toBe('nova_ocorrencia');
      expect(dados.titulo).toBe('Nova ocorrencia');
    });

    it('validarFormulario deve garantir aluno e tipo personalizado quando necessário', () => {
      const invalidoSemAluno = service.validarFormulario({
        tipo: 'nao_fez_atividade',
        tipoPersonalizado: '',
        alunoId: '',
      });
      expect(invalidoSemAluno.valido).toBe(false);

      const invalidoSemTipoPers = service.validarFormulario({
        tipo: 'outro',
        tipoPersonalizado: '',
        alunoId: 'A1',
      });
      expect(invalidoSemTipoPers.valido).toBe(false);

      const valido = service.validarFormulario({
        tipo: 'nao_fez_atividade',
        tipoPersonalizado: '',
        alunoId: 'A1',
      });
      expect(valido.valido).toBe(true);
    });
  });

  describe('prepararParaExportacao, exportarPDF e exportarExcel', () => {
    it('prepararParaExportacao deve aplicar filtros e ordenar por data desc', () => {
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);

      const ocorrencias: Ocorrencia[] = [
        makeOcorrencia({ id: '1', tipo: 'tipo1', turmaId: 'T1', alunoId: 'A1', dataCriacao: ontem.toISOString() }),
        makeOcorrencia({ id: '2', tipo: 'tipo1', turmaId: 'T1', alunoId: 'A1', dataCriacao: new Date().toISOString() }),
        makeOcorrencia({ id: '3', tipo: 'tipo2', turmaId: 'T2', alunoId: 'A2' }),
      ];

      const result = service.prepararParaExportacao(ocorrencias, 'tipo1', 'T1', 'A1');

      expect(result.map(o => o.id)).toEqual(['2', '1']);
    });

    it('exportarPDF deve chamar jsPDF e autotable sem erros', () => {
      const ocorrencias: Ocorrencia[] = [makeOcorrencia({})];

      expect(() => service.exportarPDF(ocorrencias)).not.toThrow();
    });

    it('exportarExcel deve chamar XLSX.writeFile sem erros', () => {
      const ocorrencias: Ocorrencia[] = [makeOcorrencia({})];

      expect(() => service.exportarExcel(ocorrencias)).not.toThrow();
    });
  });

  describe('isTipoPadrao e paginarOcorrencias', () => {
    it('isTipoPadrao deve verificar se tipo é padrão', () => {
      const tipoPadrao = TIPOS_OCORRENCIA_PADRAO[0].value;
      expect(service.isTipoPadrao(tipoPadrao)).toBe(true);
      expect(service.isTipoPadrao('nao_existente')).toBe(false);
    });

    it('paginarOcorrencias deve paginar corretamente', () => {
      const ocorrencias: Ocorrencia[] = [
        makeOcorrencia({ id: '1' }),
        makeOcorrencia({ id: '2' }),
        makeOcorrencia({ id: '3' }),
      ];

      const { ocorrenciasPaginadas, totalPaginas, totalItens } = service.paginarOcorrencias(
        ocorrencias,
        1,
        2,
      );

      expect(totalItens).toBe(3);
      expect(totalPaginas).toBe(2);
      expect(ocorrenciasPaginadas.map(o => o.id)).toEqual(['1', '2']);
    });
  });
});
