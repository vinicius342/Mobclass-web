import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, Badge, Table, Spinner, Dropdown } from 'react-bootstrap';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from '../components/AppLayout';
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
import Paginacao from '../components/Paginacao';

// PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// XLSX
import * as XLSX from 'xlsx';

interface Ocorrencia {
  id: string;
  titulo: string;
  descricao: string;
  tipo: 'disciplinar' | 'academica' | 'comportamental' | 'outros';
  gravidade: 'baixa' | 'media' | 'alta' | 'critica';
  status: 'aberta' | 'em_analise' | 'resolvida' | 'arquivada';
  alunoId: string;
  alunoNome: string;
  turmaId: string;
  turmaNome: string;
  professorId: string;
  professorNome: string;
  dataOcorrencia: string;
  dataCriacao: string;
  dataResolucao?: string;
  observacoes?: string;
  medidas?: string;
}

interface Aluno {
  id: string;
  nome: string;
  turmaId: string;
}

interface Turma {
  id: string;
  nome: string;
  ano: string;
}

export default function Ocorrencias() {
  const authContext = useAuth();
  const userData = authContext?.userData;
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
  // Tipos padrão do sistema
  const tiposPadrao = [
    { value: 'nao_fez_atividade', label: 'Não Fez a atividade de casa/classe' },
    { value: 'esqueceu_material', label: 'Esqueceu o material didático' },
    { value: 'indisciplina_intervalo', label: 'Indisciplinado no intervalo' },
    { value: 'indisciplina_sala', label: 'Indisciplinado na sala de aula' },
    { value: 'aluno_atrasado', label: 'Aluno atrasado' },
    { value: 'comportamento_agressivo', label: 'Comportamento agressivo' }
  ];
  // Tipos personalizados já cadastrados
  const tiposPersonalizados = Array.from(
    new Set(
      ocorrencias
        .map(o => o.tipo)
        .filter(tipo => !tiposPadrao.some(t => t.value === tipo))
    )
  ).map(tipo => ({ value: tipo, label: tipo }));
  const tiposParaFiltro = [...tiposPadrao, ...tiposPersonalizados];
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
  }, []);

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
      const q = query(collection(db, 'ocorrencias'), orderBy('dataCriacao', 'desc'));
      const snapshot = await getDocs(q);
      const dados = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ocorrencia[];
      setOcorrencias(dados);
    } catch (error) {
      setOcorrencias([]); // Define array vazio em caso de erro
    }
  };

  const carregarAlunos = async () => {
    const snapshot = await getDocs(collection(db, 'alunos'));
    const dados = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Aluno[];
    setAlunos(dados);
  };

  const carregarTurmas = async () => {
    const snapshot = await getDocs(collection(db, 'turmas'));
    const dados = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Turma[];
    setTurmas(dados);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.alunoId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (formData.tipo === 'outro' && !formData.tipoPersonalizado) {
      toast.error('Digite o nome do novo tipo de ocorrência');
      return;
    }

    try {
      const aluno = alunos.find(a => a.id === formData.alunoId);
      const turma = turmas.find(t => t.id === (formData.turmaId || aluno?.turmaId));

      // Garante que dataCriacao só é definida na criação
      const isEdit = Boolean(editingOcorrencia);
      const tipoFinal = formData.tipo === 'outro' ? formData.tipoPersonalizado : formData.tipo;
      const dataAtual = new Date().toISOString();
      const ocorrenciaData = {
        titulo: getTipoLabel(tipoFinal),
        descricao: formData.observacoes || `Ocorrência do tipo: ${getTipoLabel(tipoFinal)}`,
        tipo: tipoFinal,
        gravidade: formData.gravidade,
        status: formData.status,
        alunoId: formData.alunoId,
        turmaId: formData.turmaId || aluno?.turmaId || '',
        alunoNome: aluno?.nome || '',
        turmaNome: turma?.nome || '',
        professorId: userData?.uid || '',
        professorNome: userData?.nome || userData?.email || '',
        dataOcorrencia: dataAtual,
        observacoes: formData.observacoes || '',
        medidas: formData.medidas || '',
        ...(isEdit ? {} : { dataCriacao: dataAtual }),
        ...(formData.status === 'resolvida' && { dataResolucao: dataAtual })
      };

      if (editingOcorrencia) {
        await updateDoc(doc(db, 'ocorrencias', editingOcorrencia.id), ocorrenciaData);
        toast.success('Ocorrência atualizada com sucesso!');
      } else {
        await addDoc(collection(db, 'ocorrencias'), ocorrenciaData);
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
        await deleteDoc(doc(db, 'ocorrencias', id));
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
    // Lista de tipos padrão
    const tiposPadrao = [
      'nao_fez_atividade',
      'esqueceu_material',
      'indisciplina_intervalo',
      'indisciplina_sala',
      'aluno_atrasado',
      'comportamento_agressivo',
      'disciplinar',
      'academica',
      'comportamental',
      'outros'
    ];
    const isTipoPadrao = tiposPadrao.includes(ocorrencia.tipo);
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

  // Retorna o rótulo amigável para um tipo (procura em tiposParaFiltro ou converte underscores)
  const getTipoLabel = (tipo: string) => {
    const found = tiposParaFiltro.find(t => t.value === tipo);
    if (found) return found.label;
    // fallback: substituir underscores por espaços e capitalizar a primeira letra
    const text = tipo.replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Filtrar ocorrências
  const ocorrenciasFiltradas = ocorrencias.filter(ocorrencia => {
    if (filtroTipo && ocorrencia.tipo !== filtroTipo) return false;
    if (filtroTurma && ocorrencia.turmaId !== filtroTurma) return false;
    if (filtroAluno && ocorrencia.alunoId !== filtroAluno) return false;
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      const inAluno = (ocorrencia.alunoNome || '').toLowerCase().includes(q);
      const inDescricao = (ocorrencia.descricao || '').toLowerCase().includes(q);
      const inTipo = getTipoLabel(ocorrencia.tipo).toLowerCase().includes(q);
      const inTurma = (ocorrencia.turmaNome || '').toLowerCase().includes(q);
      if (!inAluno && !inDescricao && !inTipo && !inTurma) return false;
    }
    return true;
  });

  // Paginação
  const totalItens = ocorrenciasFiltradas.length;
  const totalPaginas = Math.ceil(totalItens / itensPorPagina);
  const inicio = (paginaAtual - 1) * itensPorPagina;
  const ocorrenciasPaginadas = ocorrenciasFiltradas.slice(inicio, inicio + itensPorPagina);

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'disciplinar': return 'danger';
      case 'academica': return 'warning';
      case 'comportamental': return 'info';
      default: return 'secondary';
    }
  };



  // Estatísticas
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const feitasEsteMes = ocorrencias.filter(o => {
    const data = new Date(o.dataCriacao || o.dataOcorrencia);
    return data.getMonth() === currentMonth && data.getFullYear() === currentYear;
  }).length;
  const stats = {
    total: ocorrencias.length,
    feitasEsteMes,
    criticas: ocorrencias.filter(o => o.gravidade === 'critica').length
  };

  // Exportação - usa os mesmos padrões do Usuarios.tsx
  const getFilteredOcorrenciasList = () => {
    return ocorrencias.filter(o => {
      if (filtroTipo && o.tipo !== filtroTipo) return false;
      if (filtroTurma && o.turmaId !== filtroTurma) return false;
      if (filtroAluno && o.alunoId !== filtroAluno) return false;
      return true;
    }).sort((a, b) => new Date(b.dataCriacao || b.dataOcorrencia).getTime() - new Date(a.dataCriacao || a.dataOcorrencia).getTime());
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text(`Relatório de Ocorrências`, 14, 15);

    const headers = [['Aluno', 'Tipo', 'Turma', 'Data', 'Observações']];
    const body = getFilteredOcorrenciasList().map(o => [
      o.alunoNome,
      getTipoLabel(o.tipo),
      o.turmaNome,
      new Date(o.dataCriacao || o.dataOcorrencia).toLocaleDateString('pt-BR'),
      o.observacoes || ''
    ]);

    autoTable(doc, {
      startY: 25,
      head: headers,
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`ocorrencias-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const downloadExcel = () => {
    const dadosParaExcel = getFilteredOcorrenciasList().map(o => ({
      Aluno: o.alunoNome,
      Tipo: getTipoLabel(o.tipo),
      Turma: o.turmaNome,
      Data: new Date(o.dataCriacao || o.dataOcorrencia).toLocaleDateString('pt-BR'),
      Observacoes: o.observacoes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dadosParaExcel);
    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 30 },
      { wch: 20 },
      { wch: 12 },
      { wch: 50 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Ocorrencias`);
    XLSX.writeFile(workbook, `ocorrencias-${new Date().toISOString().split('T')[0]}.xlsx`);
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
            className="d-flex align-items-center gap-2 flex-shrink-0"
            style={{ 
              minWidth: 'auto',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={18} />
            <span className="d-none d-sm-inline">Nova Ocorrência</span>
            <span className="d-inline d-sm-none">Nova</span>
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
          <div className="col-md-6">
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
        <Card className="mb-4">
          <Card.Body>
            <Row>
              <Col md={3} className="mb-3 mb-md-0">
                <Form.Control
                  type="text"
                  placeholder="Buscar ocorrências por aluno, tipo, turma ou descrição"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </Col>
              <Col md={3} className="mb-3 mb-md-0">
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
              <Col md={3} className="mb-3 mb-md-0">
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
                  {Array.from(new Set(
                    ocorrencias
                      .filter(o => !filtroTurma || o.turmaId === filtroTurma)
                      .map(o => o.alunoId)
                  ))
                    .map(alunoId => {
                      const aluno = alunos.find(a => a.id === alunoId);
                      return aluno ? (
                        <option key={aluno.id} value={aluno.id}>{aluno.nome}</option>
                      ) : null;
                    })}
                </Form.Select>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Lista de Ocorrências - Desktop styled like Usuarios */}
        <div className="ocorrencias-list-desktop d-none d-md-block">
          <Card className="mb-1">
            <Card.Body>
              {ocorrenciasPaginadas.length > 0 && (
                <div className="d-flex align-items-center justify-content-between px-2 mb-2">
                  <h3 className="mb-0">Lista de Ocorrências</h3>
                  <div className="d-flex gap-2">
                    <Button size="sm" onClick={downloadPDF} className="d-flex align-items-center justify-content-center gap-2">
                      <FileText size={16} className='me-1' /> Exportar PDF
                    </Button>
                    <Button size="sm" variant="success" onClick={downloadExcel} className="d-flex align-items-center justify-content-center gap-2">
                      <Download size={16} className='me-1' /> Exportar Excel
                    </Button>
                  </div>
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
                            <td className="text-center text-muted" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem', background: rowBg, transition: 'all .15s ease' }}>{getTipoLabel(ocorrencia.tipo)}</td>
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

        {/* Versão Mobile - estrutura seguindo o padrão das outras páginas */}
        <div className="ocorrencias-mobile-cards d-md-none">
          <div className="ocorrencias-header-mobile">
            {ocorrenciasPaginadas.length > 0 && (
              <>
                <h3>Lista de Ocorrências</h3>
                <div className="d-flex gap-2">
                  <Button size="sm" onClick={downloadPDF} className="d-flex align-items-center gap-2">
                    <FileText size={14} /> PDF
                  </Button>
                  <Button size="sm" variant="success" onClick={downloadExcel} className="d-flex align-items-center gap-2">
                    <Download size={14} /> Excel
                  </Button>
                </div>
              </>
            )}
          </div>
          
          {ocorrenciasPaginadas.length > 0 ? (
            <div className="ocorrencias-grid-mobile">
              {ocorrenciasPaginadas.map(ocorrencia => (
                <div key={ocorrencia.id} className="ocorrencias-card-mobile">
                  <div className="ocorrencias-card-header">
                    <h6 className="ocorrencias-card-title">
                      {getTipoLabel(ocorrencia.tipo)}
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
                      <div style={{  fontWeight: 500 }}>
                        <strong>Total de ocorrências no ano:</strong> {
                          ocorrencias.filter(o => {
                            const data = new Date(o.dataCriacao || o.dataOcorrencia);
                            return o.alunoId === selectedOcorrencia.alunoId && data.getFullYear() === new Date().getFullYear();
                          }).length
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
                      {getTipoLabel(selectedOcorrencia.tipo)}
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
