import { AgendaService } from '../src/services/data/AgendaService';
import { Agenda } from '../src/models/Agenda';
import { IAgendaRepository } from '../src/repositories/agenda/IAgendaRepository';

class FakeAgendaRepository implements IAgendaRepository {
  private agendas: Agenda[];

  constructor(initialAgendas: Agenda[] = []) {
    this.agendas = [...initialAgendas];
  }

  async listar(): Promise<Agenda[]> {
    return this.agendas;
  }

  async buscarPorId(id: string): Promise<Agenda | null> {
    return this.agendas.find(a => a.id === id) ?? null;
  }

  async criar(agenda: Omit<Agenda, 'id'>): Promise<string> {
    const id = `id-${this.agendas.length + 1}`;
    this.agendas.push({ id, ...agenda });
    return id;
  }

  async atualizar(id: string, agenda: Partial<Omit<Agenda, 'id'>>): Promise<void> {
    this.agendas = this.agendas.map(a => (a.id === id ? { ...a, ...agenda } : a));
  }

  async deletar(id: string): Promise<void> {
    this.agendas = this.agendas.filter(a => a.id !== id);
  }

  async listarPorTurma(turmaId: string): Promise<Agenda[]> {
    return this.agendas.filter(a => a.turmaId === turmaId);
  }

  async listarPorTurmas(turmaIds: string[]): Promise<Agenda[]> {
    return this.agendas.filter(a => turmaIds.includes(a.turmaId));
  }
}

const makeAgenda = (overrides: Partial<Agenda> = {}): Agenda => ({
  id: overrides.id ?? '1',
  diaSemana: overrides.diaSemana ?? 'segunda',
  horario: overrides.horario ?? '08:00 - 09:00',
  materiaId: overrides.materiaId ?? 'materia-1',
  turmaId: overrides.turmaId ?? 'turma-1',
  turno: overrides.turno ?? 'manha',
  professorId: overrides.professorId ?? 'prof-1',
});

describe('AgendaService', () => {
  describe('métodos de repositório', () => {
    it('deve listar agendas', async () => {
      const repo = new FakeAgendaRepository([
        makeAgenda({ id: '1' }),
        makeAgenda({ id: '2' }),
      ]);
      const service = new AgendaService(repo);

      const result = await service.listar();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });

    it('deve buscar por id', async () => {
      const repo = new FakeAgendaRepository([
        makeAgenda({ id: '1' }),
        makeAgenda({ id: '2' }),
      ]);
      const service = new AgendaService(repo);

      const found = await service.buscarPorId('2');
      const notFound = await service.buscarPorId('3');

      expect(found?.id).toBe('2');
      expect(notFound).toBeNull();
    });

    it('deve criar agenda', async () => {
      const repo = new FakeAgendaRepository();
      const service = new AgendaService(repo);

      const id = await service.criar({
        diaSemana: 'terca',
        horario: '10:00 - 11:00',
        materiaId: 'materia-2',
        turmaId: 'turma-2',
        turno: 'manha',
        professorId: 'prof-2',
      });

      expect(id).toBe('id-1');
      const all = await service.listar();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(id);
    });

    it('deve atualizar agenda', async () => {
      const repo = new FakeAgendaRepository([
        makeAgenda({ id: '1', horario: '08:00 - 09:00' }),
      ]);
      const service = new AgendaService(repo);

      await service.atualizar('1', { horario: '09:00 - 10:00' });

      const updated = await service.buscarPorId('1');
      expect(updated?.horario).toBe('09:00 - 10:00');
    });

    it('deve deletar agenda', async () => {
      const repo = new FakeAgendaRepository([
        makeAgenda({ id: '1' }),
        makeAgenda({ id: '2' }),
      ]);
      const service = new AgendaService(repo);

      await service.deletar('1');

      const all = await service.listar();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('2');
    });

    it('deve listar por turma', async () => {
      const repo = new FakeAgendaRepository([
        makeAgenda({ id: '1', turmaId: 'A' }),
        makeAgenda({ id: '2', turmaId: 'B' }),
        makeAgenda({ id: '3', turmaId: 'A' }),
      ]);
      const service = new AgendaService(repo);

      const result = await service.listarPorTurma('A');

      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toEqual(['1', '3']);
    });

    it('deve listar por múltiplas turmas', async () => {
      const repo = new FakeAgendaRepository([
        makeAgenda({ id: '1', turmaId: 'A' }),
        makeAgenda({ id: '2', turmaId: 'B' }),
        makeAgenda({ id: '3', turmaId: 'C' }),
      ]);
      const service = new AgendaService(repo);

      const result = await service.listarPorTurmas(['A', 'C']);

      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toEqual(['1', '3']);
    });
  });

  describe('getTurnoFromHorario', () => {
    const repo = new FakeAgendaRepository();
    const service = new AgendaService(repo);

    it('deve retornar manha para horários entre 06:00 e 11:59', () => {
      expect(service.getTurnoFromHorario('06:00 - 07:00')).toBe('manha');
      expect(service.getTurnoFromHorario('11:59 - 12:59')).toBe('manha');
    });

    it('deve retornar tarde para horários entre 12:00 e 17:59', () => {
      expect(service.getTurnoFromHorario('12:00 - 13:00')).toBe('tarde');
      expect(service.getTurnoFromHorario('17:59 - 18:59')).toBe('tarde');
    });

    it('deve retornar noite para demais horários', () => {
      expect(service.getTurnoFromHorario('05:00 - 06:00')).toBe('noite');
      expect(service.getTurnoFromHorario('18:00 - 19:00')).toBe('noite');
      expect(service.getTurnoFromHorario('23:00 - 00:00')).toBe('noite');
    });
  });

  describe('filtrarAulasPorProfessor', () => {
    const repo = new FakeAgendaRepository();
    const service = new AgendaService(repo);

    const aulas: Agenda[] = [
      makeAgenda({ id: '1', professorId: 'p1' }),
      makeAgenda({ id: '2', professorId: 'p2' }),
      makeAgenda({ id: '3', professorId: 'p1' }),
    ];

    it('deve retornar todas as aulas quando professorId não for informado', () => {
      const result = service.filtrarAulasPorProfessor(aulas, '');
      expect(result).toHaveLength(3);
    });

    it('deve filtrar aulas por professorId', () => {
      const result = service.filtrarAulasPorProfessor(aulas, 'p1');
      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toEqual(['1', '3']);
    });
  });

  describe('filtrarAulasPorTurno', () => {
    const repo = new FakeAgendaRepository();
    const service = new AgendaService(repo);

    const aulas: Agenda[] = [
      makeAgenda({ id: '1', horario: '07:00 - 08:00' }), // manha
      makeAgenda({ id: '2', horario: '13:00 - 14:00' }), // tarde
      makeAgenda({ id: '3', horario: '19:00 - 20:00' }), // noite
    ];

    it('deve retornar todas as aulas quando turno não for informado', () => {
      const result = service.filtrarAulasPorTurno(aulas, '');
      expect(result).toHaveLength(3);
    });

    it('deve filtrar aulas pelo turno correto', () => {
      const manha = service.filtrarAulasPorTurno(aulas, 'manha');
      const tarde = service.filtrarAulasPorTurno(aulas, 'tarde');
      const noite = service.filtrarAulasPorTurno(aulas, 'noite');

      expect(manha.map(a => a.id)).toEqual(['1']);
      expect(tarde.map(a => a.id)).toEqual(['2']);
      expect(noite.map(a => a.id)).toEqual(['3']);
    });
  });

  describe('agruparPorTurma', () => {
    const repo = new FakeAgendaRepository();
    const service = new AgendaService(repo);

    const aulas: Agenda[] = [
      makeAgenda({ id: '1', turmaId: 'A' }),
      makeAgenda({ id: '2', turmaId: 'B' }),
      makeAgenda({ id: '3', turmaId: 'A' }),
    ];

    it('deve agrupar aulas por turmaId', () => {
      const agrupado = service.agruparPorTurma(aulas);

      expect(Object.keys(agrupado)).toEqual(['A', 'B']);
      expect(agrupado['A'].map(a => a.id)).toEqual(['1', '3']);
      expect(agrupado['B'].map(a => a.id)).toEqual(['2']);
    });

    it('deve retornar objeto vazio quando não houver aulas', () => {
      const agrupado = service.agruparPorTurma([]);
      expect(agrupado).toEqual({});
    });
  });
});
