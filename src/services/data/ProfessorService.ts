import { Professor } from '../../models/Professor';

const API_URL = 'https://mobclassapi-3ohr3pb77q-uc.a.run.app';

export class ProfessorService {
  constructor() {}

  async listar(): Promise<Professor[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor', action: 'listar' }),
    });
    if (!response.ok) throw new Error('Erro ao listar professores');
    return await response.json();
  }

  async buscarPorId(id: string): Promise<Professor | null> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor', action: 'buscarPorId', id }),
    });
    if (!response.ok) throw new Error('Erro ao buscar professor');
    return await response.json();
  }

  async criar(professor: Omit<Professor, 'id'>): Promise<string> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor', action: 'criar', professor }),
    });
    if (!response.ok) throw new Error('Erro ao criar professor');
    const result = await response.json();
    return result.id;
  }

  async atualizar(id: string, professor: Partial<Omit<Professor, 'id'>>): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor', action: 'atualizar', id, professor }),
    });
    if (!response.ok) throw new Error('Erro ao atualizar professor');
  }

  async excluir(id: string): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'professor', action: 'excluir', id }),
    });
    if (!response.ok) throw new Error('Erro ao excluir professor');
  }
}
