import { INotaRepository } from '../../repositories/nota/INotaRepository';
import { Nota } from '../../models/Nota';
import { Aluno } from '../../models/Aluno';
import { IMateriaRepository } from '../../repositories/materia/IMateriaRepository';

export interface BoletimAluno {
  materias: string[];
  bimestres: string[];
  notas: Record<string, Record<string, { mediaFinal: number | null }>>;
}

export class NotaService {
  constructor(
    private notaRepository: INotaRepository,
    private materiaRepository?: IMateriaRepository
  ) { }

  async listarPorAluno(alunoUid: string): Promise<Nota[]> {
    return this.notaRepository.findByAlunoUid(alunoUid);
  }

  async listarPorAlunoETurma(alunoUid: string, turmaId: string): Promise<Nota[]> {
    return this.notaRepository.findByAlunoUidETurma(alunoUid, turmaId);
  }

  async listarPorTurma(turmaId: string): Promise<Nota[]> {
    return this.notaRepository.findByTurmaId(turmaId);
  }

  async listarTodas(): Promise<Nota[]> {
    return this.notaRepository.findAll();
  }

  async buscarPorId(id: string): Promise<Nota | null> {
    return this.notaRepository.findById(id);
  }

  async salvar(nota: Omit<Nota, 'id'> & { id?: string }): Promise<string> {
    if (nota.id) {
      await this.notaRepository.update(nota.id, nota);
      return nota.id;
    } else {
      return await this.notaRepository.create(nota);
    }
  }

  async atualizar(id: string, nota: Partial<Omit<Nota, 'id'>>): Promise<void> {
    return this.notaRepository.update(id, nota);
  }

  async excluir(id: string): Promise<void> {
    return this.notaRepository.delete(id);
  }

  async copiarNotas(alunoUid: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    await this.notaRepository.copiarNotas(alunoUid, turmaOrigemId, turmaDestinoId);
  }

  calcularMediasPorTurma(
    notas: Nota[],
    turmas: { id: string; nome: string }[],
    filtros?: {
      materiaId?: string;
      grupoTurmas?: { id: string; nome: string }[];
    }
  ): { turma: string; media: number }[] {
    // Se um grupo específico de turmas foi selecionado, usar apenas essas
    let turmasParaCalcular = turmas;
    if (filtros?.grupoTurmas && filtros.grupoTurmas.length > 0) {
      turmasParaCalcular = filtros.grupoTurmas;
    }

    return turmasParaCalcular.map(turma => {
      let notasTurma = notas.filter(n => n.turmaId === turma.id);

      // Filtrar por disciplina se especificada
      if (filtros?.materiaId && filtros.materiaId !== 'todas') {
        notasTurma = notasTurma.filter(n => n.materiaId === filtros.materiaId);
      }

      if (notasTurma.length === 0) {
        return { turma: turma.nome, media: 0 };
      }

      // Calcular média final: ((notaParcial + notaGlobal) / 2) + notaParticipacao
      const somaMedias = notasTurma.reduce((acc, cur) => {
        const parcial = typeof cur.notaParcial === 'number' ? cur.notaParcial : 0;
        const global = typeof cur.notaGlobal === 'number' ? cur.notaGlobal : 0;
        const participacao = typeof cur.notaParticipacao === 'number' ? cur.notaParticipacao : 0;
        const mediaFinal = ((parcial + global) / 2) + participacao;
        return acc + mediaFinal;
      }, 0);

      const media = somaMedias / notasTurma.length;
      return { turma: turma.nome, media: parseFloat(media.toFixed(2)) };
    });
  }

  calcularMediasFinais(notas: Nota[]): number[] {
    return notas.map(n => {
      const parcial = n.notaParcial || 0;
      const global = n.notaGlobal || 0;
      const participacao = n.notaParticipacao || 0;
      return Math.min(((parcial + global) / 2) + participacao, 10);
    });
  }

  distribuirPorDesempenho(mediasFinais: number[]): Array<{ faixa: string; value: number }> {
    return [
      { faixa: 'Baixa (< 6)', value: mediasFinais.filter(m => m < 6).length },
      { faixa: 'Regular (6–9)', value: mediasFinais.filter(m => m >= 6 && m < 9).length },
      { faixa: 'Excelente (≥ 9)', value: mediasFinais.filter(m => m >= 9).length },
    ];
  }

  /**
   * Calcula a média final de uma matéria a partir das médias de todos os bimestres
   * @param notasPorBimestre - Array com as médias finais de cada bimestre (pode conter null/undefined)
   * @returns Média final da matéria ou null se não houver notas
   */
  calcularMediaPorMateria(notasPorBimestre: Array<number | null | undefined>): string | null {
    const notasValidas = notasPorBimestre.filter(
      (n): n is number => n !== null && n !== undefined
    );
    
    if (notasValidas.length === 0) {
      return null;
    }
    
    const soma = notasValidas.reduce((acc, nota) => acc + nota, 0);
    const media = soma / notasValidas.length;
    
    return media.toFixed(1);
  }

  /**
   * Obtém a turma do aluno para um ano específico considerando histórico
   * @param aluno - Objeto do aluno
   * @param anoLetivo - Ano letivo a buscar
   * @returns ID da turma do aluno no ano especificado
   */
  private obterTurmaDoAno(aluno: Aluno, anoLetivo: number): string {
    const anoStr = anoLetivo.toString();
    if (aluno.historicoTurmas && aluno.historicoTurmas[anoStr]) {
      return aluno.historicoTurmas[anoStr];
    }
    return aluno.turmaId;
  }

  /**
   * Calcula a média final do aluno considerando todas as matérias e bimestres
   * @param aluno - Objeto do aluno
   * @param anoLetivo - Ano letivo para buscar as notas
   * @returns Média final ou null se não houver notas
   */
  async calcularMediaFinalAluno(aluno: Aluno, anoLetivo: number): Promise<number | null> {
    // Obter a turma do aluno no ano letivo especificado
    const turmaId = this.obterTurmaDoAno(aluno, anoLetivo);

    const notas = await this.listarPorAlunoETurma(aluno.id, turmaId);

    if (notas.length === 0) return null;

    // Organizar notas por matéria e bimestre
    const notasPorMateria: Record<string, number[]> = {};
    
    notas.forEach(nota => {
      const materiaId = nota.materiaId;

      // Verificar se a nota tem dados válidos antes de calcular
      const temTresNotas =
        typeof nota.notaParcial === 'number' &&
        typeof nota.notaGlobal === 'number' &&
        typeof nota.notaParticipacao === 'number';

      const temRecuperacao = typeof nota.notaRecuperacao === 'number';

      // Só calcular média se tiver notas válidas
      if (temTresNotas || temRecuperacao) {
        // Calcular média final da nota
        let mediaFinal: number;
        
        // Calcula a média das três notas
        if (temTresNotas) {
          mediaFinal = (nota.notaParcial! + nota.notaGlobal! + nota.notaParticipacao!) / 3;
          
          // Se tiver recuperação, usa o maior valor entre média e recuperação
          if (temRecuperacao) {
            mediaFinal = Math.max(mediaFinal, nota.notaRecuperacao!);
          }
        } else {
          // Se só tem recuperação, usa ela
          mediaFinal = nota.notaRecuperacao!;
        }

        if (!notasPorMateria[materiaId]) notasPorMateria[materiaId] = [];
        if (!isNaN(mediaFinal)) {
          notasPorMateria[materiaId].push(mediaFinal);
        }
      }
    });

    // Calcular média final de cada matéria (média dos bimestres)
    const mediasFinaisMaterias: number[] = Object.values(notasPorMateria)
      .map(notasMateria => {
        if (notasMateria.length === 0) return null;
        return notasMateria.reduce((a, b) => a + b, 0) / notasMateria.length;
      })
      .filter((v): v is number => v !== null && !isNaN(v));

    if (mediasFinaisMaterias.length === 0) return null;

    // Média final do aluno = média das médias finais das matérias
    const mediaGeral = mediasFinaisMaterias.reduce((a, b) => a + b, 0) / mediasFinaisMaterias.length;
    return parseFloat(mediaGeral.toFixed(1));
  }

  /**
   * Gera boletim formatado do aluno com notas organizadas por matéria e bimestre
   * @param aluno - Objeto do aluno
   * @param anoLetivo - Ano letivo para buscar as notas
   * @returns Objeto com dados do boletim formatado ou null se não houver notas
   */
  async gerarBoletimAluno(aluno: Aluno, anoLetivo: number): Promise<BoletimAluno | null> {
    if (!this.materiaRepository) {
      throw new Error('MateriaRepository não foi injetado no NotaService');
    }

    try {
      // Obter a turma do aluno no ano letivo especificado
      const turmaId = this.obterTurmaDoAno(aluno, anoLetivo);

      // Buscar notas do aluno
      const notas = await this.listarPorAlunoETurma(aluno.id, turmaId);

      if (notas.length === 0) {
        return null;
      }

      // Buscar todas as matérias
      const todasMaterias = await this.materiaRepository.findAll();
      const materiasMap = new Map<string, string>();
      todasMaterias.forEach(materia => {
        materiasMap.set(materia.id, materia.nome);
      });

      // Organizar notas por bimestre e matéria
      const notasPorMateriaBimestre: Record<string, Record<string, { mediaFinal: number | null }>> = {};
      const materiasEncontradas = new Set<string>();

      notas.forEach(nota => {
        const nomeMateria = materiasMap.get(nota.materiaId) || nota.materiaId;
        materiasEncontradas.add(nomeMateria);

        if (!notasPorMateriaBimestre[nota.bimestre]) {
          notasPorMateriaBimestre[nota.bimestre] = {};
        }

        // Calcular média final usando a mesma lógica do calcularMediaFinal
        const parcial = typeof nota.notaParcial === 'number' ? nota.notaParcial : 0;
        const global = typeof nota.notaGlobal === 'number' ? nota.notaGlobal : 0;
        const participacao = typeof nota.notaParticipacao === 'number' ? nota.notaParticipacao : 0;
        const media = ((parcial + global) / 2) + participacao;
        const mediaFinal = Math.min(parseFloat(media.toFixed(1)), 10);

        notasPorMateriaBimestre[nota.bimestre][nomeMateria] = {
          mediaFinal: mediaFinal
        };
      });

      return {
        materias: Array.from(materiasEncontradas).sort(),
        bimestres: ['1º', '2º', '3º', '4º'],
        notas: notasPorMateriaBimestre
      };

    } catch (error) {
      console.error('Erro ao gerar boletim do aluno:', error);
      throw error;
    }
  }

  /**
   * Prepara dados de nota para salvamento, convertendo strings vazias para null
   */
  prepararDadosNota(dados: {
    notaParcial: string;
    notaGlobal: string;
    notaParticipacao: string;
    notaRecuperacao: string;
    turmaId: string;
    alunoUid: string;
    materiaId: string;
    bimestre: string;
    id?: string;
  }): Omit<Nota, 'id'> & { id?: string } {
    const parseOrNull = (val: string) =>
      val.trim() !== '' && !isNaN(Number(val)) ? parseFloat(val) : null;

    const baseData = {
      turmaId: dados.turmaId,
      alunoUid: dados.alunoUid,
      materiaId: dados.materiaId,
      bimestre: dados.bimestre,
      notaParcial: parseOrNull(dados.notaParcial) || 0,
      notaGlobal: parseOrNull(dados.notaGlobal) || 0,
      notaParticipacao: parseOrNull(dados.notaParticipacao),
      notaRecuperacao: parseOrNull(dados.notaRecuperacao),
      dataLancamento: new Date(),
    };

    // Só adiciona id se existir, para evitar undefined no Firestore
    if (dados.id) {
      return { ...baseData, id: dados.id };
    }

    return baseData;
  }

  /**
   * Valida se há pelo menos uma nota preenchida
   */
  validarNotaPreenchida(dados: {
    notaParcial: string;
    notaGlobal: string;
    notaParticipacao: string;
  }): boolean {
    return [dados.notaParcial, dados.notaGlobal, dados.notaParticipacao].some(
      val => val.trim() !== ''
    );
  }

  /**
   * Filtra notas por matérias específicas
   */
  filtrarPorMaterias(notas: Nota[], materiaIds: string[]): Nota[] {
    return notas.filter(nota => materiaIds.includes(nota.materiaId));
  }

  /**
   * Compara valor de um campo de nota (editado vs original)
   */
  campoAlterado(
    notaEditada: Record<string, any>,
    notaOriginal: Nota | undefined,
    campo: string
  ): boolean {
    if (!notaOriginal) {
      return notaEditada[campo] !== '' && notaEditada[campo] !== undefined;
    }
    
    const valorOriginal = ((notaOriginal as Record<string, any>)[campo] ?? '').toString();
    const valorEditado = notaEditada[campo] ?? '';
    return valorEditado !== valorOriginal && valorEditado !== '';
  }

  /**
   * Busca nota específica por filtros
   */
  buscarNotaPorFiltros(
    notas: Nota[],
    turmaId: string,
    materiaId: string,
    bimestre: string,
    alunoId: string
  ): Nota | undefined {
    return notas.find(
      n =>
        n.turmaId === turmaId &&
        n.materiaId === materiaId &&
        n.bimestre === bimestre &&
        n.alunoUid === alunoId
    );
  }

  /**
   * Calcula a média final de uma nota (parcial + global)/2 + participação
   */
  calcularMediaFinal(nota: Nota): number {
    const parcial = typeof nota.notaParcial === 'number' ? nota.notaParcial : 0;
    const global = typeof nota.notaGlobal === 'number' ? nota.notaGlobal : 0;
    const participacao = typeof nota.notaParticipacao === 'number' ? nota.notaParticipacao : 0;
    const recuperacao = typeof nota.notaRecuperacao === 'number' ? nota.notaRecuperacao : null;
    
    // Calcula média: ((parcial + global) / 2) + participação
    let media = ((parcial + global) / 2) + participacao;
    
    // Se tiver recuperação, usa o maior valor entre média e recuperação
    if (recuperacao !== null) {
      media = Math.max(media, recuperacao);
    }
    
    return Math.min(parseFloat(media.toFixed(1)), 10);
  }

  /**
   * Retorna classe CSS de cor baseada no valor da nota
   */
  getNotaColor(valor: number | null | undefined): string {
    if (typeof valor !== 'number') return '';
    if (valor >= 9) return 'text-success';
    if (valor >= 6) return 'text-warning';
    return 'text-danger';
  }

  /**
   * Formata data para string no formato DD/MM/YYYY
   */
  formatarData(data: Date | string): string {
    if (typeof data === 'string') return data;
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  /**
   * Converte string de data DD/MM/YYYY para Date
   */
  parseData(dataStr: string | Date): Date {
    if (dataStr instanceof Date) return dataStr;
    const [dia, mes, ano] = dataStr.split('/');
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  }

  /**
   * Deduplica notas mantendo apenas a mais recente por aluno/matéria
   */
  deduplicarNotasPorAluno(
    notas: Nota[],
    filtroTurma?: string,
    filtroMateria?: string,
    filtroBimestre?: string,
    busca?: string,
    materiaIds?: string[]
  ): Nota[] {
    const resultadosMap = new Map<string, Nota>();
    
    notas.forEach(n => {
      // Aplicar filtros se fornecidos
      if (filtroTurma && n.turmaId !== filtroTurma) return;
      if (filtroMateria && n.materiaId !== filtroMateria) return;
      if (filtroBimestre && n.bimestre !== filtroBimestre) return;
      if (busca && !(n.nomeAluno || '').toLowerCase().includes(busca.toLowerCase())) return;
      if (materiaIds && !materiaIds.includes(n.materiaId)) return;

      const chave = `${n.alunoUid}-${n.materiaId}`;
      const existente = resultadosMap.get(chave);
      const dataAtual = this.parseData(n.dataLancamento).getTime();
      const dataExistente = existente ? this.parseData(existente.dataLancamento).getTime() : 0;
      
      if (!existente || dataAtual > dataExistente) {
        resultadosMap.set(chave, n);
      }
    });

    return Array.from(resultadosMap.values()).sort((a, b) => 
      (a.nomeAluno || '').localeCompare(b.nomeAluno || '')
    );
  }

  /**
   * Calcula estatísticas da turma (média geral e distribuição por faixas)
   */
  calcularEstatisticasTurma(notas: Nota[]): {
    mediaTurma: string;
    totalAlunos: number;
    excelentes: number;
    boas: number;
    regulares: number;
    baixas: number;
  } {
    const mediasFinais = notas.map(nota => this.calcularMediaFinal(nota));
    const totalAlunos = mediasFinais.length;
    const mediaTurma = totalAlunos 
      ? (mediasFinais.reduce((a, b) => a + b, 0) / totalAlunos).toFixed(1) 
      : '-';

    const faixa = (min: number, max: number) =>
      mediasFinais.filter(m => m >= min && m <= max).length;

    return {
      mediaTurma,
      totalAlunos,
      excelentes: faixa(9, 10),
      boas: faixa(7, 8.9),
      regulares: faixa(6, 8.9),
      baixas: faixa(0, 5.9),
    };
  }

  /**
   * Ordena notas por critério específico
   */
  ordenarNotas(
    notas: Nota[],
    criterio: 'nome' | 'parcial' | 'global' | 'participacao' | 'recuperacao' | 'media' | 'data'
  ): Nota[] {
    const dadosOrdenados = [...notas];
    
    switch (criterio) {
      case 'nome':
        dadosOrdenados.sort((a, b) => (a.nomeAluno || '').localeCompare(b.nomeAluno || ''));
        break;
      case 'parcial':
        dadosOrdenados.sort((a, b) => (b.notaParcial ?? 0) - (a.notaParcial ?? 0));
        break;
      case 'global':
        dadosOrdenados.sort((a, b) => (b.notaGlobal ?? 0) - (a.notaGlobal ?? 0));
        break;
      case 'participacao':
        dadosOrdenados.sort((a, b) => (b.notaParticipacao ?? 0) - (a.notaParticipacao ?? 0));
        break;
      case 'recuperacao':
        dadosOrdenados.sort((a, b) => (b.notaRecuperacao ?? 0) - (a.notaRecuperacao ?? 0));
        break;
      case 'media':
        dadosOrdenados.sort((a, b) => this.calcularMediaFinal(b) - this.calcularMediaFinal(a));
        break;
      case 'data':
        dadosOrdenados.sort((a, b) => {
          const da = this.parseData(a.dataLancamento);
          const db = this.parseData(b.dataLancamento);
          return db.getTime() - da.getTime();
        });
        break;
    }
    
    return dadosOrdenados;
  }

  /**
   * Pagina resultados de notas
   */
  paginarNotas(notas: Nota[], pagina: number, itensPorPagina: number): Nota[] {
    const inicio = (pagina - 1) * itensPorPagina;
    return notas.slice(inicio, inicio + itensPorPagina);
  }
}
