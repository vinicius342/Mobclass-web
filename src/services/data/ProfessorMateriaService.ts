/**
 * Retorna um array de IDs de matérias vinculadas a um professor (sem duplicidade)
 */

import { ProfessorMateria } from '../../models/ProfessorMateria';

const API_URL = 'https://mobclassapi-3ohr3pb77q-uc.a.run.app';

export class ProfessorMateriaService {
  constructor() {}

  async listar(): Promise<ProfessorMateria[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor_materia', action: 'listar' }),
    });
    if (!response.ok) throw new Error('Erro ao listar vínculos professor-matéria');
    return response.json();
  }

  async listarPorTurmas(turmaIds: string[]): Promise<ProfessorMateria[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor_materia', action: 'listarPorTurmas', turmaIds }),
    });
    if (!response.ok) throw new Error('Erro ao listar vínculos por turmas');
    return response.json();
  }

  async buscarPorId(id: string): Promise<ProfessorMateria | null> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor_materia', action: 'buscarPorId', id }),
    });
    if (!response.ok) throw new Error('Erro ao buscar vínculo');
    return response.json();
  }

  async criar(professorMateria: Omit<ProfessorMateria, 'id'>): Promise<string> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor_materia', action: 'criar', professorMateria }),
    });
    if (!response.ok) throw new Error('Erro ao criar vínculo');
    return response.json();
  }

  async atualizar(
    id: string,
    professorMateria: Partial<Omit<ProfessorMateria, 'id'>>
  ): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor_materia', action: 'atualizar', id, professorMateria }),
    });
    if (!response.ok) throw new Error('Erro ao atualizar vínculo');
  }

  async excluir(id: string): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor_materia', action: 'excluir', id }),
    });
    if (!response.ok) throw new Error('Erro ao excluir vínculo');
  }

  async listarPorProfessor(professorId: string): Promise<ProfessorMateria[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor_materia', action: 'buscarPorProfessorId', professorId }),
    });
    if (!response.ok) throw new Error('Erro ao listar vínculos por professor');
    return response.json();
  }

  async listarPorMateria(materiaId: string): Promise<ProfessorMateria[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor_materia', action: 'buscarPorMateriaId', materiaId }),
    });
    if (!response.ok) throw new Error('Erro ao listar vínculos por matéria');
    return response.json();
  }

  async listarPorTurma(turmaId: string): Promise<ProfessorMateria[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor_materia', action: 'buscarPorTurmaId', turmaId }),
    });
    if (!response.ok) throw new Error('Erro ao listar vínculos por turma');
    return response.json();
  }

  async buscarVinculoEspecifico(
    professorId: string,
    materiaId: string,
    turmaId: string
  ): Promise<ProfessorMateria | null> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        domain: 'professor_materia', 
        action: 'buscarPorProfessorMateriaETurma', 
        professorId, 
        materiaId, 
        turmaId 
      }),
    });
    if (!response.ok) throw new Error('Erro ao buscar vínculo específico');
    return response.json();
  }

  async copiarVinculos(turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        domain: 'professor_materia', 
        action: 'copiarVinculos', 
        turmaOrigemId, 
        turmaDestinoId 
      }),
    });
    if (!response.ok) throw new Error('Erro ao copiar vínculos');
  }

  /**
   * Verifica se um professor está vinculado a uma matéria em uma turma
   */
  async professorLecionaMateriaNaTurma(
    professorId: string,
    materiaId: string,
    turmaId: string
  ): Promise<boolean> {
    const vinculo = await this.buscarVinculoEspecifico(professorId, materiaId, turmaId);
    return vinculo !== null;
  }

  /**
   * Obtém todas as matérias que um professor leciona em uma turma
   */
  async listarMateriasDoProfessorNaTurma(
    professorId: string,
    turmaId: string
  ): Promise<string[]> {
    const vinculos = await this.listar();
    return vinculos
      .filter(v => v.professorId === professorId && v.turmaId === turmaId)
      .map(v => v.materiaId);
  }

  /**
   * Obtém todos os professores que lecionam uma matéria em uma turma
   */
  async listarProfessoresDaMateriaNaTurma(
    materiaId: string,
    turmaId: string
  ): Promise<string[]> {
    const vinculos = await this.listar();
    return vinculos
      .filter(v => v.materiaId === materiaId && v.turmaId === turmaId)
      .map(v => v.professorId);
  }

  async listarMateriasPorProfessor(professorId: string): Promise<string[]> {
    const vinculos = await this.listarPorProfessor(professorId);
    // Extrai apenas os materiaId únicos
    const materiaIds = Array.from(new Set(vinculos.map(v => v.materiaId)));
    return materiaIds;
  }

  /**
   * Obtém os IDs das matérias vinculadas a uma turma (útil para filtrar dropdowns)
   */
  obterMateriaIdsDaTurma(vinculos: ProfessorMateria[], turmaId: string): string[] {
    return vinculos
      .filter(v => v.turmaId === turmaId)
      .map(v => v.materiaId);
  }
}
