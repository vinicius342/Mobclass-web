import { Comunicado } from '../../models/Comunicado';
import { Timestamp } from 'firebase/firestore';

const API_URL = 'https://mobclassapi-3ohr3pb77q-uc.a.run.app';

export class ComunicadoService {
  async listar(): Promise<Comunicado[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'comunicado', action: 'listar' })
    });

    if (!response.ok) {
      throw new Error(`Erro ao listar comunicados: ${response.statusText}`);
    }

    return response.json();
  }

  async listarPorTurmas(turmaIds: string[]): Promise<Comunicado[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'comunicado', action: 'listarPorTurmas', turmaIds })
    });

    if (!response.ok) {
      throw new Error(`Erro ao listar comunicados por turmas: ${response.statusText}`);
    }

    return response.json();
  }

  async listarPorAnoLetivo(anoLetivo: string): Promise<Comunicado[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'comunicado', action: 'listarPorAnoLetivo', anoLetivo })
    });

    if (!response.ok) {
      throw new Error(`Erro ao listar comunicados por ano letivo: ${response.statusText}`);
    }

    return response.json();
  }

  async buscarPorId(id: string): Promise<Comunicado | null> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'comunicado', action: 'buscarPorId', id })
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar comunicado: ${response.statusText}`);
    }

    return response.json();
  }

  async criar(comunicado: Omit<Comunicado, 'id'>): Promise<string> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'comunicado', action: 'criar', comunicado })
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar comunicado: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  async atualizar(id: string, comunicado: Partial<Omit<Comunicado, 'id'>>): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'comunicado', action: 'atualizar', id, comunicado })
    });

    if (!response.ok) {
      throw new Error(`Erro ao atualizar comunicado: ${response.statusText}`);
    }
  }

  async deletar(id: string): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'comunicado', action: 'deletar', id })
    });

    if (!response.ok) {
      throw new Error(`Erro ao deletar comunicado: ${response.statusText}`);
    }
  }

  /**
   * Filtra comunicados por status
   */
  filtrarPorStatus(comunicados: Comunicado[], status: string): Comunicado[] {
    if (!status) return comunicados;
    return comunicados.filter(c => c.status === status);
  }

  /**
   * Filtra comunicados por turma
   */
  filtrarPorTurma(comunicados: Comunicado[], turmaId: string): Comunicado[] {
    if (!turmaId) return comunicados;
    return comunicados.filter(c => c.turmaId === turmaId);
  }

  /**
   * Filtra comunicados por assunto
   */
  filtrarPorAssunto(comunicados: Comunicado[], assunto: string): Comunicado[] {
    if (!assunto) return comunicados;
    return comunicados.filter(c => c.assunto === assunto);
  }

  /**
   * Busca comunicados por texto (assunto, mensagem ou turma)
   */
  buscarPorTexto(comunicados: Comunicado[], texto: string): Comunicado[] {
    if (!texto) return comunicados;
    const textoBusca = texto.toLowerCase();
    return comunicados.filter(c => 
      c.assunto.toLowerCase().includes(textoBusca) ||
      c.mensagem.toLowerCase().includes(textoBusca) ||
      (c.turmaNome || '').toLowerCase().includes(textoBusca)
    );
  }

  /**
   * Aplica múltiplos filtros aos comunicados
   */
  aplicarFiltros(
    comunicados: Comunicado[],
    filtros: {
      busca?: string;
      turmaId?: string;
      assunto?: string;
      status?: string;
    }
  ): Comunicado[] {
    let resultado = comunicados;

    // Filtro de busca por texto
    if (filtros.busca) {
      resultado = this.buscarPorTexto(resultado, filtros.busca);
    }

    // Filtro por turma
    if (filtros.turmaId) {
      resultado = this.filtrarPorTurma(resultado, filtros.turmaId);
    }

    // Filtro por assunto
    if (filtros.assunto) {
      resultado = this.filtrarPorAssunto(resultado, filtros.assunto);
    }

    // Filtro por status
    if (filtros.status) {
      resultado = this.filtrarPorStatus(resultado, filtros.status);
    }

    return resultado;
  }

  /**
   * Extrai lista única de assuntos dos comunicados
   */
  extrairAssuntos(comunicados: Comunicado[]): string[] {
    return [...new Set(comunicados.map(c => c.assunto))].sort();
  }

  /**
   * Valida dados do comunicado antes de salvar
   */
  validarComunicado(dados: {
    assunto: string;
    mensagem: string;
    turmasSelecionadas: string[];
    status: string;
    dataAgendamento: Date | null;
  }): { valido: boolean; erro?: string } {
    if (!dados.assunto || !dados.mensagem) {
      return { valido: false, erro: 'Assunto e mensagem são obrigatórios.' };
    }

    if (dados.turmasSelecionadas.length === 0) {
      return { valido: false, erro: 'Selecione pelo menos uma turma.' };
    }

    if (dados.status === 'agendado' && !dados.dataAgendamento) {
      return { valido: false, erro: 'Data de agendamento é obrigatória para comunicados agendados.' };
    }

    return { valido: true };
  }

  /**
   * Cria comunicados para múltiplas turmas
   */
  async criarParaMultiplasTurmas(
    dados: {
      assunto: string;
      mensagem: string;
      status: 'enviado' | 'agendado' | 'rascunho';
      dataAgendamento?: Date;
    },
    turmas: Array<{ id: string; nome: string }>
  ): Promise<number> {
    let contador = 0;

    for (const turma of turmas) {
      const payload: any = {
        assunto: dados.assunto,
        mensagem: dados.mensagem,
        turmaId: turma.id,
        turmaNome: turma.nome,
        data: this.obterTimestampAtual(),
        status: dados.status,
      };

      // Só adiciona dataAgendamento se for agendado E tiver data
      if (dados.status === 'agendado' && dados.dataAgendamento) {
        payload.dataAgendamento = this.converterParaTimestamp(dados.dataAgendamento);
      }

      await this.criar(payload);
      contador++;
    }

    return contador;
  }

  /**
   * Prepara payload para atualização de comunicado
   */
  prepararPayloadAtualizacao(
    dados: {
      assunto: string;
      mensagem: string;
      turmaId: string;
      turmaNome: string;
      status: 'enviado' | 'agendado' | 'rascunho';
      dataAgendamento?: Date;
    }
  ): Partial<Omit<Comunicado, 'id'>> {
    const payload: any = {
      assunto: dados.assunto,
      mensagem: dados.mensagem,
      turmaId: dados.turmaId,
      turmaNome: dados.turmaNome,
      data: this.obterTimestampAtual(),
      status: dados.status,
    };

    // Só adiciona dataAgendamento se for agendado E tiver data
    if (dados.status === 'agendado' && dados.dataAgendamento) {
      payload.dataAgendamento = this.converterParaTimestamp(dados.dataAgendamento);
    }

    return payload;
  }

  /**
   * Obtém Timestamp atual do Firestore
   */
  private obterTimestampAtual() {
    return Timestamp.now();
  }

  /**
   * Converte Date para Timestamp do Firestore
   */
  private converterParaTimestamp(date: Date) {
    return Timestamp.fromDate(date);
  }
}

export const comunicadoService = new ComunicadoService();
