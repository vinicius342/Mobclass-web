import { agendaService } from '../src/services/data/AgendaService';
import { Agenda } from '../src/models/Agenda';

describe('AgendaService', () => {
  const API_URL = 'https://mobclassapi-3ohr3pb77q-uc.a.run.app';

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  const makeAgenda = (overrides: Partial<Agenda> = {}): Agenda => ({
    id: overrides.id ?? '1',
    diaSemana: overrides.diaSemana ?? 'segunda',
    horario: overrides.horario ?? '08:00 - 09:00',
    materiaId: overrides.materiaId ?? 'materia-1',
    turmaId: overrides.turmaId ?? 'turma-1',
    turno: overrides.turno ?? 'manha',
    professorId: overrides.professorId ?? 'prof-1',
  });

  const mockFetchSuccess = (data: any) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    });
  };

  describe('métodos de repositório', () => {
    it('deve listar agendas', async () => {
      const agendas = [
        makeAgenda({ id: '1' }),
        makeAgenda({ id: '2' }),
      ];
      mockFetchSuccess(agendas);

      const result = await agendaService.listar();

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'agenda', action: 'listar' })
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });

    it('deve buscar por id', async () => {
      const agenda = makeAgenda({ id: '2' });
      mockFetchSuccess(agenda);

      const found = await agendaService.buscarPorId('2');

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'agenda', action: 'buscarPorId', id: '2' })
      });
      expect(found?.id).toBe('2');
    });

    it('deve criar agenda', async () => {
      mockFetchSuccess({ id: 'id-1' });

      const id = await agendaService.criar({
        diaSemana: 'terca',
        horario: '10:00 - 11:00',
        materiaId: 'materia-2',
        turmaId: 'turma-2',
        turno: 'manha',
        professorId: 'prof-2',
      });

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domain: 'agenda', 
          action: 'criar', 
          agenda: {
            diaSemana: 'terca',
            horario: '10:00 - 11:00',
            materiaId: 'materia-2',
            turmaId: 'turma-2',
            turno: 'manha',
            professorId: 'prof-2',
          }
        })
      });
      expect(id).toBe('id-1');
    });

    it('deve atualizar agenda', async () => {
      mockFetchSuccess({});

      await agendaService.atualizar('1', { horario: '09:00 - 10:00' });

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domain: 'agenda', 
          action: 'atualizar', 
          id: '1',
          agenda: { horario: '09:00 - 10:00' }
        })
      });
    });

    it('deve deletar agenda', async () => {
      mockFetchSuccess({});

      await agendaService.deletar('1');

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'agenda', action: 'deletar', id: '1' })
      });
    });

    it('deve listar por turma', async () => {
      const agendas = [
        makeAgenda({ id: '1', turmaId: 'A' }),
        makeAgenda({ id: '3', turmaId: 'A' }),
      ];
      mockFetchSuccess(agendas);

      const result = await agendaService.listarPorTurma('A');

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'agenda', action: 'listarPorTurma', turmaId: 'A' })
      });
      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toEqual(['1', '3']);
    });

    it('deve listar por múltiplas turmas', async () => {
      const agendas = [
        makeAgenda({ id: '1', turmaId: 'A' }),
        makeAgenda({ id: '3', turmaId: 'C' }),
      ];
      mockFetchSuccess(agendas);

      const result = await agendaService.listarPorTurmas(['A', 'C']);

      expect(global.fetch).toHaveBeenCalledWith(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'agenda', action: 'listarPorTurmas', turmaIds: ['A', 'C'] })
      });
      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toEqual(['1', '3']);
    });
  });

  describe('getTurnoFromHorario', () => {
    it('deve retornar manha para horários entre 06:00 e 11:59', () => {
      expect(agendaService.getTurnoFromHorario('06:00 - 07:00')).toBe('manha');
      expect(agendaService.getTurnoFromHorario('11:59 - 12:59')).toBe('manha');
    });

    it('deve retornar tarde para horários entre 12:00 e 17:59', () => {
      expect(agendaService.getTurnoFromHorario('12:00 - 13:00')).toBe('tarde');
      expect(agendaService.getTurnoFromHorario('17:59 - 18:59')).toBe('tarde');
    });

    it('deve retornar noite para demais horários', () => {
      expect(agendaService.getTurnoFromHorario('05:00 - 06:00')).toBe('noite');
      expect(agendaService.getTurnoFromHorario('18:00 - 19:00')).toBe('noite');
      expect(agendaService.getTurnoFromHorario('23:00 - 00:00')).toBe('noite');
    });
  });

  describe('filtrarAulasPorProfessor', () => {
    const aulas: Agenda[] = [
      makeAgenda({ id: '1', professorId: 'p1' }),
      makeAgenda({ id: '2', professorId: 'p2' }),
      makeAgenda({ id: '3', professorId: 'p1' }),
    ];

    it('deve retornar todas as aulas quando professorId não for informado', () => {
      const result = agendaService.filtrarAulasPorProfessor(aulas, '');
      expect(result).toHaveLength(3);
    });

    it('deve filtrar aulas por professorId', () => {
      const result = agendaService.filtrarAulasPorProfessor(aulas, 'p1');
      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toEqual(['1', '3']);
    });
  });

  describe('filtrarAulasPorTurno', () => {
    const aulas: Agenda[] = [
      makeAgenda({ id: '1', horario: '07:00 - 08:00' }), // manha
      makeAgenda({ id: '2', horario: '13:00 - 14:00' }), // tarde
      makeAgenda({ id: '3', horario: '19:00 - 20:00' }), // noite
    ];

    it('deve retornar todas as aulas quando turno não for informado', () => {
      const result = agendaService.filtrarAulasPorTurno(aulas, '');
      expect(result).toHaveLength(3);
    });

    it('deve filtrar aulas pelo turno correto', () => {
      const manha = agendaService.filtrarAulasPorTurno(aulas, 'manha');
      const tarde = agendaService.filtrarAulasPorTurno(aulas, 'tarde');
      const noite = agendaService.filtrarAulasPorTurno(aulas, 'noite');

      expect(manha.map(a => a.id)).toEqual(['1']);
      expect(tarde.map(a => a.id)).toEqual(['2']);
      expect(noite.map(a => a.id)).toEqual(['3']);
    });
  });

  describe('agruparPorTurma', () => {
    const aulas: Agenda[] = [
      makeAgenda({ id: '1', turmaId: 'A' }),
      makeAgenda({ id: '2', turmaId: 'B' }),
      makeAgenda({ id: '3', turmaId: 'A' }),
    ];

    it('deve agrupar aulas por turmaId', () => {
      const agrupado = agendaService.agruparPorTurma(aulas);

      expect(Object.keys(agrupado)).toEqual(['A', 'B']);
      expect(agrupado['A'].map(a => a.id)).toEqual(['1', '3']);
      expect(agrupado['B'].map(a => a.id)).toEqual(['2']);
    });

    it('deve retornar objeto vazio quando não houver aulas', () => {
      const agrupado = agendaService.agruparPorTurma([]);
      expect(agrupado).toEqual({});
    });
  });
});
