import { IAgendaRepository } from '../../repositories/agenda/IAgendaRepository';
import { Agenda } from '../../models/Agenda';
import { ProfessorMateria } from '../../models/ProfessorMateria';

export class AgendaService {
  constructor(private repository: IAgendaRepository) {}

  async listar(): Promise<Agenda[]> {
    return this.repository.listar();
  }

  async buscarPorId(id: string): Promise<Agenda | null> {
    return this.repository.buscarPorId(id);
  }

  async criar(agenda: Omit<Agenda, 'id'>): Promise<string> {
    return this.repository.criar(agenda);
  }

  async atualizar(id: string, agenda: Partial<Omit<Agenda, 'id'>>): Promise<void> {
    return this.repository.atualizar(id, agenda);
  }

  async deletar(id: string): Promise<void> {
    return this.repository.deletar(id);
  }

  async listarPorTurma(turmaId: string): Promise<Agenda[]> {
    return this.repository.listarPorTurma(turmaId);
  }

  async listarPorTurmas(turmaIds: string[]): Promise<Agenda[]> {
    return this.repository.listarPorTurmas(turmaIds);
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
