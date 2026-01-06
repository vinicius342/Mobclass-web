import { Materia } from '../../models/Materia';
import { IMateriaRepository } from '../../repositories/materia/IMateriaRepository';
import { ProfessorMateria } from '../../models/ProfessorMateria';

export type MateriaComTurma = Materia & { turmaId?: string };

export class MateriaService {
  constructor(private materiaRepository: IMateriaRepository) {}

  async listar(): Promise<Materia[]> {
    return this.materiaRepository.findAll();
  }

  async buscarPorId(id: string): Promise<Materia | null> {
    return this.materiaRepository.findById(id);
  }

  async criar(materia: Omit<Materia, 'id'>): Promise<string> {
    return this.materiaRepository.create(materia);
  }

  async atualizar(id: string, materia: Partial<Omit<Materia, 'id'>>): Promise<void> {
    return this.materiaRepository.update(id, materia);
  }

  async excluir(id: string): Promise<void> {
    return this.materiaRepository.delete(id);
  }

  /**
   * Constrói lista de matérias com turmaId baseado nos vínculos de professores
   * Útil para admin e professores que precisam ver matérias por turma
   */
  construirMateriasComTurmas(
    materias: Materia[],
    vinculos: ProfessorMateria[],
    turmaIdsFiltro?: string[]
  ): MateriaComTurma[] {
    const materiasMap = new Map(materias.map(m => [m.id, m]));
    const materiasComTurma = new Map<string, MateriaComTurma>();

    // Filtrar vínculos se houver filtro de turmas
    const vinculosFiltrados = turmaIdsFiltro
      ? vinculos.filter(v => turmaIdsFiltro.includes(v.turmaId))
      : vinculos;

    vinculosFiltrados.forEach(vinculo => {
      const materia = materiasMap.get(vinculo.materiaId);
      if (materia) {
        const key = `${materia.id}_${vinculo.turmaId}`;
        materiasComTurma.set(key, {
          id: materia.id,
          codigo: materia.codigo,
          nome: materia.nome,
          turmaId: vinculo.turmaId,
        });
      }
    });

    return Array.from(materiasComTurma.values());
  }

  /**
   * Remove duplicatas de matérias mantendo apenas uma por ID
   */
  removerDuplicatas(materias: MateriaComTurma[]): Materia[] {
    const unique: Materia[] = [];
    const seen = new Set<string>();

    materias.forEach(m => {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        unique.push({
          id: m.id,
          codigo: m.codigo,
          nome: m.nome,
        });
      }
    });

    return unique;
  }

  /**
   * Gera um código único para uma matéria baseado no nome
   * Formato: 3 primeiras letras do nome (uppercase) + número aleatório de 3 dígitos
   * Exemplo: "Matemática" -> "MAT432"
   */
  gerarCodigoMateria(nome: string): string {
    const prefixo = nome.substring(0, 3).toUpperCase();
    const numero = Math.floor(100 + Math.random() * 900);
    return `${prefixo}${numero}`;
  }

  /**
   * Determina a categoria de uma matéria baseada no nome
   * Se já tiver categoria salva, usa ela. Senão, infere pela palavra-chave no nome.
   */
  determinarCategoria(nome: string, categoriaSalva?: string): string {
    if (categoriaSalva) return categoriaSalva;

    const nomeNormalizado = nome.toLowerCase();
    
    if (/matemática|física|química|biologia|ciências|geometria|álgebra|exatas/i.test(nomeNormalizado)) {
      return 'Exatas';
    } else if (/história|geografia|filosofia|sociologia|humanas/i.test(nomeNormalizado)) {
      return 'Humanas';
    } else if (/português|inglês|espanhol|literatura|linguagens|redação/i.test(nomeNormalizado)) {
      return 'Linguagens';
    }
    
    return 'Outras';
  }

  /**
   * Verifica se já existe uma matéria com o mesmo nome e categoria
   * Retorna true se houver duplicidade
   */
  validarDuplicidade(
    materias: Materia[],
    nome: string,
    categoria: string,
    idParaIgnorar?: string
  ): boolean {
    return materias.some(m =>
      m.nome.toLowerCase().trim() === nome.toLowerCase().trim() &&
      this.determinarCategoria(m.nome, m.categoria) === categoria &&
      m.id !== idParaIgnorar
    );
  }

  /**
   * Filtra matérias por busca e categoria, e aplica paginação
   */
  filtrarEPaginar(
    materias: Materia[],
    termoBusca: string,
    categoriaFiltro: string,
    paginaAtual: number,
    itensPorPagina: number
  ): { materiasFiltradas: Materia[]; totalPaginas: number; materiasPaginadas: Materia[] } {
    // Filtrar
    const materiasFiltradas = materias.filter(materia => {
      const matchBusca = termoBusca === '' || materia.nome.toLowerCase().includes(termoBusca.toLowerCase());
      const categoriaFinal = this.determinarCategoria(materia.nome, materia.categoria);
      const matchCategoria = categoriaFiltro === '' || categoriaFinal === categoriaFiltro;
      return matchBusca && matchCategoria;
    });

    // Paginar
    const totalPaginas = Math.ceil(materiasFiltradas.length / itensPorPagina);
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const materiasPaginadas = materiasFiltradas.slice(inicio, fim);

    return { materiasFiltradas, totalPaginas, materiasPaginadas };
  }

  /**
   * Calcula estatísticas de matérias por categoria
   */
  calcularEstatisticasPorCategoria(materias: Materia[]): {
    total: number;
    exatas: number;
    humanas: number;
    linguagens: number;
    outras: number;
  } {
    return {
      total: materias.length,
      exatas: materias.filter(m => this.determinarCategoria(m.nome, m.categoria) === 'Exatas').length,
      humanas: materias.filter(m => this.determinarCategoria(m.nome, m.categoria) === 'Humanas').length,
      linguagens: materias.filter(m => this.determinarCategoria(m.nome, m.categoria) === 'Linguagens').length,
      outras: materias.filter(m => this.determinarCategoria(m.nome, m.categoria) === 'Outras').length,
    };
  }
}
