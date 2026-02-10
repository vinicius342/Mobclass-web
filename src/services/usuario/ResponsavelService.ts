import { Responsavel } from '../../models/Responsavel';

const API_URL = 'https://mobclassapi-3ohr3pb77q-uc.a.run.app';

export class ResponsavelService {
  constructor() {}

  async listar(): Promise<Responsavel[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'responsavel', action: 'listar' }),
    });
    if (!response.ok) throw new Error('Erro ao listar responsáveis');
    return response.json();
  }

  async buscarPorId(id: string): Promise<Responsavel | null> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'responsavel', action: 'buscarPorId', id }),
    });
    if (!response.ok) throw new Error('Erro ao buscar responsável');
    return response.json();
  }

  async criar(responsavel: Omit<Responsavel, 'id'>): Promise<string> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'responsavel', action: 'criar', responsavel }),
    });
    if (!response.ok) throw new Error('Erro ao criar responsável');
    const result = await response.json();
    return result.id;
  }

  async atualizar(id: string, responsavel: Partial<Omit<Responsavel, 'id'>>): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'responsavel', action: 'atualizar', id, responsavel }),
    });
    if (!response.ok) throw new Error('Erro ao atualizar responsável');
  }

  async excluir(id: string): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'responsavel', action: 'excluir', id }),
    });
    if (!response.ok) throw new Error('Erro ao excluir responsável');
  }
}

