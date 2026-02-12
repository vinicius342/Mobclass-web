import { Agenda } from '../../models/Agenda';

const API_URL = 'https://mobclassapi-3ohr3pb77q-uc.a.run.app';

export class AgendaService {
  async listar(): Promise<Agenda[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'agenda', action: 'listar' })
    });

    if (!response.ok) {
      throw new Error(`Erro ao listar agendas: ${response.statusText}`);
    }

    return response.json();
  }

  async buscarPorId(id: string): Promise<Agenda | null> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'agenda', action: 'buscarPorId', id })
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar agenda: ${response.statusText}`);
    }

    return response.json();
  }

  async criar(agenda: Omit<Agenda, 'id'>): Promise<string> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'agenda', action: 'criar', agenda })
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar agenda: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  async atualizar(id: string, agenda: Partial<Omit<Agenda, 'id'>>): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'agenda', action: 'atualizar', id, agenda })
    });

    if (!response.ok) {
      throw new Error(`Erro ao atualizar agenda: ${response.statusText}`);
    }
  }

  async deletar(id: string): Promise<void> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'agenda', action: 'deletar', id })
    });

    if (!response.ok) {
      throw new Error(`Erro ao deletar agenda: ${response.statusText}`);
    }
  }

  async listarPorTurma(turmaId: string): Promise<Agenda[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'agenda', action: 'listarPorTurma', turmaId })
    });

    if (!response.ok) {
      throw new Error(`Erro ao listar agendas por turma: ${response.statusText}`);
    }

    return response.json();
  }

  async listarPorTurmas(turmaIds: string[]): Promise<Agenda[]> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'agenda', action: 'listarPorTurmas', turmaIds })
    });

    if (!response.ok) {
      throw new Error(`Erro ao listar agendas por turmas: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Extrai o turno (manha, tarde, noite) a partir do horário de início
   */
  getTurnoFromHorario(horario: string): string {
    const horarioInicio = horario.split(' - ')[0];
    const hora = parseInt(horarioInicio.split(':')[0]);

    if (hora >= 6 && hora < 12) {
      return 'manha';
    } else if (hora >= 12 && hora < 18) {
      return 'tarde';
    } else {
      return 'noite';
    }
  }

  /**
   * Filtra aulas por professor usando os vínculos
   */
  filtrarAulasPorProfessor(aulas: Agenda[], professorId: string): Agenda[] {
    if (!professorId) return aulas;
    return aulas.filter(aula => aula.professorId === professorId);
  }

  /**
   * Filtra aulas por turno
   */
  filtrarAulasPorTurno(aulas: Agenda[], turno: string): Agenda[] {
    if (!turno) return aulas;

    return aulas.filter(aula => {
      const turnoAula = this.getTurnoFromHorario(aula.horario);
      return turnoAula === turno;
    });
  }

  /**
   * Agrupa aulas por turma
   */
  agruparPorTurma(aulas: Agenda[]): Record<string, Agenda[]> {
    const agrupado: Record<string, Agenda[]> = {};
    
    aulas.forEach(aula => {
      if (!agrupado[aula.turmaId]) {
        agrupado[aula.turmaId] = [];
      }
      agrupado[aula.turmaId].push(aula);
    });

    return agrupado;
  }
}

export const agendaService = new AgendaService();
