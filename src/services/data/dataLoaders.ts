// src/utils/dataLoaders.ts
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Interface para dados básicos de coleções
 */
export interface BasicEntity {
  id: string;
  nome: string;
}

export interface Turma extends BasicEntity {
  anoLetivo?: string | number;
  isVirtualizada?: boolean;
  turmaOriginalId?: string;
}

export interface Vinculo {
  id: string;
  professorId: string;
  materiaId: string;
  turmaId: string;
}

/**
 * Carrega todos os professores
 * Usado em: Agenda, Vinculos, Dashboard, Turmas, Usuarios
 */
export async function loadProfessores(): Promise<BasicEntity[]> {
  const snap = await getDocs(collection(db, 'professores'));
  return snap.docs
    .map(d => ({ id: d.id, nome: d.data().nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/**
 * Carrega todas as matérias
 * Usado em: Agenda, Vinculos, Dashboard, Turmas, Frequencia, Materias, Notas
 */
export async function loadMaterias(): Promise<BasicEntity[]> {
  const snap = await getDocs(collection(db, 'materias'));
  return snap.docs
    .map(d => ({ id: d.id, nome: d.data()?.nome || '-' }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/**
 * Carrega matérias específicas por IDs
 * Otimização quando não precisa de todas
 */
export async function loadMateriasByIds(ids: string[]): Promise<BasicEntity[]> {
  if (ids.length === 0) return [];

  const materias = await Promise.all(
    ids.map(async id => {
      const docSnap = await getDoc(doc(db, 'materias', id));
      return { id: docSnap.id, nome: docSnap.data()?.nome || '-' };
    })
  );

  return materias.sort((a, b) => a.nome.localeCompare(b.nome));
}

/**
 * Carrega turmas de um ano letivo específico
 * Usado em: Agenda, Vinculos, Dashboard, Turmas, Usuarios, Notas
 */
export async function loadTurmasByAnoLetivo(anoLetivo: number | string): Promise<Turma[]> {
  const snap = await getDocs(
    query(collection(db, 'turmas'), where('anoLetivo', '==', anoLetivo.toString()))
  );

  return snap.docs
    .map(d => ({ id: d.id, nome: d.data().nome, anoLetivo: d.data().anoLetivo }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/**
 * Carrega turmas específicas por IDs
 * Usado quando professor tem apenas algumas turmas vinculadas
 */
export async function loadTurmasByIds(ids: string[], anoLetivo?: number | string): Promise<Turma[]> {
  if (ids.length === 0) return [];

  const turmasPromises = await Promise.all(
    ids.map(async id => {
      const docSnap = await getDoc(doc(db, 'turmas', id));
      if (!docSnap.exists()) return null;
      const data = docSnap.data();
      return { 
        id: docSnap.id, 
        nome: data.nome as string, 
        anoLetivo: data.anoLetivo 
      } as Turma;
    })
  );

  const turmasValidas = turmasPromises.filter((t): t is Turma => t !== null);

  // Filtrar por ano letivo se especificado
  const turmasFiltradas = anoLetivo
    ? turmasValidas.filter(t => t.anoLetivo?.toString() === anoLetivo.toString())
    : turmasValidas;

  return turmasFiltradas.sort((a, b) => a.nome.localeCompare(b.nome));
}

/**
 * Carrega todos os vínculos professor-matéria-turma
 * Usado em: Agenda, Vinculos, Dashboard, Turmas, Notas
 */
export async function loadVinculos(professorId?: string): Promise<Vinculo[]> {
  let snap;

  if (professorId) {
    // Carrega apenas vínculos de um professor específico
    snap = await getDocs(
      query(collection(db, 'professores_materias'), where('professorId', '==', professorId))
    );
  } else {
    // Carrega todos os vínculos (admin)
    snap = await getDocs(collection(db, 'professores_materias'));
  }

  return snap.docs.map(d => ({
    id: d.id,
    professorId: d.data().professorId,
    materiaId: d.data().materiaId,
    turmaId: d.data().turmaId
  }));
}

/**
 * Carrega vínculos filtrados por turmas do ano letivo
 * Otimização para evitar carregar vínculos de anos anteriores
 */
export async function loadVinculosByAnoLetivo(
  anoLetivo: number | string,
  professorId?: string
): Promise<Vinculo[]> {
  // Primeiro buscar turmas do ano
  const turmas = await loadTurmasByAnoLetivo(anoLetivo);
  const turmaIds = new Set(turmas.map(t => t.id));

  // Buscar vínculos
  const vinculos = await loadVinculos(professorId);

  // Filtrar apenas vínculos de turmas do ano atual
  return vinculos.filter(v => turmaIds.has(v.turmaId));
}

/**
 * Carrega dados completos para contexto professor (com vínculos)
 * Retorna apenas dados relacionados aos vínculos do professor
 */
export async function loadProfessorData(
  professorId: string,
  anoLetivo: number | string
): Promise<{
  vinculos: Vinculo[];
  turmas: Turma[];
  materias: BasicEntity[];
}> {
  // Buscar vínculos do professor
  const vinculos = await loadVinculos(professorId);

  // Extrair IDs únicos
  const turmaIds = [...new Set(vinculos.map(v => v.turmaId))];
  const materiaIds = [...new Set(vinculos.map(v => v.materiaId))];

  // Buscar turmas e filtrar por ano letivo
  const turmas = await loadTurmasByIds(turmaIds, anoLetivo);
  const turmaIdsDoAno = new Set(turmas.map(t => t.id));

  // Filtrar vínculos apenas de turmas do ano atual
  const vinculosFiltrados = vinculos.filter(v => turmaIdsDoAno.has(v.turmaId));

  // Buscar apenas matérias que estão nos vínculos filtrados
  const materiaIdsFiltrados = [...new Set(vinculosFiltrados.map(v => v.materiaId))];
  const materias = await loadMateriasByIds(materiaIdsFiltrados);

  return {
    vinculos: vinculosFiltrados,
    turmas,
    materias
  };
}

/**
 * Carrega dados completos para contexto admin
 * Retorna todos os dados do ano letivo
 */
export async function loadAdminData(
  anoLetivo: number | string
): Promise<{
  professores: BasicEntity[];
  vinculos: Vinculo[];
  turmas: Turma[];
  materias: BasicEntity[];
}> {
  // Carregar dados em paralelo
  const [professores, turmas, materias, vinculos] = await Promise.all([
    loadProfessores(),
    loadTurmasByAnoLetivo(anoLetivo),
    loadMaterias(),
    loadVinculos()
  ]);

  // Filtrar vínculos apenas de turmas do ano atual
  const turmaIds = new Set(turmas.map(t => t.id));
  const vinculosFiltrados = vinculos.filter(v => turmaIds.has(v.turmaId));

  return {
    professores,
    vinculos: vinculosFiltrados,
    turmas,
    materias
  };
}

/**
 * Função auxiliar para criar turmas virtualizadas do ano anterior
 * Usado em: Agenda, Notas (onde precisam mostrar dados históricos)
 */
export async function loadTurmasComVirtualizacao(
  anoLetivo: number | string
): Promise<Turma[]> {
  const anoAtual = typeof anoLetivo === 'string' ? parseInt(anoLetivo) : anoLetivo;
  const anoAnterior = anoAtual - 1;

  // Buscar turmas dos dois anos em paralelo
  const [turmasAtuais, turmasAnteriores] = await Promise.all([
    loadTurmasByAnoLetivo(anoAtual),
    loadTurmasByAnoLetivo(anoAnterior)
  ]);

  // Criar turmas virtualizadas
  const turmasVirtualizadas: Turma[] = [];

  for (const turmaAnterior of turmasAnteriores) {
    // Normalizar nomes para comparação
    const nomeAnterior = turmaAnterior.nome.trim().toLowerCase().replace(/\s+/g, ' ');
    const jaExisteAtual = turmasAtuais.some(t => {
      const nomeAtual = t.nome.trim().toLowerCase().replace(/\s+/g, ' ');
      return nomeAtual === nomeAnterior;
    });

    // Se não existe turma com mesmo nome no ano atual, virtualizar
    if (!jaExisteAtual) {
      turmasVirtualizadas.push({
        ...turmaAnterior,
        id: `virtual_${turmaAnterior.id}`,
        anoLetivo: anoAtual,
        isVirtualizada: true,
        turmaOriginalId: turmaAnterior.id
      });
    }
  }

  // Combinar e ordenar
  return [...turmasAtuais, ...turmasVirtualizadas].sort((a, b) => a.nome.localeCompare(b.nome));
}

/**
 * Extrai IDs únicos de vínculos
 * Função auxiliar para evitar código repetido
 */
export function extractIdsFromVinculos(vinculos: Vinculo[]): {
  turmaIds: string[];
  materiaIds: string[];
  professorIds: string[];
} {
  return {
    turmaIds: [...new Set(vinculos.map(v => v.turmaId))],
    materiaIds: [...new Set(vinculos.map(v => v.materiaId))],
    professorIds: [...new Set(vinculos.map(v => v.professorId))]
  };
}
