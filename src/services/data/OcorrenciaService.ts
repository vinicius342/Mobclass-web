import { Ocorrencia } from '../../models/Ocorrencia';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const API_URL = 'https://mobclassapi-3ohr3pb77q-uc.a.run.app';

// Tipos padrão do sistema
export const TIPOS_OCORRENCIA_PADRAO = [
  { value: 'nao_fez_atividade', label: 'Não Fez a atividade de casa/classe' },
  { value: 'esqueceu_material', label: 'Esqueceu o material didático' },
  { value: 'indisciplina_intervalo', label: 'Indisciplinado no intervalo' },
  { value: 'indisciplina_sala', label: 'Indisciplinado na sala de aula' },
  { value: 'aluno_atrasado', label: 'Aluno atrasado' },
  { value: 'comportamento_agressivo', label: 'Comportamento agressivo' }
];

export class OcorrenciaService {
  async listar(): Promise<Ocorrencia[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'ocorrencia', action: 'listar' })
    });

    if (!response.ok) {
      throw new Error(`Erro ao listar ocorrências: ${response.statusText}`);
    }

    return response.json();
  }

  async listarPorAnoLetivo(anoLetivo: string): Promise<Ocorrencia[]> {
    console.log('📤 Enviando requisição listarPorAnoLetivo com ano:', anoLetivo);
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'ocorrencia', action: 'listarPorAnoLetivo', anoLetivo })
    });

    if (!response.ok) {
      console.error('❌ Erro na resposta:', response.status, response.statusText);
      throw new Error(`Erro ao listar ocorrências por ano letivo: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📥 Resposta recebida:', data);
    return data;
  }

  async buscarPorId(id: string): Promise<Ocorrencia | null> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'ocorrencia', action: 'buscarPorId', id })
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar ocorrência: ${response.statusText}`);
    }

    return response.json();
  }

  async criar(ocorrencia: Omit<Ocorrencia, 'id'>): Promise<string> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'ocorrencia', action: 'criar', ocorrencia })
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar ocorrência: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  async atualizar(id: string, ocorrencia: Partial<Omit<Ocorrencia, 'id'>>): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'ocorrencia', action: 'atualizar', id, ocorrencia })
    });

    if (!response.ok) {
      throw new Error(`Erro ao atualizar ocorrência: ${response.statusText}`);
    }
  }

  async excluir(id: string): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'ocorrencia', action: 'deletar', id })
    });

    if (!response.ok) {
      throw new Error(`Erro ao excluir ocorrência: ${response.statusText}`);
    }
  }

  /**
   * Retorna o label amigável para um tipo de ocorrência
   */
  obterLabelTipo(tipo: string, tiposPersonalizados: string[] = []): string {
    // Procura nos tipos padrão
    const tipoPadrao = TIPOS_OCORRENCIA_PADRAO.find(t => t.value === tipo);
    if (tipoPadrao) return tipoPadrao.label;

    // Se for personalizado, retorna como está
    if (tiposPersonalizados.includes(tipo)) return tipo;

    // Fallback: substitui underscores por espaços e capitaliza
    const text = tipo.replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Extrai tipos personalizados das ocorrências existentes
   */
  extrairTiposPersonalizados(ocorrencias: Ocorrencia[]): Array<{ value: string; label: string }> {
    const tiposPersonalizados = Array.from(
      new Set(
        ocorrencias
          .map(o => o.tipo)
          .filter(tipo => !TIPOS_OCORRENCIA_PADRAO.some(t => t.value === tipo))
      )
    );
    
    return tiposPersonalizados.map(tipo => ({ value: tipo, label: tipo }));
  }

  /**
   * Retorna todos os tipos disponíveis (padrão + personalizados)
   */
  obterTodosOsTipos(ocorrencias: Ocorrencia[]): Array<{ value: string; label: string }> {
    const tiposPersonalizados = this.extrairTiposPersonalizados(ocorrencias);
    return [...TIPOS_OCORRENCIA_PADRAO, ...tiposPersonalizados];
  }

  /**
   * Filtra ocorrências por tipo, turma, aluno e busca textual
   */
  filtrar(
    ocorrencias: Ocorrencia[],
    filtroTipo: string,
    filtroTurma: string,
    filtroAluno: string,
    searchQuery: string
  ): Ocorrencia[] {
    return ocorrencias.filter(ocorrencia => {
      // Filtro de tipo
      if (filtroTipo && ocorrencia.tipo !== filtroTipo) return false;
      
      // Filtro de turma
      if (filtroTurma && ocorrencia.turmaId !== filtroTurma) return false;
      
      // Filtro de aluno
      if (filtroAluno && ocorrencia.alunoId !== filtroAluno) return false;
      
      // Busca textual
      if (searchQuery && searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        const inAluno = (ocorrencia.alunoNome || '').toLowerCase().includes(q);
        const inDescricao = (ocorrencia.descricao || '').toLowerCase().includes(q);
        const inTipo = this.obterLabelTipo(ocorrencia.tipo).toLowerCase().includes(q);
        const inTurma = (ocorrencia.turmaNome || '').toLowerCase().includes(q);
        
        if (!inAluno && !inDescricao && !inTipo && !inTurma) return false;
      }
      
      return true;
    });
  }

  /**
   * Calcula estatísticas de ocorrências
   */
  calcularEstatisticas(ocorrencias: Ocorrencia[]): {
    total: number;
    feitasEsteMes: number;
    criticas: number;
  } {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const feitasEsteMes = ocorrencias.filter(o => {
      const data = new Date(o.dataCriacao || o.dataOcorrencia);
      return data.getMonth() === currentMonth && data.getFullYear() === currentYear;
    }).length;

    const criticas = ocorrencias.filter(o => o.gravidade === 'critica').length;

    return {
      total: ocorrencias.length,
      feitasEsteMes,
      criticas
    };
  }

  /**
   * Conta ocorrências de um aluno no ano atual
   */
  contarOcorrenciasAlunoNoAno(ocorrencias: Ocorrencia[], alunoId: string): number {
    const anoAtual = new Date().getFullYear();
    return ocorrencias.filter(o => {
      const data = new Date(o.dataCriacao || o.dataOcorrencia);
      return o.alunoId === alunoId && data.getFullYear() === anoAtual;
    }).length;
  }

  /**
   * Prepara dados da ocorrência para criação/atualização
   */
  prepararDadosOcorrencia(
    formData: {
      tipo: string;
      tipoPersonalizado: string;
      gravidade: 'baixa' | 'media' | 'alta' | 'critica';
      status: 'aberta' | 'em_analise' | 'resolvida' | 'arquivada';
      alunoId: string;
      turmaId: string;
      observacoes: string;
      medidas: string;
    },
    aluno: { id: string; nome: string; turmaId: string } | undefined,
    turma: { id: string; nome: string } | undefined,
    professor: { uid: string; nome?: string; email?: string } | undefined,
    isEdit: boolean
  ): Omit<Ocorrencia, 'id'> {
    const tipoFinal = formData.tipo === 'outro' ? formData.tipoPersonalizado : formData.tipo;
    const dataAtual = new Date().toISOString();

    const baseData = {
      titulo: this.obterLabelTipo(tipoFinal),
      descricao: formData.observacoes || `Ocorrência do tipo: ${this.obterLabelTipo(tipoFinal)}`,
      tipo: tipoFinal,
      gravidade: formData.gravidade,
      status: formData.status,
      alunoId: formData.alunoId,
      turmaId: formData.turmaId || aluno?.turmaId || '',
      alunoNome: aluno?.nome || '',
      turmaNome: turma?.nome || '',
      professorId: professor?.uid || '',
      professorNome: professor?.nome || professor?.email || '',
      dataOcorrencia: dataAtual,
      dataCriacao: isEdit ? '' : dataAtual, // Será preenchido na criação
      observacoes: formData.observacoes || '',
      medidas: formData.medidas || ''
    };

    // Adicionar dataResolucao se status for 'resolvida'
    if (formData.status === 'resolvida') {
      return {
        ...baseData,
        dataCriacao: isEdit ? baseData.dataCriacao : dataAtual,
        dataResolucao: dataAtual
      };
    }

    return {
      ...baseData,
      dataCriacao: isEdit ? baseData.dataCriacao : dataAtual
    };
  }

  /**
   * Valida dados do formulário
   */
  validarFormulario(formData: {
    tipo: string;
    tipoPersonalizado: string;
    alunoId: string;
  }): { valido: boolean; erro?: string } {
    if (!formData.alunoId) {
      return { valido: false, erro: 'Preencha todos os campos obrigatórios' };
    }
    
    if (formData.tipo === 'outro' && !formData.tipoPersonalizado) {
      return { valido: false, erro: 'Digite o nome do novo tipo de ocorrência' };
    }
    
    return { valido: true };
  }

  /**
   * Prepara lista de ocorrências filtradas e ordenadas para exportação
   */
  prepararParaExportacao(
    ocorrencias: Ocorrencia[],
    filtroTipo: string,
    filtroTurma: string,
    filtroAluno: string
  ): Ocorrencia[] {
    return ocorrencias
      .filter(o => {
        if (filtroTipo && o.tipo !== filtroTipo) return false;
        if (filtroTurma && o.turmaId !== filtroTurma) return false;
        if (filtroAluno && o.alunoId !== filtroAluno) return false;
        return true;
      })
      .sort((a, b) => {
        const dataA = new Date(a.dataCriacao || a.dataOcorrencia).getTime();
        const dataB = new Date(b.dataCriacao || b.dataOcorrencia).getTime();
        return dataB - dataA;
      });
  }

  /**
   * Exporta ocorrências para PDF
   */
  exportarPDF(ocorrencias: Ocorrencia[]): void {
    const doc = new jsPDF();
    doc.text('Relatório de Ocorrências', 14, 15);

    const headers = [['Aluno', 'Tipo', 'Turma', 'Data', 'Observações']];
    const body = ocorrencias.map(o => [
      o.alunoNome,
      this.obterLabelTipo(o.tipo),
      o.turmaNome,
      new Date(o.dataCriacao || o.dataOcorrencia).toLocaleDateString('pt-BR'),
      o.observacoes || ''
    ]);

    autoTable(doc, {
      startY: 25,
      head: headers,
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`ocorrencias-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Exporta ocorrências para Excel
   */
  exportarExcel(ocorrencias: Ocorrencia[]): void {
    const dadosParaExcel = ocorrencias.map(o => ({
      Aluno: o.alunoNome,
      Tipo: this.obterLabelTipo(o.tipo),
      Turma: o.turmaNome,
      Data: new Date(o.dataCriacao || o.dataOcorrencia).toLocaleDateString('pt-BR'),
      Observacoes: o.observacoes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dadosParaExcel);
    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 30 },
      { wch: 20 },
      { wch: 12 },
      { wch: 50 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ocorrencias');
    XLSX.writeFile(workbook, `ocorrencias-${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  /**
   * Verifica se um tipo é padrão do sistema
   */
  isTipoPadrao(tipo: string): boolean {
    return TIPOS_OCORRENCIA_PADRAO.some(t => t.value === tipo);
  }

  /**
   * Aplica paginação em uma lista de ocorrências
   */
  paginarOcorrencias(
    ocorrencias: Ocorrencia[],
    paginaAtual: number,
    itensPorPagina: number
  ): { ocorrenciasPaginadas: Ocorrencia[]; totalPaginas: number; totalItens: number } {
    const totalItens = ocorrencias.length;
    const totalPaginas = Math.ceil(totalItens / itensPorPagina);
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const ocorrenciasPaginadas = ocorrencias.slice(inicio, inicio + itensPorPagina);

    return { ocorrenciasPaginadas, totalPaginas, totalItens };
  }

  /**
   * Obtém lista de alunos únicos que possuem ocorrências
   * Opcionalmente filtra por turma
   */
  obterAlunosComOcorrencias(
    ocorrencias: Ocorrencia[],
    alunos: any[],
    turmaId?: string
  ): any[] {
    const ocorrenciasFiltradas = turmaId
      ? ocorrencias.filter(o => o.turmaId === turmaId)
      : ocorrencias;

    const alunosIdsUnicos = Array.from(
      new Set(ocorrenciasFiltradas.map(o => o.alunoId))
    );

    return alunosIdsUnicos
      .map(alunoId => alunos.find(a => a.id === alunoId))
      .filter(aluno => aluno !== undefined);
  }
}

export const ocorrenciaService = new OcorrenciaService();
