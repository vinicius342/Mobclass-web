import { Administrador } from '../../models/Administrador';

const API_URL = 'https://mobclassapi-3ohr3pb77q-uc.a.run.app';

export class AdministradorService {
  constructor() {}

  async listar(): Promise<Administrador[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'administrador', action: 'listar' }),
    });
    if (!response.ok) throw new Error('Erro ao listar administradores');
    return response.json();
  }

  async buscarPorId(id: string): Promise<Administrador | null> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'administrador', action: 'buscarPorId', id }),
    });
    if (!response.ok) throw new Error('Erro ao buscar administrador');
    return response.json();
  }

  async criar(administrador: Omit<Administrador, 'id'>): Promise<string> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'administrador', action: 'criar', administrador }),
    });
    if (!response.ok) throw new Error('Erro ao criar administrador');
    return response.json();
  }

  async atualizar(id: string, administrador: Partial<Omit<Administrador, 'id'>>): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'administrador', action: 'atualizar', id, administrador }),
    });
    if (!response.ok) throw new Error('Erro ao atualizar administrador');
  }

  async excluir(id: string): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'administrador', action: 'excluir', id }),
    });
    if (!response.ok) throw new Error('Erro ao excluir administrador');
  }
}

