import { Tarefa } from '../../models/Tarefa';
import { Entrega } from '../../models/Entrega';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const API_URL = 'https://mobclassapi-3ohr3pb77q-uc.a.run.app';

export interface UrlValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedUrl?: string;
  securityScore?: number;
  domainCategory?: 'trusted' | 'educational' | 'unknown' | 'suspicious' | 'blocked';
  warnings?: string[];
  allowWithWarning?: boolean;
}

export class TarefaService {
  constructor() {}

  // ==================== CRUD Tarefas ====================

  async listarTarefas(): Promise<Tarefa[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'tarefa', action: 'listar' }),
    });
    if (!response.ok) throw new Error('Erro ao listar tarefas');
    return await response.json();
  }

  async listarTarefasPorTurmas(turmaIds: string[]): Promise<Tarefa[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'tarefa', action: 'listarPorTurmas', turmaIds }),
    });
    if (!response.ok) throw new Error('Erro ao listar tarefas por turmas');
    return await response.json();
  }

  async buscarTarefaPorId(id: string): Promise<Tarefa | null> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'tarefa', action: 'buscarPorId', id }),
    });
    if (!response.ok) throw new Error('Erro ao buscar tarefa');
    return await response.json();
  }

  async criarTarefa(tarefa: Omit<Tarefa, 'id'>): Promise<string> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'tarefa', action: 'criar', tarefa }),
    });
    if (!response.ok) throw new Error('Erro ao criar tarefa');
    const result = await response.json();
    return result.id;
  }

  async atualizarTarefa(id: string, tarefa: Partial<Omit<Tarefa, 'id'>>): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'tarefa', action: 'atualizar', id, tarefa }),
    });
    if (!response.ok) throw new Error('Erro ao atualizar tarefa');
  }

  async excluirTarefa(id: string): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'tarefa', action: 'excluir', id }),
    });
    if (!response.ok) throw new Error('Erro ao excluir tarefa');
  }

  // ==================== CRUD Entregas ====================

  async listarEntregas(): Promise<Entrega[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'tarefa', action: 'listarEntregas' }),
    });
    if (!response.ok) throw new Error('Erro ao listar entregas');
    return await response.json();
  }

  async buscarEntregaPorId(id: string): Promise<Entrega | null> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'tarefa', action: 'buscarEntregaPorId', id }),
    });
    if (!response.ok) throw new Error('Erro ao buscar entrega');
    return await response.json();
  }

  async buscarEntregaPorAlunoETarefa(alunoId: string, tarefaId: string): Promise<Entrega | null> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'tarefa', action: 'buscarEntregaPorAlunoETarefa', alunoId, tarefaId }),
    });
    if (!response.ok) throw new Error('Erro ao buscar entrega por aluno e tarefa');
    return await response.json();
  }

  async atualizarOuCriarEntrega(
    alunoId: string,
    tarefaId: string,
    status: string
  ): Promise<string> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'tarefa', action: 'atualizarOuCriarEntrega', alunoId, tarefaId, status }),
    });
    if (!response.ok) throw new Error('Erro ao atualizar ou criar entrega');
    const result = await response.json();
    return result.id;
  }

  async atualizarObservacoes(entregaId: string, observacoes: string): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'tarefa', action: 'atualizarObservacoes', entregaId, observacoes }),
    });
    if (!response.ok) throw new Error('Erro ao atualizar observações');
  }

  // ==================== URL Validation ====================

  /**
   * Validates a URL asynchronously and returns validation result
   * This wraps the useUrlValidator hook functionality
   */
  async validarUrl(
    url: string,
    validateUrlFn: (url: string) => Promise<UrlValidationResult>
  ): Promise<UrlValidationResult> {
    return await validateUrlFn(url);
  }

  /**
   * Processes URL validation and returns user feedback messages
   */
  processarValidacaoLink(
    validation: UrlValidationResult
  ): {
    erro?: string;
    sucesso?: string;
    avisos: string[];
  } {
    if (!validation.isValid) {
      return {
        erro: `🚫 BLOQUEADO: ${validation.error || 'URL inválida'}`,
        avisos: []
      };
    }

    const warnings = validation.warnings || [];
    const score = validation.securityScore || 100;
    const category = validation.domainCategory || 'unknown';

    let successMessage = '';

    switch (category) {
      case 'trusted':
        successMessage = `✅ Site confiável validado (Score: ${score}/100)`;
        break;
      case 'educational':
        successMessage = `🎓 Site educacional aceito (Score: ${score}/100)`;
        break;
      case 'unknown':
        if (validation.allowWithWarning) {
          successMessage = `⚠️ Site aceito com verificação extra (Score: ${score}/100)`;
          warnings.unshift('Este site não está na lista de confiáveis, mas passou na verificação de segurança');
        } else {
          successMessage = `✅ URL aceita (Score: ${score}/100)`;
        }
        break;
    }

    if (score < 80) {
      warnings.push(`⚠️ Score de segurança moderado: ${score}/100`);
    }

    return {
      sucesso: successMessage,
      avisos: warnings
    };
  }

  /**
   * Validates and sanitizes an array of links
   */
  async validarESanitizarLinks(
    links: Array<{ url: string; titulo: string }>,
    validateUrlFn: (url: string) => Promise<UrlValidationResult>
  ): Promise<Array<{ url: string; titulo: string }>> {
    const validatedLinks = [];
    for (const link of links) {
      const validation = await validateUrlFn(link.url);
      if (validation.isValid) {
        validatedLinks.push({
          url: validation.sanitizedUrl || link.url,
          titulo: link.titulo
        });
      }
    }
    return validatedLinks;
  }

  /**
   * Filters safe links from multiple tasks
   */
  async filtrarLinksSegurosDeTarefas(
    tarefas: Tarefa[],
    isSafeLinkFn: (url: string) => Promise<boolean>
  ): Promise<{ [tarefaId: string]: Array<{ url: string; titulo: string }> }> {
    const linksSegurosPorTarefa: { [tarefaId: string]: Array<{ url: string; titulo: string }> } = {};

    for (const tarefa of tarefas) {
      if (tarefa.links && tarefa.links.length > 0) {
        const linksValidos = [];
        for (const link of tarefa.links) {
          const isSeguro = await isSafeLinkFn(link.url);
          if (isSeguro) {
            linksValidos.push(link);
          }
        }
        linksSegurosPorTarefa[tarefa.id] = linksValidos;
      } else {
        linksSegurosPorTarefa[tarefa.id] = [];
      }
    }

    return linksSegurosPorTarefa;
  }

  // ==================== Data Preparation ====================

  /**
   * Prepares task payload for creation/update
   */
  prepararDadosTarefa(
    materiaId: string,
    titulo: string,
    descricao: string,
    turmaId: string,
    anoLetivo: string,
    dataEntrega: string,
    professorId: string,
    validatedLinks: Array<{ url: string; titulo: string }>,
    originalLinksCount: number
  ): Omit<Tarefa, 'id'> {
    const payload: Omit<Tarefa, 'id'> = {
      materiaId,
      titulo,
      descricao,
      turmaId,
      anoLetivo,
      dataEntrega,
      professorId,
      links: validatedLinks
    };

    // Mark as potentially blocked if links were removed for security
    if (originalLinksCount > 0 && validatedLinks.length < originalLinksCount) {
      payload.bloqueado = false; // Can be changed to true if preferred
    }

    return payload;
  }

  /**
   * Validates task form data
   */
  validarFormularioTarefa(
    materiaSelecionada: string,
    descricao: string,
    turmaId: string,
    dataEntrega: string
  ): { valido: boolean; erro?: string } {
    if (!materiaSelecionada) {
      return { valido: false, erro: 'Matéria é obrigatória' };
    }
    if (!descricao || descricao.trim() === '') {
      return { valido: false, erro: 'Descrição é obrigatória' };
    }
    if (!turmaId) {
      return { valido: false, erro: 'Turma é obrigatória' };
    }
    if (!dataEntrega) {
      return { valido: false, erro: 'Data de entrega é obrigatória' };
    }
    return { valido: true };
  }

  // ==================== Filtering & Sorting ====================

  /**
   * Filters tasks by turma, materia, and excludes deleted ones
   */
  filtrarTarefas(
    tarefas: Tarefa[],
    turmaId: string,
    materiaId: string
  ): Tarefa[] {
    return tarefas.filter(
      t => t.turmaId === turmaId && t.materiaId === materiaId && !t.excluida
    );
  }

  /**
   * Filters tasks by allowed materias (for professors)
   */
  filtrarTarefasPorMaterias(
    tarefas: Tarefa[],
    materiasPermitidas: string[]
  ): Tarefa[] {
    return tarefas.filter(t => materiasPermitidas.includes(t.materiaId));
  }

  /**
   * Sorts tasks by title or delivery date
   */
  ordenarTarefas(
    tarefas: Tarefa[],
    ordenacao: 'titulo' | 'data'
  ): Tarefa[] {
    return [...tarefas].sort((a, b) => {
      switch (ordenacao) {
        case 'titulo':
          return (a.titulo || 'Sem título').localeCompare(b.titulo || 'Sem título');
        case 'data':
          return new Date(b.dataEntrega).getTime() - new Date(a.dataEntrega).getTime();
        default:
          return 0;
      }
    });
  }

  // ==================== Status Calculation ====================

  /**
   * Calculates task status based on delivery date
   */
  calcularStatusTarefa(dataEntrega: string): 'concluida' | 'em_andamento' | 'sem_data' {
    if (!dataEntrega) return 'sem_data';

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataEntregaDate = new Date(dataEntrega);

    if (dataEntregaDate.getTime() < hoje.getTime()) {
      return 'concluida';
    } else {
      return 'em_andamento';
    }
  }

  /**
   * Gets status label and color
   */
  obterLabelStatus(status: 'concluida' | 'em_andamento' | 'sem_data'): {
    label: string;
    className: string;
  } {
    switch (status) {
      case 'concluida':
        return { label: 'Concluída', className: 'status-badge enviado' };
      case 'em_andamento':
        return { label: 'Em andamento', className: 'status-badge agendado' };
      case 'sem_data':
        return { label: 'Sem data', className: 'status-badge rascunho' };
    }
  }

  // ==================== Export Functions ====================

  /**
   * Exports task tracking report to PDF
   */
  exportarPDF(
    tarefa: Tarefa,
    alunos: Array<{ id: string; nome: string }>,
    entregas: Entrega[],
    formatarDataBR: (data: string) => string
  ): void {
    const doc = new jsPDF();
    doc.text(
      `Relatório de Acompanhamento - ${tarefa.titulo || tarefa.descricao}`,
      14,
      15
    );

    autoTable(doc, {
      startY: 20,
      head: [['Status', 'Aluno', 'Data Conclusao', 'Anexo']],
      body: alunos
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map(aluno => {
          const entrega = entregas.find(e => e.alunoId === aluno.id && e.tarefaId === tarefa.id);
          return [
            entrega?.status ?? 'Não entregue',
            aluno.nome,
            entrega?.dataConclusao ? formatarDataBR(entrega.dataConclusao) : '-',
            entrega?.anexoUrl ? 'Sim' : 'Não'
          ];
        })
    });

    doc.save(`acompanhamento_${tarefa.titulo || tarefa.descricao}.pdf`);
  }

  /**
   * Exports task tracking report to Excel
   */
  exportarExcel(
    tarefa: Tarefa,
    alunos: Array<{ id: string; nome: string }>,
    entregas: Entrega[],
    formatarDataBR: (data: string) => string
  ): void {
    const data = alunos.map(aluno => {
      const entrega = entregas.find(e => e.alunoId === aluno.id && e.tarefaId === tarefa.id);
      return {
        Aluno: aluno.nome,
        Status: entrega?.status ?? 'Não entregue',
        'Data de Conclusão': entrega?.dataConclusao ? formatarDataBR(entrega.dataConclusao) : '-',
        Anexo: entrega?.anexoUrl ? 'Sim' : 'Não'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 35 },
      { wch: 15 },
      { wch: 20 },
      { wch: 10 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Acompanhamento');
    XLSX.writeFile(
      workbook,
      `acompanhamento_${tarefa.titulo || tarefa.descricao}.xlsx`
    );
  }

  // ==================== Utility Functions ====================

  /**
   * Formats date to Brazilian format
   */
  formatarDataBR(data: string): string {
    if (!data) return '-';
    // Detecta formato YYYY-MM-DD
    const match = /^\d{4}-\d{2}-\d{2}$/.exec(data);
    if (match) {
      const [year, month, day] = data.split('-');
      // Cria Date no fuso local
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      return d.toLocaleDateString('pt-BR');
    }
    // Fallback para outros formatos
    const d = new Date(data);
    if (isNaN(d.getTime())) return data;
    return d.toLocaleDateString('pt-BR');
  }

  /**
   * Counts submissions by status
   */
  contarEntregasPorStatus(
    entregas: Entrega[],
    tarefaId: string
  ): { concluidas: number; naoEntregues: number; pendentes: number; total: number } {
    const entregasDaTarefa = entregas.filter(e => e.tarefaId === tarefaId);
    const concluidas = entregasDaTarefa.filter(e => e.status === 'concluida').length;
    const naoEntregues = entregasDaTarefa.filter(e => e.status === 'nao_entregue').length;
    const pendentes = entregasDaTarefa.filter(
      e => e.status !== 'concluida' && e.status !== 'nao_entregue'
    ).length;

    return {
      concluidas,
      naoEntregues,
      pendentes,
      total: entregasDaTarefa.length
    };
  }
}
