import { useEffect, useState } from 'react';
import {
  Container, Button, Modal, Form, Row, Col,
} from 'react-bootstrap';
import { Calendar, X, Trash2 } from "lucide-react";

import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { useAnoLetivoAtual } from '../hooks/useAnoLetivoAtual';
import AgendaGradeView from '../components/agenda/AgendaGradeView';
import AgendaCadastroView from '../components/agenda/AgendaCadastroView';

import { turmaService } from '../services/data/TurmaService';
import { MateriaService } from '../services/data/MateriaService';
import { ProfessorService } from '../services/data/ProfessorService';
import { AgendaService } from '../services/data/AgendaService';
import { FirebaseMateriaRepository } from '../repositories/materia/FirebaseMateriaRepository';
import { FirebaseAgendaRepository } from '../repositories/agenda/FirebaseAgendaRepository';
import type { Turma } from '../models/Turma';
import type { Agenda } from '../models/Agenda';
import type { Materia } from '../models/Materia';
import type { Professor } from '../models/Professor';

import {
  exportarAgendaPDF,
  exportarAgendaExcel
} from '../utils/agendaExport';
import {
  getDayColor,
  getTurnoNome,
  getShiftColor,
  formatarNomeProfessor
} from '../utils/agendaUtils';

// Instanciar services
const materiaRepository = new FirebaseMateriaRepository();
const materiaService = new MateriaService(materiaRepository);

const professorService = new ProfessorService();


const agendaRepository = new FirebaseAgendaRepository();
const agendaService = new AgendaService(agendaRepository);

const diasSemana = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
const diasIndexMap = Object.fromEntries(diasSemana.map((d, i) => [d, i]));

export default function Agenda() {
  const { anoLetivo } = useAnoLetivoAtual();
  const { userData } = useAuth()!;
  const isAdmin = userData?.tipo === 'administradores';

  const [agendaPorTurma, setAgendaPorTurma] = useState<Record<string, Agenda[]>>({});
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Agenda | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('cadastro');

  const [turmaId, setTurmaId] = useState('');
  const [diaSemana, setDiaSemana] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [turno, setTurno] = useState('');
  const [professorId, setProfessorId] = useState('');
  const [filtroVisualizacaoTurma, setFiltroVisualizacaoTurma] = useState('');
  const [filtroProfessorVisualizacao, setFiltroProfessorVisualizacao] = useState('');
  const [filtroTurnoVisualizacao, setFiltroTurnoVisualizacao] = useState('manha');

  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroProfessor, setFiltroProfessor] = useState('');
  const [filtroTurno, setFiltroTurno] = useState('');
  const [filtroDia, setFiltroDia] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itensPorPagina = 15;

  const [turmasFiltradas, setTurmasFiltradas] = useState<Turma[]>([]);

  const [ordenacao, setOrdenacao] = useState<'turno' | 'dia' | 'horario' | 'materia' | 'professor' | 'turma'>('turno');

  const [expandedDays, setExpandedDays] = useState<Record<string, Record<string, boolean>>>({});

  // useEffect para filtrar turmas quando o professor é selecionado
  useEffect(() => {
    if (professorId) {
      const professor = professores.find(p => p.id === professorId);
      if (professor && professor.turmas && professor.turmas.length > 0) {
        const turmasProf = turmas.filter(t => professor.turmas.includes(t.id));
        setTurmasFiltradas(turmasProf);
      } else {
        setTurmasFiltradas([]);
      }
    } else {
      setTurmasFiltradas([]);
      setTurmaId(''); // Limpar turma selecionada quando desselecionar professor
    }
  }, [professorId, professores, turmas]);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        setLoading(true);

        if (isAdmin) {
          const [allProfessores, allTurmas, allMaterias] = await Promise.all([
            professorService.listar(),
            turmaService.listarComVirtualizacao(anoLetivo.toString()),
            materiaService.listar()
          ]);
          setProfessores(allProfessores);
          setTurmas(allTurmas);
          setMaterias(allMaterias);
        } else if (userData?.email) {
          const [allProfessores, allMaterias] = await Promise.all([
            professorService.listar(),
            materiaService.listar()
          ]);
          const professorAtual = allProfessores.find((p: Professor) => p.email === userData.email);
          if (!professorAtual) {
            console.error('Professor não encontrado com email:', userData.email);
            setLoading(false);
            return;
          }
          const allTurmas = await turmaService.listarPorAnoLetivo(anoLetivo.toString());
          setProfessores(allProfessores);
          setTurmas(allTurmas);
          setMaterias(allMaterias);
        }
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, [userData, anoLetivo, isAdmin]);

  // useEffect separado para buscar agenda quando turmas estiverem carregadas
  useEffect(() => {
    if (!loading && turmas.length > 0) {
      fetchAgendaPorTurma();
    }
  }, [turmas.length, loading]);

  // useEffect separado para resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [filtroBusca, filtroTurma, filtroProfessor, filtroTurno, filtroDia]);

  const fetchAgendaPorTurma = async () => {
    const data = await agendaService.listar();

    const turmaIdsValidos = new Set<string>();
    turmas.forEach(t => {
      if (t.turmaOriginalId && t.turmaOriginalId) {
        turmaIdsValidos.add(t.turmaOriginalId);
      } else {
        turmaIdsValidos.add(t.id);
      }
    });

    const dataFiltrada = data.filter(item => {
      return turmaIdsValidos.has(item.turmaId);
    });

    const agrupado: Record<string, Agenda[]> = {};
    dataFiltrada.forEach(item => {
      const turma = turmas.find(t => {
        if (t.turmaOriginalId && t.turmaOriginalId) {
          return t.turmaOriginalId === item.turmaId;
        }
        return t.id === item.turmaId;
      });

      if (turma) {
        const turmaKey = turma.id;
        if (!agrupado[turmaKey]) agrupado[turmaKey] = [];
        agrupado[turmaKey].push(item);
      }
    });
    setAgendaPorTurma(agrupado);
  };

  const handleShow = () => setShowModal(true);

  const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  };

  const toggleDayExpansion = (turmaId: string, day: string) => {
    setExpandedDays(prev => {
      const defaultState = isMobile() ? false : true;
      const currentState = prev[turmaId]?.[day] ?? defaultState;
      return {
        ...prev,
        [turmaId]: {
          ...prev[turmaId],
          [day]: !currentState
        }
      };
    });
  };

  const isDayExpanded = (turmaId: string, day: string) => {
    const defaultState = isMobile() ? false : true;
    return expandedDays[turmaId]?.[day] ?? defaultState;
  };

  const limparFiltros = () => {
    setFiltroBusca('');
    setFiltroTurma('');
    setFiltroProfessor('');
    setFiltroTurno('');
    setFiltroDia('');
    setCurrentPage(1);
  };

  const handleClose = () => {
    setEditId(null);
    setTurmaId('');
    setDiaSemana('');
    setInicio('');
    setFim('');
    setMateriaId('');
    setTurno('');
    setProfessorId('');
    setShowModal(false);
  };

  const handleSalvar = async () => {
    if (!turmaId || !diaSemana || !inicio || !fim || !materiaId || !turno || !professorId) return;

    // Validar horários de acordo com o turno
    const horaInicio = parseInt(inicio.split(':')[0]);
    const horaFim = parseInt(fim.split(':')[0]);

    if (turno === 'manha') {
      if (horaInicio < 6 || horaInicio >= 12 || horaFim < 6 || horaFim > 12) {
        alert('Para o turno da Manhã, os horários devem estar entre 06:00 e 12:00');
        return;
      }
    } else if (turno === 'tarde') {
      if (horaInicio < 12 || horaInicio >= 18 || horaFim < 12 || horaFim > 18) {
        alert('Para o turno da Tarde, os horários devem estar entre 12:00 e 18:00');
        return;
      }
    } else if (turno === 'noite') {
      if (horaInicio < 18 || horaInicio >= 24 || horaFim < 18 || horaFim > 24) {
        alert('Para o turno da Noite, os horários devem estar entre 18:00 e 24:00');
        return;
      }
    }

    // Validar se horário de fim é maior que horário de início
    if (fim <= inicio) {
      alert('O horário de término deve ser maior que o horário de início');
      return;
    }

    // Verificar se a turma é virtualizada e materializá-la se necessário
    const turmaParaSalvar = turmas.find(t => t.id === turmaId);
    let turmaIdOriginal = turmaParaSalvar?.turmaOriginalId || turmaId;

    // Se a turma é virtualizada, materializar antes de prosseguir
    if (turmaParaSalvar?.turmaOriginalId) {
      // console.log('Turma virtualizada detectada. Materializando...');
      try {
        // Passar o editId para não copiar a agenda que está sendo editada
        const agendasParaExcluir = editId ? [editId] : [];
        turmaIdOriginal = await turmaService.materializarTurmaVirtualComDados(
          turmaParaSalvar,
          turmas,
          agendasParaExcluir
        );
        // console.log('Turma materializada com sucesso:', turmaIdOriginal);

        // Atualizar lista de turmas após materialização
        const todasTurmas = await turmaService.listarTodas();
        const turmasDoAno = todasTurmas.filter((t: Turma) => t.anoLetivo === anoLetivo.toString());
        setTurmas(turmasDoAno);

        // Atualizar o turmaId para a turma materializada
        setTurmaId(turmaIdOriginal);
      } catch (error) {
        console.error('Erro ao materializar turma:', error);
        alert('Erro ao materializar turma virtual. Tente novamente.');
        return;
      }
    }


    // SEGUNDO: Verificar conflito de horários (após atualizar vínculo)
    const aulasConflitantes = Object.values(agendaPorTurma)
      .flat()
      .filter(aula => {
        // Ignora a própria aula se estiver editando
        if (editId && aula.id === editId) return false;

        // Verifica se é mesma turma e mesmo dia
        if (aula.turmaId !== turmaIdOriginal || aula.diaSemana !== diaSemana) return false;

        // Verifica sobreposição de horários
        const [aulaInicio, aulaFim] = aula.horario.split(' - ');

        // Converte horários para minutos para facilitar comparação
        const toMinutes = (time: string) => {
          const [h, m] = time.split(':').map(Number);
          return h * 60 + m;
        };

        const novoInicioMin = toMinutes(inicio);
        const novoFimMin = toMinutes(fim);
        const aulaInicioMin = toMinutes(aulaInicio);
        const aulaFimMin = toMinutes(aulaFim);

        // Verifica se há sobreposição
        return (novoInicioMin < aulaFimMin && novoFimMin > aulaInicioMin);
      });

    if (aulasConflitantes.length > 0) {
      const horariosConflito = aulasConflitantes.map(a => a.horario).join(', ');
      alert(`Conflito de horário! Já existe(m) aula(s) neste horário:\n\nDia: ${diaSemana}\nTurma: ${turmaParaSalvar?.nome}\nHorário(s) em conflito: ${horariosConflito}`);
      return;
    }

    // TERCEIRO: Salvar a agenda
    const horario = `${inicio} - ${fim}`;
    const payload = { turmaId: turmaIdOriginal, diaSemana, horario, materiaId, turno, professorId };

    if (editId) {
      await agendaService.atualizar(editId, payload);
    } else {
      await agendaService.criar(payload);
    }
    handleClose();
    fetchAgendaPorTurma();
  };

  const handleEditar = (item: Agenda) => {
    setEditId(item.id);
    setTurmaId(item.turmaId);
    setDiaSemana(item.diaSemana);
    const [inicioHorario, fimHorario] = item.horario.split(' - ');
    setInicio(inicioHorario);
    setFim(fimHorario);
    setMateriaId(item.materiaId);

    const hora = parseInt(inicioHorario.split(':')[0]);
    if (hora >= 6 && hora < 12) {
      setTurno('manha');
    } else if (hora >= 12 && hora < 18) {
      setTurno('tarde');
    } else {
      setTurno('noite');
    }

    setProfessorId(item.professorId);

    setShowModal(true);
  };

  const handleExcluir = (item: Agenda) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const confirmarExclusao = async () => {
    if (itemToDelete) {
      await agendaService.deletar(itemToDelete.id);
      fetchAgendaPorTurma();
      setShowDeleteModal(false);
      setItemToDelete(null);
    }
  };

  const cancelarExclusao = () => {
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  const downloadPDF = () => {
    exportarAgendaPDF({
      dadosFiltrados,
      turmas,
      materias,
      professores,
      diasSemana
    });
  };

  const downloadExcel = () => {
    exportarAgendaExcel({
      dadosFiltrados,
      turmas,
      materias,
      professores
    });
  };

  const filtrarAulasPorProfessor = (aulas: Agenda[]) => {
    return agendaService.filtrarAulasPorProfessor(aulas, filtroProfessorVisualizacao);
  };


  const obterDadosFiltradosParaGrade = () => {
    if (!filtroTurnoVisualizacao) return [];

    return dadosFiltrados.filter(item => {
      const turnoAula = agendaService.getTurnoFromHorario(item.horario);
      if (turnoAula !== filtroTurnoVisualizacao) return false;

      if (filtroVisualizacaoTurma) {
        const turma = turmas.find(t => t.id === filtroVisualizacaoTurma);
        if (turma?.turmaOriginalId && turma.turmaOriginalId) {
          if (item.turmaId !== turma.turmaOriginalId && item.turmaId !== filtroVisualizacaoTurma) {
            return false;
          }
        } else {
          if (item.turmaId !== filtroVisualizacaoTurma) {
            return false;
          }
        }
      }

      if (filtroProfessorVisualizacao) {
        if (item.professorId !== filtroProfessorVisualizacao) return false;
      }

      return true;
    });
  };

  const dadosOrdenados = Object.values(agendaPorTurma).flat()
    .sort((a, b) => {
      const turmaA = turmas.find(t => {
        if (t.turmaOriginalId && t.turmaOriginalId) {
          return t.turmaOriginalId === a.turmaId || t.id === a.turmaId;
        }
        return t.id === a.turmaId;
      });
      const turmaB = turmas.find(t => {
        if (t.turmaOriginalId && t.turmaOriginalId) {
          return t.turmaOriginalId === b.turmaId || t.id === b.turmaId;
        }
        return t.id === b.turmaId;
      });

      const nomeTurmaA = turmaA?.nome || '';
      const nomeTurmaB = turmaB?.nome || '';
      const nomeDiff = nomeTurmaA.localeCompare(nomeTurmaB);
      if (nomeDiff !== 0) return nomeDiff;
      const diaDiff = diasIndexMap[a.diaSemana] - diasIndexMap[b.diaSemana];
      return diaDiff !== 0 ? diaDiff : a.horario.localeCompare(b.horario);
    });

  const dadosFiltrados = dadosOrdenados.filter(item => {
    const turma = turmas.find(t => {
      if (t.turmaOriginalId && t.turmaOriginalId) {
        return t.turmaOriginalId === item.turmaId || t.id === item.turmaId;
      }
      return t.id === item.turmaId;
    });

    const materia = materias.find(m => m.id === item.materiaId);
    const professor = professores.find(p => p.id === item.professorId);

    if (filtroBusca) {
      const termoBusca = filtroBusca.toLowerCase();
      const contemBusca =
        turma?.nome.toLowerCase().includes(termoBusca) ||
        materia?.nome.toLowerCase().includes(termoBusca) ||
        professor?.nome.toLowerCase().includes(termoBusca) ||
        item.diaSemana.toLowerCase().includes(termoBusca) ||
        item.horario.toLowerCase().includes(termoBusca);
      if (!contemBusca) return false;
    }

    if (filtroTurma) {
      const turmaFiltro = turmas.find(t => t.id === filtroTurma);
      if (turmaFiltro?.turmaOriginalId && turmaFiltro.turmaOriginalId) {
        if (item.turmaId !== turmaFiltro.turmaOriginalId && item.turmaId !== filtroTurma) {
          return false;
        }
      } else {
        if (item.turmaId !== filtroTurma) {
          return false;
        }
      }
    }

    if (filtroProfessor && item.professorId !== filtroProfessor) return false;

    if (filtroTurno) {
      const horarioInicio = item.horario.split(' - ')[0];
      const hora = parseInt(horarioInicio.split(':')[0]);
      if (filtroTurno === 'manha' && (hora < 6 || hora >= 12)) return false;
      if (filtroTurno === 'tarde' && (hora < 12 || hora >= 18)) return false;
      if (filtroTurno === 'noite' && (hora < 18 || hora >= 24)) return false;
    }

    if (filtroDia && item.diaSemana !== filtroDia) return false;

    return true;
  });

  const dadosOrdenadosTabela = [...dadosFiltrados].sort((a, b) => {
    const turmaA = turmas.find(t => t.id === a.turmaId)?.nome || '';
    const turmaB = turmas.find(t => t.id === b.turmaId)?.nome || '';
    const materiaA = materias.find(m => m.id === a.materiaId)?.nome || '';
    const materiaB = materias.find(m => m.id === b.materiaId)?.nome || '';
    const professorA = professores.find(p => p.id === a.professorId)?.nome || '';
    const professorB = professores.find(p => p.id === b.professorId)?.nome || '';

    switch (ordenacao) {
      case 'turno':
        const turnoA = getTurnoNome(agendaService.getTurnoFromHorario(a.horario));
        const turnoB = getTurnoNome(agendaService.getTurnoFromHorario(b.horario));
        return turnoA.localeCompare(turnoB);

      case 'dia':
        return diasIndexMap[a.diaSemana] - diasIndexMap[b.diaSemana];

      case 'horario':
        return a.horario.localeCompare(b.horario);

      case 'materia':
        return materiaA.localeCompare(materiaB);

      case 'professor':
        return professorA.localeCompare(professorB);

      case 'turma':
        return turmaA.localeCompare(turmaB);

      default:
        return 0;
    }
  });

  const totalPaginas = Math.ceil(dadosOrdenadosTabela.length / itensPorPagina);
  const dadosPaginados = dadosOrdenadosTabela.slice((currentPage - 1) * itensPorPagina, currentPage * itensPorPagina);

  // Wrapper para passar ao componente
  const getTurnoFromHorarioWrapper = (horario: string) => agendaService.getTurnoFromHorario(horario);

  return (
    <AppLayout>
      <Container className="my-4">

        <div className="border-gray-200 mb-3">
          {/* Header */}
          <div className="mb-4 px-1">
            <div className="d-flex align-items-center gap-2 mb-1">
              <Calendar size={32} color="#2563eb" style={{ minWidth: 32, minHeight: 32 }} />
              <h1
                className="fw-bold mb-0"
                style={{
                  fontSize: '2rem',
                  background: 'linear-gradient(135deg, #1e293b 0%, #2563eb 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                Gestão de Horário de Aulas
              </h1>
            </div>
            <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
              Gerencie aulas, horários e turnos
            </p>
          </div>
        </div>

        {/* Navigation Tabs - apenas para admin */}
        {isAdmin && (
          <div className="container px-0">
            <div className="d-flex py-3">
              <div className="custom-tabs-container w-100">
                <button
                  className={`custom-tab ${activeTab === 'cadastro' ? 'active' : ''}`}
                  onClick={() => setActiveTab('cadastro')}
                  type="button"
                  style={{ flex: 1 }}
                >
                  Cadastro de Agendas
                </button>
                <button
                  className={`custom-tab ${activeTab === 'grade' ? 'active' : ''}`}
                  onClick={() => setActiveTab('grade')}
                  type="button"
                  style={{ flex: 1 }}
                >
                  Grade por Turnos
                </button>
              </div>
            </div>
          </div>
        )}

        {isAdmin && activeTab === 'cadastro' && (
          <AgendaCadastroView
            turmas={turmas}
            materias={materias}
            professores={professores}
            diasSemana={diasSemana}
            dadosPaginados={dadosPaginados}
            filtroBusca={filtroBusca}
            setFiltroBusca={setFiltroBusca}
            filtroTurma={filtroTurma}
            setFiltroTurma={setFiltroTurma}
            filtroProfessor={filtroProfessor}
            setFiltroProfessor={setFiltroProfessor}
            filtroTurno={filtroTurno}
            setFiltroTurno={setFiltroTurno}
            filtroDia={filtroDia}
            setFiltroDia={setFiltroDia}
            ordenacao={ordenacao}
            setOrdenacao={setOrdenacao}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPaginas={totalPaginas}
            limparFiltros={limparFiltros}
            downloadPDF={downloadPDF}
            downloadExcel={downloadExcel}
            handleShow={handleShow}
            handleEditar={handleEditar}
            handleExcluir={handleExcluir}
            formatarNomeProfessor={formatarNomeProfessor}
            getShiftColor={getShiftColor}
            isAdmin={isAdmin}
          />
        )}

        {/* visualizacao de horarios */}
        {(!isAdmin || activeTab === 'grade') && (
          <AgendaGradeView
            turmas={turmas}
            materias={materias}
            professores={professores}
            agendaPorTurma={agendaPorTurma}
            diasSemana={diasSemana}
            filtroVisualizacaoTurma={filtroVisualizacaoTurma}
            setFiltroVisualizacaoTurma={setFiltroVisualizacaoTurma}
            filtroProfessorVisualizacao={filtroProfessorVisualizacao}
            setFiltroProfessorVisualizacao={setFiltroProfessorVisualizacao}
            filtroTurnoVisualizacao={filtroTurnoVisualizacao}
            setFiltroTurnoVisualizacao={setFiltroTurnoVisualizacao}
            filtrarAulasPorProfessor={filtrarAulasPorProfessor}
            obterDadosFiltradosParaGrade={obterDadosFiltradosParaGrade}
            getTurnoFromHorario={getTurnoFromHorarioWrapper}
            getTurnoNome={getTurnoNome}
            getDayColor={getDayColor}
            formatarNomeProfessor={formatarNomeProfessor}
            toggleDayExpansion={toggleDayExpansion}
            isDayExpanded={isDayExpanded}
            handleEditar={handleEditar}
            setItemToDelete={setItemToDelete}
            setShowDeleteModal={setShowDeleteModal}
            setDiaSemana={setDiaSemana}
            setTurmaId={setTurmaId}
            handleShow={handleShow}
            isAdmin={isAdmin}
          />
        )}

        <Modal show={showModal} onHide={handleClose} centered>
          <Modal.Header closeButton style={{ borderBottom: 'none' }}>
            <div>
              <Modal.Title>{editId ? 'Editar Aula' : 'Adicionar Nova Aula'}</Modal.Title>
              {!editId && (
                <p className="text-muted mb-0 mt-1" style={{ fontSize: '0.8rem' }}>
                  Preencha as informações para criar uma nova aula.
                </p>
              )}
            </div>
          </Modal.Header>
          <Modal.Body className='border-top-0 pb-0'>
            <Form>

              <Form.Group className="mb-3">
                <Form.Label>Professor *</Form.Label>
                <Form.Select value={professorId} onChange={e => setProfessorId(e.target.value)}>
                  <option value="">Selecione o professor</option>
                  {[...professores]
                    .filter(p => p.status !== 'Inativo')
                    .sort((a, b) => a.nome.localeCompare(b.nome))
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Turma *</Form.Label>
                <Form.Select
                  value={turmaId}
                  onChange={e => setTurmaId(e.target.value)}
                  disabled={!professorId}
                  style={{ maxHeight: 200, overflowY: 'auto' }}
                >
                  <option value="">Selecione a turma</option>
                  {[...turmasFiltradas].sort((a, b) => a.nome.localeCompare(b.nome)).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Turno *</Form.Label>
                <Form.Select value={turno} onChange={e => setTurno(e.target.value)}>
                  <option value="">Selecione o turno</option>
                  <option value="manha">Manhã</option>
                  <option value="tarde">Tarde</option>
                  <option value="noite">Noite</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Dia da Semana *</Form.Label>
                <Form.Select value={diaSemana} onChange={e => setDiaSemana(e.target.value)}>
                  <option value="">Selecione o dia</option>
                  {diasSemana.map(d => <option key={d} value={d}>{d}</option>)}
                </Form.Select>
              </Form.Group>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Horário Início *</Form.Label>
                    <Form.Control type="time" value={inicio} onChange={e => setInicio(e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Horário Fim *</Form.Label>
                    <Form.Control type="time" value={fim} onChange={e => setFim(e.target.value)} />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Disciplina *</Form.Label>
                <Form.Select value={materiaId} onChange={e => setMateriaId(e.target.value)} style={{ maxHeight: 200, overflowY: 'auto' }}>
                  <option value="">Selecione a disciplina</option>
                  {[...materias].sort((a, b) => a.nome.localeCompare(b.nome)).map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer className='border-top-0'>
            <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button variant="primary" onClick={handleSalvar}>Salvar</Button>
          </Modal.Footer>
        </Modal>

        <Modal show={showDeleteModal} onHide={cancelarExclusao} centered>
          <Modal.Header closeButton style={{ borderBottom: 'none' }}>
            <Modal.Title className="text-danger">Confirmar Exclusão</Modal.Title>
          </Modal.Header>
          <Modal.Body className='border-top-0'>
            {itemToDelete && (
              <div>
                <p className="mb-3">
                  Tem certeza que deseja excluir a aula:
                </p>
                <div className="bg-light p-3 rounded mb-3">
                  <p className="mb-2">
                    <strong>Professor:</strong> {professores.find(p => p.id === itemToDelete.professorId)?.nome || '---'}
                  </p>
                  <p className="mb-2">
                    <strong>Disciplina:</strong> {materias.find(m => m.id === itemToDelete.materiaId)?.nome || '-'}
                  </p>
                  <p className="mb-2">
                    <strong>Turma:</strong> {turmas.find(t => t.id === itemToDelete.turmaId)?.nome || '-'}
                  </p>
                  <p className="mb-2">
                    <strong>Dia:</strong> {itemToDelete.diaSemana}
                  </p>
                  <p className="mb-0">
                    <strong>Horário:</strong> {itemToDelete.horario}
                  </p>
                </div>
                <p className="text-muted small mb-0">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className='border-top-0'>
            <Button variant="secondary" onClick={cancelarExclusao} className="d-flex align-items-center gap-2">
              <X size={16} />
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarExclusao} className="d-flex align-items-center gap-2">
              <Trash2 size={16} />
              Excluir
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </AppLayout>
  );
}
