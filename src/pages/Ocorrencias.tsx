import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, Badge, Table, Spinner, Dropdown } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useAnoLetivoAtual } from '../hooks/useAnoLetivoAtual';
import AppLayout from '../components/layout/AppLayout';
import { toast } from 'react-toastify';
import {
  Plus,
  AlertTriangle,
  FileText,
  Calendar,
  User,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Download,
} from 'lucide-react';
import { FaCircleExclamation } from 'react-icons/fa6';
import Paginacao from '../components/common/Paginacao';
import { Ocorrencia } from '../models/Ocorrencia';
import { Aluno } from '../models/Aluno';
import { Turma } from '../models/Turma';
import { OcorrenciaService } from '../services/data/OcorrenciaService';
import { FirebaseOcorrenciaRepository } from '../repositories/ocorrencia/FirebaseOcorrenciaRepository';
import { FirebaseAlunoRepository } from '../repositories/aluno/FirebaseAlunoRepository';
import { turmaService } from '../services/data/TurmaService';
import { ProfessorMateriaService } from '../services/data/ProfessorMateriaService';
import { FirebaseProfessorMateriaRepository } from '../repositories/professor_materia/FirebaseProfessorMateriaRepository';


const ocorrenciaRepository = new FirebaseOcorrenciaRepository();
const ocorrenciaService = new OcorrenciaService(ocorrenciaRepository);
const alunoRepository = new FirebaseAlunoRepository();
const professorMateriaRepository = new FirebaseProfessorMateriaRepository();
const professorMateriaService = new ProfessorMateriaService(professorMateriaRepository);

export default function Ocorrencias() {
  const authContext = useAuth();
  const userData = authContext?.userData;
  const { anoLetivo } = useAnoLetivoAtual();

  // Verificar se o usuário tem acesso à página
  const temAcesso = userData?.tipo === 'administradores' || userData?.tipo === 'professores';

  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingOcorrencia, setEditingOcorrencia] = useState<Ocorrencia | null>(null);
  const [selectedOcorrencia, setSelectedOcorrencia] = useState<Ocorrencia | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('');
  // Tipos disponíveis (padrão + personalizados)
  const tiposParaFiltro = ocorrenciaService.obterTodosOsTipos(ocorrencias);
  // Filtro de aluno com ocorrência e turma
  const [filtroAluno, setFiltroAluno] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');
  // Campo de busca livre
  const [searchQuery, setSearchQuery] = useState('');

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;

  // Form data
  const [formData, setFormData] = useState({
    tipo: 'disciplinar' as string,
    tipoPersonalizado: '',
    gravidade: 'media' as 'baixa' | 'media' | 'alta' | 'critica',
    status: 'aberta' as 'aberta' | 'em_analise' | 'resolvida' | 'arquivada',
    alunoId: '',
    turmaId: '',
    observacoes: '',
    medidas: ''
  });

  useEffect(() => {
    carregarDados();
  }, [anoLetivo]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      await Promise.all([
        carregarOcorrencias(),
        carregarAlunos(),
        carregarTurmas()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const carregarOcorrencias = async () => {
    try {
      const dados = await ocorrenciaService.listar();
      setOcorrencias(dados);
    } catch (error) {
      console.error('Erro ao carregar ocorrências:', error);
      setOcorrencias([]);
    }
  };

  const carregarAlunos = async () => {
    try {
      const dados = await alunoRepository.findAll();
      setAlunos(dados);
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
      setAlunos([]);
    }
  };


  const carregarTurmas = async () => {
    try {
      let listaTurmas: Turma[] = [];
      if (userData?.tipo === 'administradores') {
        listaTurmas = await turmaService.listarPorAnoLetivo(anoLetivo.toString());
      } else if (userData?.tipo === 'professores') {
        if (!userData?.email) {
          setTurmas([]);
          return;
        }
        // Buscar professor pelo email
        const professorService = new (await import('../services/data/ProfessorService')).ProfessorService(
          new (await import('../repositories/professor/FirebaseProfessorRepository')).FirebaseProfessorRepository()
        );
        const allProfessores = await professorService.listar();
        const professorAtual = allProfessores.find((p: any) => p.email === userData.email);
        if (!professorAtual) {
          console.error('Professor não encontrado com email:', userData.email);
          setTurmas([]);
          return;
        }
        const vincList = await professorMateriaService.listarPorProfessor(professorAtual.id);
        const turmaIds = [...new Set(vincList.map((v: any) => v.turmaId))];
        const todasTurmas = await turmaService.listarPorAnoLetivo(anoLetivo.toString());
        listaTurmas = todasTurmas.filter((t: Turma) => turmaIds.includes(t.id));
      } else {
        listaTurmas = [];
      }
      setTurmas(listaTurmas.sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (error) {
      console.error('Erro ao carregar turmas:', error);
      setTurmas([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar formulário usando service
    const validacao = ocorrenciaService.validarFormulario(formData);
    if (!validacao.valido) {
      toast.error(validacao.erro!);
      return;
    }

    try {
      const aluno = alunos.find(a => a.id === formData.alunoId);
      const turma = turmas.find(t => t.id === (formData.turmaId || aluno?.turmaId));
      const isEdit = Boolean(editingOcorrencia);

      // Preparar dados usando service
      const ocorrenciaData = ocorrenciaService.prepararDadosOcorrencia(
        formData,
        aluno,
        turma,
        userData || undefined,
        isEdit
      );

      if (editingOcorrencia) {
        await ocorrenciaService.atualizar(editingOcorrencia.id, ocorrenciaData);
        toast.success('Ocorrência atualizada com sucesso!');
      } else {
        await ocorrenciaService.criar(ocorrenciaData);
        toast.success('Ocorrência registrada com sucesso!');
      }

      setShowModal(false);
      resetForm();
      await carregarOcorrencias();
    } catch (error) {
      toast.error(`Erro ao salvar ocorrência: ${(error as any)?.message || 'Erro desconhecido'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta ocorrência?')) {
      try {
        await ocorrenciaService.excluir(id);
        toast.success('Ocorrência excluída com sucesso!');
        carregarOcorrencias();
      } catch (error) {
        toast.error('Erro ao excluir ocorrência');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      tipo: 'disciplinar',
      tipoPersonalizado: '',
      gravidade: 'media',
      status: 'aberta',
      alunoId: '',
      turmaId: '',
      observacoes: '',
      medidas: ''
    });
    setEditingOcorrencia(null);
  };

  const openEditModal = (ocorrencia: Ocorrencia) => {
    // Verificar se é tipo padrão usando service
    const isTipoPadrao = ocorrenciaService.isTipoPadrao(ocorrencia.tipo);
    setFormData({
      tipo: isTipoPadrao ? ocorrencia.tipo : 'outro',
      tipoPersonalizado: isTipoPadrao ? '' : ocorrencia.tipo,
      gravidade: ocorrencia.gravidade,
      status: ocorrencia.status,
      alunoId: ocorrencia.alunoId,
      turmaId: ocorrencia.turmaId,
      observacoes: ocorrencia.observacoes || '',
      medidas: ocorrencia.medidas || ''
    });
    setEditingOcorrencia(ocorrencia);
    setShowModal(true);
  };

  const openDetailModal = (ocorrencia: Ocorrencia) => {
    setSelectedOcorrencia(ocorrencia);
    setShowDetailModal(true);
  };

  // Filtrar ocorrências usando service
  const ocorrenciasFiltradas = ocorrenciaService.filtrar(
    ocorrencias,
    filtroTipo,
    filtroTurma,
    filtroAluno,
    searchQuery
  );

  // Paginação usando service
  const { ocorrenciasPaginadas, totalPaginas } = ocorrenciaService.paginarOcorrencias(
    ocorrenciasFiltradas,
    paginaAtual,
    itensPorPagina
  );

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'disciplinar': return 'danger';
      case 'academica': return 'warning';
      case 'comportamental': return 'info';
      default: return 'secondary';
    }
  };



  // Estatísticas usando service
  const stats = ocorrenciaService.calcularEstatisticas(ocorrencias);

  // Exportação usando service
  const downloadPDF = () => {
    const ocorrenciasParaExportar = ocorrenciaService.prepararParaExportacao(
      ocorrencias,
      filtroTipo,
      filtroTurma,
      filtroAluno
    );
    ocorrenciaService.exportarPDF(ocorrenciasParaExportar);
  };

  const downloadExcel = () => {
    const ocorrenciasParaExportar = ocorrenciaService.prepararParaExportacao(
      ocorrencias,
      filtroTipo,
      filtroTurma,
      filtroAluno
    );
    ocorrenciaService.exportarExcel(ocorrenciasParaExportar);
  };

  const handleExport = (tipo: 'pdf' | 'excel') => {
    setShowExportModal(false);
    if (tipo === 'pdf') downloadPDF();
    else downloadExcel();
  };

  if (loading) {
    return (
      <AppLayout>
        <Container className="d-flex justify-content-center align-items-center vh-75">
          <Spinner animation="border" />
        </Container>
      </AppLayout>
    );
  }

  // Verificar se o usuário tem acesso à página
  if (!temAcesso) {
    return (
      <AppLayout>
        <Container className="my-4">
          <div className="text-center py-5">
            <div className="mb-4">
              <AlertTriangle size={64} color="#dc3545" />
            </div>
            <h3 className="text-danger mb-3">Acesso Restrito</h3>
            <p className="text-muted mb-4">
              Esta página é restrita apenas para <strong>Professores</strong> e <strong>Administradores</strong>.
            </p>
            <p className="text-muted">
              Você está logado como: <strong>{userData?.tipo ? userData.tipo.charAt(0).toUpperCase() + userData.tipo.slice(1) : 'Usuário'}</strong>
            </p>
          </div>
        </Container>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Container fluid>
        {/* Header e Controles */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2 mb-1">
              <AlertTriangle size={32} color="#2563eb" style={{ minWidth: 32, minHeight: 32 }} />
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
                Gestão de Ocorrências
              </h1>
            </div>
            <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
              Registre e acompanhe ocorrências disciplinares
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="d-none d-md-flex align-items-center gap-2 flex-shrink-0"
            style={{
              minWidth: 'auto',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={18} />
            <span>Nova Ocorrência</span>
          </Button>
        </div>

        {/* Cards de Estatísticas - Novo padrão */}
        <div className="row mb-3 g-3">
          {/* Card Total de Ocorrências */}
          <div className="col-md-6">
            <Card className="shadow-sm card-sm border-left-primary mb-1">
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                <span className="fw-bold" style={{ fontSize: '1.1rem', color: '#3b4861' }}>Total de Ocorrências</span>
                <FileText size={20} className="text-primary" />
              </div>
              <Card.Body className="py-3">
                <h3 className="mb-0 fw-bold" style={{ color: '#2563eb' }}>{stats.total}</h3>
              </Card.Body>
            </Card>
          </div>
          {/* Card Feitas este mês */}
          <div className="col-md-6 mt-mobile-0">
            <Card className="shadow-sm card-sm border-left-info mb-1" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                <span className="fw-bold" style={{ fontSize: '1.1rem', color: '#3b4861' }}>Feitas este mês</span>
                <CheckCircle size={20} style={{ color: '#10b981' }} />
              </div>
              <Card.Body className="py-3">
                <h3 className="mb-0 fw-bold" style={{ color: '#10b981' }}>{stats.feitasEsteMes}</h3>
              </Card.Body>
            </Card>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-3">
          <Card.Body>
            <Row>
              <Col md={3} className=" mb-md-0">
                <Form.Control
                  type="text"
                  placeholder="Buscar ocorrências por aluno, tipo, turma ou descrição"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </Col>
              <Col md={3} className="mb-md-0">
                <Form.Select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                >
                  <option value="">Todos os tipos</option>
                  {tiposParaFiltro.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={3} className="mb-md-0">
                <Form.Select
                  value={filtroTurma}
                  onChange={(e) => setFiltroTurma(e.target.value)}
                >
                  <option value="">Todas as turmas</option>
                  {turmas.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(turma => (
                    <option key={turma.id} value={turma.id}>
                      {turma.nome}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Select
                  value={filtroAluno}
                  onChange={(e) => setFiltroAluno(e.target.value)}
                  disabled={!filtroTurma}
                >
                  <option value="">Todos os alunos</option>
                  {ocorrenciaService.obterAlunosComOcorrencias(
                    ocorrencias,
                    alunos,
                    filtroTurma || undefined
                  ).map(aluno => (
                    <option key={aluno.id} value={aluno.id}>{aluno.nome}</option>
                  ))}
                </Form.Select>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Botão Nova Ocorrência - Mobile */}
        <div className="w-100 mb-3 d-md-none">
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="w-100 d-flex align-items-center justify-content-center gap-2"
          >
            <Plus size={20} />
            Nova Ocorrência
          </Button>
        </div>

        {/* Dropdown de Exportar - Desktop */}
        {ocorrenciasPaginadas.length > 0 && (
          <Row className="mb-3 d-none d-md-flex">
            <Col md={6}>
              <Dropdown className="w-100">
                <Dropdown.Toggle
                  className="w-100 d-flex align-items-center justify-content-center gap-2"
                  style={{ border: '1px solid #e1e7ef', backgroundColor: 'white', color: 'black', fontWeight: 500 }}
                  variant="light"
                >
                  <Download size={18} />
                  Exportar Ocorrências
                </Dropdown.Toggle>
                <Dropdown.Menu className="w-100">
                  <Dropdown.Item onClick={downloadPDF}>
                    Exportar PDF
                  </Dropdown.Item>
                  <Dropdown.Item onClick={downloadExcel}>
                    Exportar Excel
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Col>
          </Row>
        )}

        {/* Lista de Ocorrências - Desktop styled like Usuarios */}
        <div className="ocorrencias-list-desktop d-none d-md-block">
          <Card className="mb-1">
            <Card.Body>
              {ocorrenciasPaginadas.length > 0 && (
                <div className="d-flex align-items-center justify-content-between px-2 mb-2">
                  <h3 className="mb-0">Lista de Ocorrências</h3>
                </div>
              )}
              <div className="ocorrencias-table-desktop w-100" style={{ overflowX: 'auto' }}>
                {ocorrenciasPaginadas.length > 0 ? (
                  <Table hover className="w-100 text-center mb-0" style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                    <thead className="thead-sticky">
                      <tr>
                        <th className='text-muted text-start'>Aluno</th>
                        <th className='text-muted text-center'>Ocorrência</th>
                        <th className='text-muted text-center'>Turma</th>
                        <th className='text-muted text-center'>Data</th>
                        <th className='text-muted text-center'>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ocorrenciasPaginadas.map((ocorrencia) => {
                        const isHovered = hoveredRow === ocorrencia.id;
                        const rowBg = isHovered ? '#f1f5f9' : '#fff';
                        return (
                          <tr
                            key={ocorrencia.id}
                            className='align-middle linha-agenda'
                            onMouseEnter={() => setHoveredRow(ocorrencia.id)}
                            onMouseLeave={() => setHoveredRow(null)}
                            style={{ overflow: 'visible', border: 'transparent' }}
                          >
                            <td className="text-start" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem', background: rowBg, borderTopLeftRadius: 8, borderBottomLeftRadius: 8, transition: 'all .15s ease' }}>
                              <div className="d-flex align-items-center">
                                <div className="user-icon-circle-frequencia">
                                  <User size={20} color="#fff" />
                                </div>
                                <strong
                                  className="ms-2"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => openDetailModal(ocorrencia)}
                                >
                                  {ocorrencia.alunoNome}
                                </strong>
                              </div>
                            </td>
                            <td className="text-center text-muted" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem', background: rowBg, transition: 'all .15s ease' }}>{ocorrenciaService.obterLabelTipo(ocorrencia.tipo)}</td>
                            <td className="text-center" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem', background: rowBg, transition: 'all .15s ease' }}>
                              <span style={{
                                background: '#e0edff',
                                color: '#2563eb',
                                fontWeight: 700,
                                border: 'none',
                                borderRadius: '12px',
                                padding: '0.22rem 0.5rem',
                                fontSize: '0.71rem',
                                letterSpacing: '0.1px',
                                lineHeight: 1.1,
                                marginRight: 4,
                                display: 'inline-block'
                              }}>{ocorrencia.turmaNome}</span>
                            </td>
                            <td className="text-center" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem', background: rowBg, transition: 'all .15s ease' }}>{new Date(ocorrencia.dataOcorrencia).toLocaleDateString('pt-BR')}</td>
                            <td className="text-center" style={{ position: 'relative', paddingTop: '0.75rem', paddingBottom: '0.75rem', background: rowBg, borderTopRightRadius: 8, borderBottomRightRadius: 8, transition: 'all .15s ease' }}>
                              <Dropdown align="end">
                                <Dropdown.Toggle
                                  variant="light"
                                  size="sm"
                                  className="dropdown-toggle-no-caret"
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    boxShadow: 'none'
                                  }}
                                >
                                  ...
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                  <Dropdown.Item onClick={() => openDetailModal(ocorrencia)} className="d-flex align-items-center gap-2">
                                    <Eye size={14} /> Detalhes
                                  </Dropdown.Item>
                                  <Dropdown.Item onClick={() => openEditModal(ocorrencia)} className="d-flex align-items-center gap-2 text-primary">
                                    <Edit size={14} /> Editar
                                  </Dropdown.Item>
                                  <Dropdown.Item onClick={() => handleDelete(ocorrencia.id)} className="d-flex align-items-center gap-2 text-danger">
                                    <Trash2 size={14} /> Excluir
                                  </Dropdown.Item>
                                </Dropdown.Menu>
                              </Dropdown>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                ) : (
                  <div className="usuarios-empty-state text-center py-5" style={{ minHeight: 200, color: '#212529bf' }}>
                    <div className="usuarios-empty-icon mb-3">
                      <FaCircleExclamation size={34} />
                    </div>
                    <h5 className="usuarios-empty-title">Nenhuma ocorrência encontrada</h5>
                    <p className="usuarios-empty-text">Tente ajustar os filtros ou adicione uma nova ocorrência.</p>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </div>

        {/* Dropdown de Exportar - Mobile */}
        {ocorrenciasPaginadas.length > 0 && (
          <Row className="mb-3 d-md-none">
            <Col>
              <Dropdown className="w-100">
                <Dropdown.Toggle
                  className="w-100 d-flex align-items-center justify-content-center gap-2"
                  style={{ border: '1px solid #e1e7ef', backgroundColor: 'white', color: 'black', fontWeight: 500 }}
                  variant="light"
                >
                  <Download size={18} />
                  Exportar Ocorrências
                </Dropdown.Toggle>
                <Dropdown.Menu className="w-100">
                  <Dropdown.Item onClick={downloadPDF}>
                    Exportar PDF
                  </Dropdown.Item>
                  <Dropdown.Item onClick={downloadExcel}>
                    Exportar Excel
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Col>
          </Row>
        )}

        {/* Versão Mobile - estrutura seguindo o padrão das outras páginas */}
        <div className="ocorrencias-mobile-cards d-md-none">
          <Card className="shadow-sm">
            <Card.Body>
              {ocorrenciasPaginadas.length > 0 && (
                <div className="ocorrencias-header-mobile mb-3">
                  <h3 className="mb-0">Lista de Ocorrências</h3>
                </div>
              )}

              {ocorrenciasPaginadas.length > 0 ? (
                <div className="ocorrencias-grid-mobile">
                  {ocorrenciasPaginadas.map(ocorrencia => (
                    <div key={ocorrencia.id} className="ocorrencias-card-mobile">
                      <div className="ocorrencias-card-header">
                        <h6 className="ocorrencias-card-title">
                          {ocorrenciaService.obterLabelTipo(ocorrencia.tipo)}
                        </h6>
                        <span className="ocorrencias-card-turma-badge">
                          {ocorrencia.turmaNome}
                        </span>
                      </div>

                      <div className="ocorrencias-card-body">
                        <div className="ocorrencias-aluno-info">
                          <div className="user-icon-circle-frequencia">
                            <User size={20} color="#fff" />
                          </div>
                          <span
                            className="ocorrencias-aluno-nome"
                            onClick={() => openDetailModal(ocorrencia)}
                          >
                            {ocorrencia.alunoNome}
                          </span>
                        </div>

                        <div className="ocorrencias-descricao">
                          {ocorrencia.descricao.length > 100
                            ? `${ocorrencia.descricao.substring(0, 100)}...`
                            : ocorrencia.descricao
                          }
                        </div>

                        <div className="ocorrencias-data-info">
                          <Calendar size={14} />
                          {new Date(ocorrencia.dataOcorrencia).toLocaleDateString('pt-BR')}
                        </div>
                      </div>

                      <div className="ocorrencias-card-actions">
                        <button
                          className="ocorrencias-action-btn ocorrencias-detalhes-btn"
                          onClick={() => openDetailModal(ocorrencia)}
                        >
                          <Eye size={16} />
                          Detalhes
                        </button>
                        <button
                          className="ocorrencias-action-btn ocorrencias-edit-btn"
                          onClick={() => openEditModal(ocorrencia)}
                        >
                          <Edit size={16} />
                          Editar
                        </button>
                        <button
                          className="ocorrencias-delete-btn"
                          onClick={() => handleDelete(ocorrencia.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ocorrencias-empty-state">
                  <div className="ocorrencias-empty-icon">
                    <FaCircleExclamation size={48} />
                  </div>
                  <h5 className="ocorrencias-empty-title">Nenhuma ocorrência encontrada</h5>
                  <p className="ocorrencias-empty-text">Comece adicionando sua primeira ocorrência.</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="d-flex justify-content-center mt-4">
            <Paginacao
              paginaAtual={paginaAtual}
              totalPaginas={totalPaginas}
              aoMudarPagina={setPaginaAtual}
            />
          </div>
        )}

        {/* Modal de Cadastro/Edição */}
        <Modal show={showModal} onHide={() => setShowModal(false)} dialogClassName="modal-narrow">
          <Modal.Header closeButton style={{ borderBottom: '0' }}>
            <Modal.Title>
              {editingOcorrencia ? 'Editar Ocorrência' : 'Nova Ocorrência'}
            </Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmit}>
            <Modal.Body>
              <Row>
                <Col md={12} className="mb-3">
                  <Form.Label className="fw-bold">Tipo de Ocorrência</Form.Label>
                  <Form.Select
                    value={formData.tipo}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        tipo: e.target.value,
                        tipoPersonalizado: e.target.value === 'outro' ? (formData.tipoPersonalizado || '') : ''
                      });
                    }}
                    required
                  >
                    <option value="">Selecione o tipo de ocorrência</option>
                    <option value="nao_fez_atividade">Não Fez a atividade de casa/classe</option>
                    <option value="esqueceu_material">Esqueceu o material didático</option>
                    <option value="indisciplina_intervalo">Indisciplinado no intervalo</option>
                    <option value="indisciplina_sala">Indisciplinado na sala de aula</option>
                    <option value="aluno_atrasado">Aluno atrasado</option>
                    <option value="comportamento_agressivo">Comportamento agressivo</option>
                    <option value="outro">Outro</option>
                  </Form.Select>
                  {formData.tipo === 'outro' && (
                    <Form.Control
                      className="mt-2"
                      type="text"
                      placeholder="Digite o novo tipo de ocorrência"
                      value={formData.tipoPersonalizado || ''}
                      onChange={e => setFormData({ ...formData, tipoPersonalizado: e.target.value })}
                      required
                    />
                  )}
                </Col>
                <Col md={12} className="mb-3">
                  <Form.Label className="fw-bold">Turma</Form.Label>
                  <Form.Select
                    value={formData.turmaId}
                    onChange={(e) => {
                      const turmaId = e.target.value;
                      setFormData({
                        ...formData,
                        turmaId,
                        alunoId: '' // Limpa aluno ao trocar turma
                      });
                    }}
                    required
                  >
                    <option value="">Selecione uma turma</option>
                    {turmas.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(turma => (
                      <option key={turma.id} value={turma.id}>{turma.nome}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={12} className="mb-3">
                  <Form.Label className="fw-bold">Aluno</Form.Label>
                  <Form.Select
                    value={formData.alunoId}
                    onChange={(e) => setFormData({ ...formData, alunoId: e.target.value })}
                    required
                    disabled={!formData.turmaId}
                  >
                    <option value="">Selecione um aluno</option>
                    {alunos
                      .filter(a => a.turmaId === formData.turmaId)
                      .sort((a, b) => a.nome.localeCompare(b.nome))
                      .map(aluno => (
                        <option key={aluno.id} value={aluno.id}>{aluno.nome}</option>
                      ))}
                  </Form.Select>
                </Col>
                <Col md={12} className="mb-3">
                  <Form.Label className="fw-bold">Observação</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  />
                </Col>
              </Row>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit">
                {editingOcorrencia ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Modal de Detalhes */}
        <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Detalhes da Ocorrência</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedOcorrencia && (
              <div>
                <Row className="mb-3">
                  <Col md={12}>
                    <h5 className="fw-bold">{selectedOcorrencia.titulo}</h5>
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col md={6}>
                    <strong>Aluno:</strong> {selectedOcorrencia.alunoNome}
                  </Col>
                  <Col md={6}>
                    <strong>Turma:</strong>{' '}
                    <span style={{
                      background: '#e0edff',
                      color: '#2563eb',
                      fontWeight: 700,
                      border: 'none',
                      borderRadius: '12px',
                      padding: '0.22rem 0.5rem',
                      fontSize: '0.71rem',
                      letterSpacing: '0.1px',
                      lineHeight: 1.1,
                      marginRight: 4,
                      display: 'inline-block'
                    }}>{selectedOcorrencia.turmaNome}</span>
                  </Col>
                </Row>
                {selectedOcorrencia && selectedOcorrencia.alunoId && (
                  <Row>
                    <Col md={6}>
                      <div style={{ fontWeight: 500 }}>
                        <strong>Total de ocorrências no ano:</strong> {
                          ocorrenciaService.contarOcorrenciasAlunoNoAno(ocorrencias, selectedOcorrencia.alunoId)
                        }
                      </div>
                    </Col>
                  </Row>
                )}
                <Row className="mb-3">
                </Row>

                <Row className="mb-3">
                  <Col md={6}>
                    <strong>Tipo:</strong>{' '}
                    <Badge bg={getTipoColor(selectedOcorrencia.tipo)}>
                      {ocorrenciaService.obterLabelTipo(selectedOcorrencia.tipo)}
                    </Badge>
                  </Col>
                  <Col md={6}>
                    <strong>Data da Ocorrência:</strong> {new Date(selectedOcorrencia.dataOcorrencia).toLocaleDateString('pt-BR')}
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col md={12}>
                    <strong>Registrado por:</strong> {selectedOcorrencia.professorNome}
                    {(() => {
                      // Tenta encontrar o usuário pelo id salvo na ocorrência
                      let tipoUsuario = '';
                      if (userData && selectedOcorrencia.professorId === userData.uid && userData.tipo) {
                        tipoUsuario = userData.tipo;
                      } else if (userData && userData.tipo) {
                        tipoUsuario = userData.tipo;
                      } else if (selectedOcorrencia.professorNome?.toLowerCase().includes('prof')) {
                        tipoUsuario = 'Professor';
                      } else {
                        tipoUsuario = 'Usuário';
                      }
                      // Se for administrador, padroniza para 'Administrador'
                      if (tipoUsuario.toLowerCase().includes('admin')) {
                        tipoUsuario = 'Administrador';
                      } else {
                        tipoUsuario = tipoUsuario.charAt(0).toUpperCase() + tipoUsuario.slice(1);
                      }
                      return (
                        <span className="ms-2 text-muted" style={{ fontSize: '0.95em', fontWeight: 500 }}>
                          {tipoUsuario}
                        </span>
                      );
                    })()}
                  </Col>
                </Row>

                {selectedOcorrencia.observacoes && (
                  <Row className="mb-3">
                    <Col md={12}>
                      <strong>Observações:</strong>
                      <p className="mt-2">{selectedOcorrencia.observacoes}</p>
                    </Col>
                  </Row>
                )}

                {selectedOcorrencia.medidas && (
                  <Row className="mb-3">
                    <Col md={12}>
                      <strong>Medidas Tomadas:</strong>
                      <p className="mt-2">{selectedOcorrencia.medidas}</p>
                    </Col>
                  </Row>
                )}

                <Row>
                  <Col md={6}>
                    <small className="text-muted">
                      <strong>Criado em:</strong> {new Date(selectedOcorrencia.dataCriacao).toLocaleString('pt-BR')}
                    </small>
                  </Col>
                  {selectedOcorrencia.dataResolucao && (
                    <Col md={6}>
                      <small className="text-muted">
                        <strong>Resolvido em:</strong> {new Date(selectedOcorrencia.dataResolucao).toLocaleString('pt-BR')}
                      </small>
                    </Col>
                  )}
                </Row>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
              Fechar
            </Button>
            {selectedOcorrencia && (
              <Button
                variant="primary"
                onClick={() => {
                  setShowDetailModal(false);
                  openEditModal(selectedOcorrencia);
                }}
              >
                Editar
              </Button>
            )}
          </Modal.Footer>
        </Modal>

        {/* Modal de Exportação */}
        <Modal show={showExportModal} onHide={() => setShowExportModal(false)} centered>
          <Modal.Header closeButton style={{ borderBottom: '0' }}>
            <Modal.Title>Escolha o formato de exportação</Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ borderTop: '0' }}>
            <div className="d-flex align-items-center justify-content-between gap-3">
              <span className="mb-0" style={{ fontSize: 16 }}>Como você gostaria de exportar a lista de ocorrências?</span>
              <div className="d-flex gap-3">
                <Button
                  variant="outline-primary"
                  onClick={() => handleExport('pdf')}
                  className="d-flex align-items-center justify-content-center"
                >
                  PDF
                </Button>
                <Button
                  variant="outline-success"
                  onClick={() => handleExport('excel')}
                  className="d-flex align-items-center justify-content-center"
                >
                  Excel
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal>
      </Container>
    </AppLayout>
  );
}
