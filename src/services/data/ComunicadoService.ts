import { IComunicadoRepository } from '../../repositories/comunicado/IComunicadoRepository';
import { Comunicado } from '../../models/Comunicado';

export class ComunicadoService {
  constructor(private repository: IComunicadoRepository) {}

  async listar(): Promise<Comunicado[]> {
    return this.repository.listar();
  }

  async listarPorTurmas(turmaIds: string[]): Promise<Comunicado[]> {
    return this.repository.listarPorTurmas(turmaIds);
  }

  async buscarPorId(id: string): Promise<Comunicado | null> {
    return this.repository.buscarPorId(id);
  }

  async criar(comunicado: Omit<Comunicado, 'id'>): Promise<string> {
    return this.repository.criar(comunicado);
  }

  async atualizar(id: string, comunicado: Partial<Omit<Comunicado, 'id'>>): Promise<void> {
    return this.repository.atualizar(id, comunicado);
  }

  async deletar(id: string): Promise<void> {
    return this.repository.deletar(id);
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
      const payload: Omit<Comunicado, 'id'> = {
        assunto: dados.assunto,
        mensagem: dados.mensagem,
        turmaId: turma.id,
        turmaNome: turma.nome,
        data: this.obterTimestampAtual(),
        status: dados.status,
      };

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
    const payload: Partial<Omit<Comunicado, 'id'>> = {
      assunto: dados.assunto,
      mensagem: dados.mensagem,
      turmaId: dados.turmaId,
      turmaNome: dados.turmaNome,
      data: this.obterTimestampAtual(),
      status: dados.status,
    };

    if (dados.status === 'agendado' && dados.dataAgendamento) {
      payload.dataAgendamento = this.converterParaTimestamp(dados.dataAgendamento);
    }

    return payload;
  }

  /**
   * Obtém Timestamp atual do Firestore
   */
  private obterTimestampAtual() {
    // Importar Timestamp dinamicamente para evitar problemas de importação circular
    const { Timestamp } = require('firebase/firestore');
    return Timestamp.now();
  }

  /**
   * Converte Date para Timestamp do Firestore
   */
  private converterParaTimestamp(date: Date) {
    const { Timestamp } = require('firebase/firestore');
    return Timestamp.fromDate(date);
  }
}
