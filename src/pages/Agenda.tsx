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
import { ProfessorMateriaService } from '../services/data/ProfessorMateriaService';
import { AgendaService } from '../services/data/AgendaService';
import { FirebaseMateriaRepository } from '../repositories/materia/FirebaseMateriaRepository';
import { FirebaseProfessorRepository } from '../repositories/professor/FirebaseProfessorRepository';
import { FirebaseProfessorMateriaRepository } from '../repositories/professor_materia/FirebaseProfessorMateriaRepository';
import { FirebaseAgendaRepository } from '../repositories/agenda/FirebaseAgendaRepository';
import type { Turma } from '../models/Turma';
import type { ProfessorMateria } from '../models/ProfessorMateria';
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

const professorRepository = new FirebaseProfessorRepository();
const professorService = new ProfessorService(professorRepository);

const professorMateriaRepository = new FirebaseProfessorMateriaRepository();
const professorMateriaService = new ProfessorMateriaService(professorMateriaRepository);

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
  const [vinculos, setVinculos] = useState<ProfessorMateria[]>([]);

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

  const [ordenacao, setOrdenacao] = useState<'turno' | 'dia' | 'horario' | 'materia' | 'professor' | 'turma'>('turno');

  const [expandedDays, setExpandedDays] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        setLoading(true);

        if (isAdmin) {
          const [allProfessores, allTurmas, allMaterias, allVinculos] = await Promise.all([
            professorService.listar(),
            turmaService.listarComVirtualizacao(anoLetivo.toString()),
            materiaService.listar(),
            professorMateriaService.listar()
          ]);

          // Filtrar vínculos apenas de turmas do ano atual
          const turmaIds = new Set(allTurmas.map((t: Turma) => t.id));
          const vinculosFiltrados = allVinculos.filter((v: ProfessorMateria) => turmaIds.has(v.turmaId));

          setProfessores(allProfessores);
          setVinculos(vinculosFiltrados);
          setTurmas(allTurmas);
          setMaterias(allMaterias);
        } else if (userData?.uid) {
          const [allProfessores, professorVinculos] = await Promise.all([
            professorService.listar(),
            professorMateriaService.listarPorProfessor(userData.uid)
          ]);

          // Extrair IDs únicos
          const turmaIds = [...new Set(professorVinculos.map((v: ProfessorMateria) => v.turmaId))];
          const materiaIds = [...new Set(professorVinculos.map((v: ProfessorMateria) => v.materiaId))];

          // Buscar turmas do ano letivo do professor
          const allTurmas = await turmaService.listarPorAnoLetivo(anoLetivo.toString());
          const turmasProfessor = allTurmas.filter((t: Turma) => turmaIds.includes(t.id));

          // Buscar matérias do professor
          const allMaterias = await materiaService.listar();
          const materiasProfessor = allMaterias.filter((m: Materia) => materiaIds.includes(m.id));

          setProfessores(allProfessores);
          setVinculos(professorVinculos);
          setTurmas(turmasProfessor);
          setMaterias(materiasProfessor);
        }
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();

    if (!loading && turmas.length > 0) fetchAgendaPorTurma();
    setCurrentPage(1);
  }, [userData, anoLetivo, isAdmin, turmas, loading, filtroBusca, filtroTurma, filtroProfessor, filtroTurno, filtroDia]);

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
    const horario = `${inicio} - ${fim}`;
    const payload = { turmaId, diaSemana, horario, materiaId, turno, professorId };
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

    const vinculo = vinculos.find(v => v.materiaId === item.materiaId && v.turmaId === item.turmaId);
    if (vinculo) {
      setProfessorId(vinculo.professorId);
    }

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
      vinculos,
      diasSemana
    });
  };

  const downloadExcel = () => {
    exportarAgendaExcel({
      dadosFiltrados,
      turmas,
      materias,
      professores,
      vinculos
    });
  };

  const filtrarAulasPorProfessor = (aulas: Agenda[]) => {
    return agendaService.filtrarAulasPorProfessor(aulas, filtroProfessorVisualizacao, vinculos);
  };

  const filtrarAulasPorTurno = (aulas: Agenda[]) => {
    return agendaService.filtrarAulasPorTurno(aulas, filtroTurnoVisualizacao);
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
        const vinculo = vinculos.find(v => v.materiaId === item.materiaId && v.turmaId === item.turmaId);
        if (vinculo?.professorId !== filtroProfessorVisualizacao) return false;
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
    const vinculo = vinculos.find(v => v.materiaId === item.materiaId && v.turmaId === item.turmaId);
    const professor = professores.find(p => p.id === vinculo?.professorId);

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

    if (filtroProfessor && vinculo?.professorId !== filtroProfessor) return false;

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

    const vinculoA = vinculos.find(v => v.materiaId === a.materiaId && v.turmaId === a.turmaId);
    const vinculoB = vinculos.find(v => v.materiaId === b.materiaId && v.turmaId === b.turmaId);
    const professorA = vinculoA ? professores.find(p => p.id === vinculoA.professorId)?.nome || '' : '';
    const professorB = vinculoB ? professores.find(p => p.id === vinculoB.professorId)?.nome || '' : '';

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
                Gestão de Agenda Escolar
              </h1>
            </div>
            <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
              Gerencie aulas, horários e turnos
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
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

        {activeTab === 'cadastro' && isAdmin && (
          <AgendaCadastroView
            turmas={turmas}
            materias={materias}
            professores={professores}
            vinculos={vinculos}
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
        {activeTab === 'grade' && (
          <AgendaGradeView
            turmas={turmas}
            materias={materias}
            professores={professores}
            vinculos={vinculos}
            agendaPorTurma={agendaPorTurma}
            diasSemana={diasSemana}
            filtroVisualizacaoTurma={filtroVisualizacaoTurma}
            setFiltroVisualizacaoTurma={setFiltroVisualizacaoTurma}
            filtroProfessorVisualizacao={filtroProfessorVisualizacao}
            setFiltroProfessorVisualizacao={setFiltroProfessorVisualizacao}
            filtroTurnoVisualizacao={filtroTurnoVisualizacao}
            setFiltroTurnoVisualizacao={setFiltroTurnoVisualizacao}
            filtrarAulasPorProfessor={filtrarAulasPorProfessor}
            filtrarAulasPorTurno={filtrarAulasPorTurno}
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
                <Form.Select value={materiaId} onChange={e => setMateriaId(e.target.value)}>
                  <option value="">Selecione a disciplina</option>
                  {[...materias].sort((a, b) => a.nome.localeCompare(b.nome)).map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Professor *</Form.Label>
                <Form.Select value={professorId} onChange={e => setProfessorId(e.target.value)}>
                  <option value="">Selecione o professor</option>
                  {[...professores].sort((a, b) => a.nome.localeCompare(b.nome)).map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Turma *</Form.Label>
                <Form.Select value={turmaId} onChange={e => setTurmaId(e.target.value)}>
                  <option value="">Selecione a turma</option>
                  {[...turmas].sort((a, b) => a.nome.localeCompare(b.nome)).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
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
                    <strong>Professor:</strong> {professores.find(p => p.id === vinculos.find(v => v.materiaId === itemToDelete.materiaId && v.turmaId === itemToDelete.turmaId)?.professorId)?.nome || '---'}
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
