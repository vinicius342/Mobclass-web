import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Table, Button, Modal, Form, Spinner, ToastContainer, Toast, Dropdown, Card
} from 'react-bootstrap';
import { PlusCircle } from 'react-bootstrap-icons';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, documentId,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import Paginacao from '../components/Paginacao';
import { Users, BookOpen, User, Eye, Clock } from 'lucide-react';
import { Edit, Trash2 } from 'lucide-react';

interface Turma {
  id: string;
  nome: string;
  anoLetivo: string;
  turno: string;
}
interface Aluno {
  id: string;
  nome: string;
  turmaId: string;
  email?: string;
}
interface Professor {
  id: string;
  nome: string;
}
interface Materia {
  id: string;
  nome: string;
}
interface Vinculo {
  id: string;
  professorId: string;
  materiaId: string;
  turmaId: string;
}

export default function Turmas() {
  const authContext = useAuth();
  const userData = authContext?.userData;

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [turmaDetalhes, setTurmaDetalhes] = useState<Turma | null>(null);
  const [novaTurma, setNovaTurma] = useState('');
  const [anoLetivo, setAnoLetivo] = useState('');
  const [turno, setTurno] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const [erro, setErro] = useState('');
  const [turmaFiltro, setTurmaFiltro] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'danger' }>({ show: false, message: '', variant: 'success' });
  const [numAlunosFiltro, setNumAlunosFiltro] = useState('');

  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;

  useEffect(() => {
    if (!userData) return;
    fetchData();
  }, [userData]);

  useEffect(() => {
    if (showModal) {
      setTimeout(() => {
        document.getElementById('input-nome-turma')?.focus();
      }, 100);
    }
  }, [showModal]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let turmasSnap;
      if (userData && userData.tipo === 'administradores') {
        turmasSnap = await getDocs(collection(db, 'turmas'));
      } else {
        const turmaIds = userData?.turmas || [];
        if (turmaIds.length > 0) {
          const turmaQuery = query(collection(db, 'turmas'), where(documentId(), 'in', turmaIds));
          turmasSnap = await getDocs(turmaQuery);
        } else {
          turmasSnap = { docs: [] };
        }
      }
      
      // Buscar dados adicionais para os detalhes
      const [alunosSnap, professoresSnap, materiasSnap, vinculosSnap] = await Promise.all([
        getDocs(collection(db, 'alunos')),
        getDocs(collection(db, 'professores')),
        getDocs(collection(db, 'materias')),
        getDocs(collection(db, 'professores_materias'))
      ]);

      setTurmas(turmasSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => a.nome.localeCompare(b.nome)));
      setAlunos(alunosSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setProfessores(professoresSnap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
      setMaterias(materiasSnap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
      setVinculos(vinculosSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
    setLoading(false);
  };

  const openModal = (turma?: Turma) => {
    if (turma) {
      setEditId(turma.id);
      setNovaTurma(turma.nome);
      setAnoLetivo(turma.anoLetivo);
      setTurno(turma.turno);
    } else {
      setEditId(null);
      setNovaTurma('');
      setAnoLetivo('');
      setTurno('Manhã');
    }
    setErro('');
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSalvarTurma = async () => {
    if (!novaTurma.trim()) return setErro('Nome da turma é obrigatório.');
    if (!anoLetivo.trim()) return setErro('Ano letivo é obrigatório.');
    if (!turno.trim()) return setErro('Turno é obrigatório.');

    const payload = { nome: novaTurma.trim(), anoLetivo: anoLetivo.trim(), turno: turno.trim() };

    try {
      if (editId) {
        await updateDoc(doc(db, 'turmas', editId), payload);
        setToast({ show: true, message: 'Turma atualizada com sucesso.', variant: 'success' });
      } else {
        await addDoc(collection(db, 'turmas'), payload);
        setToast({ show: true, message: 'Turma cadastrada com sucesso.', variant: 'success' });
      }
      closeModal();
      fetchData();
    } catch (error) {
      console.error(error);
      setToast({ show: true, message: 'Erro ao salvar turma.', variant: 'danger' });
    }
  };

  const handleExcluirTurma = async (id: string) => {
    if (!window.confirm('Deseja realmente excluir esta turma?')) return;
    try {
      await deleteDoc(doc(db, 'turmas', id));
      setToast({ show: true, message: 'Turma excluída.', variant: 'success' });
      fetchData();
    } catch (error) {
      console.error(error);
      setToast({ show: true, message: 'Erro ao excluir turma.', variant: 'danger' });
    }
  };

  const totalAlunos = (turmaId: string) => alunos.filter(a => a.turmaId === turmaId).length;

  // Filtragem combinada
  const turmasFiltradas = turmas.filter(t => {
    // Busca por nome
    const matchBusca = turmaFiltro === '' || t.nome.toLowerCase().includes(turmaFiltro.toLowerCase());
    // Filtro ano letivo
    const matchAno = anoLetivo === '' || t.anoLetivo === anoLetivo;
    // Filtro turno
    const matchTurno = turno === '' || t.turno === turno;
    // Filtro número de alunos
    const total = totalAlunos(t.id);
    let matchNumAlunos = true;
    if (numAlunosFiltro === 'ate19') matchNumAlunos = total <= 19;
    else if (numAlunosFiltro === '20a30') matchNumAlunos = total >= 20 && total <= 30;
    else if (numAlunosFiltro === 'mais30') matchNumAlunos = total > 30;

    return matchBusca && matchAno && matchTurno && matchNumAlunos;
  });

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const turmasPaginadas = turmasFiltradas.slice(inicio, inicio + itensPorPagina);

  const getTurnoStyle = (turno: string) => {
    switch (turno.toLowerCase()) {
      case 'manhã':
        return { bg: '#fed7aa', color: '#ea580c' }; // laranja suave
      case 'tarde':
        return { bg: '#fecaca', color: '#9a3412' }; // vermelho claro
      case 'noite':
        return { bg: '#dbeafe', color: '#1e40af' }; // azul claro
      default:
        return { bg: '#f3f4f6', color: '#6b7280' }; // cinza
    }
  };

  const handleVerDetalhes = (turma: Turma) => {
    setTurmaDetalhes(turma);
    setShowDetalhesModal(true);
  };

  const closeDetalhesModal = () => {
    setShowDetalhesModal(false);
    setTurmaDetalhes(null);
  };

  const getProfessoresDaTurma = (turmaId: string) => {
    return vinculos
      .filter(v => v.turmaId === turmaId)
      .map(v => {
        const professor = professores.find(p => p.id === v.professorId);
        const materia = materias.find(m => m.id === v.materiaId);
        return {
          professor: professor?.nome || 'Professor não encontrado',
          materia: materia?.nome || 'Matéria não encontrada'
        };
      })
      .sort((a, b) => a.professor.localeCompare(b.professor));
  };

  const getAlunosDaTurma = (turmaId: string) => {
    return alunos
      .filter(a => a.turmaId === turmaId)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  };

  return (
    <AppLayout>
      <Container className="my-4">
        <div className="border-gray-200 mb-3">
          <div className="mb-4 px-1">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <div className="d-flex align-items-center gap-2">
                <Users size={32} color="#2563eb" style={{ minWidth: 32, minHeight: 32 }} />
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
                  Gestão de Turmas
                </h1>
              </div>
              <Button variant="primary" onClick={() => openModal()}>
                <PlusCircle className="me-2" size={18} /> Nova Turma
              </Button>
            </div>
            <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
              Gerencie as turmas da escola
            </p>
          </div>
        </div>

        {/* Cards de resumo acima dos filtros */}
        <div className="row mb-3 g-3">
          {/* Card Total de Turmas */}
          <div className="col-md-4">
            <Card className="shadow-sm card-sm border-left-primary mb-1">
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{borderRadius: '12px 12px 0 0'}}>
                <span className="fw-bold" style={{fontSize: '1.1rem', color: '#3b4861'}}>Total de Turmas</span>
                <BookOpen size={20} className="text-primary" />
              </div>
              <Card.Body className="py-3">
                <h3 className="mb-0 fw-bold" style={{color: '#2563eb'}}>{turmasFiltradas.length}</h3>
              </Card.Body>
            </Card>
          </div>
          {/* Card Média de Alunos */}
          <div className="col-md-4">
            <Card className="shadow-sm card-sm border-left-success mb-1">
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{borderRadius: '12px 12px 0 0'}}>
                <span className="fw-bold" style={{fontSize: '1.1rem', color: '#3b4861'}}>Média de Alunos</span>
                <Users size={20} className="text-success" />
              </div>
              <Card.Body className="py-3">
                <h3 className="mb-0 fw-bold" style={{color: '#22c55e'}}>{turmasFiltradas.length > 0 ? Math.round(turmasFiltradas.reduce((acc, t) => acc + totalAlunos(t.id), 0) / turmasFiltradas.length) : 0}</h3>
              </Card.Body>
            </Card>
          </div>
          {/* Card Turnos Ativos */}
          <div className="col-md-4">
            <Card className="shadow-sm card-sm border-left-purple mb-1" style={{borderLeft: '4px solid #a78bfa'}}>
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{borderRadius: '12px 12px 0 0'}}>
                <span className="fw-bold" style={{fontSize: '1.1rem', color: '#3b4861'}}>Turnos Ativos</span>
                <span className="d-flex align-items-center gap-2">
                  <Clock size={20} color="#a78bfa" />
                </span>
              </div>
              <Card.Body className="py-3">
                <h3 className="mb-0 fw-bold" style={{color: '#a78bfa'}}>{Array.from(new Set(turmasFiltradas.map(t => t.turno))).length}</h3>
              </Card.Body>
            </Card>
          </div>
        </div>

        {/* Filtros em um único card */}
        <Card className="mb-4">
          <Card.Body>
            <div className="row g-3">
              <div className="col-md-3">
                <Form.Control
                  type="text"
                  placeholder="Buscar turma..."
                  value={turmaFiltro}
                  onChange={e => { setTurmaFiltro(e.target.value); setPaginaAtual(1); }}
                />
              </div>
              <div className="col-md-3">
                <Form.Select value={anoLetivo} onChange={e => { setAnoLetivo(e.target.value); setPaginaAtual(1); }}>
                  <option value="">Selecione o ano letivo</option>
                  {[...new Set(turmas.map(t => t.anoLetivo))].sort().map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Form.Select value={turno} onChange={e => { setTurno(e.target.value); setPaginaAtual(1); }}>
                  <option value="">Todos os turnos</option>
                  {[...new Set(turmas.map(t => t.turno))].sort().map(turno => (
                    <option key={turno} value={turno}>{turno}</option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Form.Select value={numAlunosFiltro} onChange={e => { setNumAlunosFiltro(e.target.value); setPaginaAtual(1); }}>
                  <option value="">Nº de alunos</option>
                  <option value="ate19">Até 19</option>
                  <option value="20a30">20 a 30</option>
                  <option value="mais30">Mais de 30</option>
                </Form.Select>
              </div>
            </div>
          </Card.Body>
        </Card>

        {loading ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <Spinner animation="border" />
          </div>
        ) : (
          <>
            {/* Versão Desktop */}
            <div className="turmas-list-desktop d-none d-md-block">
              <Card className="mb-1">
                <Card.Body>
                  <div className="agenda-table-desktop w-100">
                    <Table responsive hover className="w-100">
                      <thead className="thead-sticky">
                        <tr style={{ textAlign: 'center' }}>
                          <th className='text-muted'>Turma</th>
                          <th className='text-muted'>Ano Letivo</th>
                          <th className='text-muted'>Turno</th>
                          <th className='text-muted'>Total de Alunos</th>
                          <th className='text-muted'>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {turmasPaginadas.length > 0 ? turmasPaginadas.map(t => {
                          const turnoStyle = getTurnoStyle(t.turno);
                          
                          return (
                            <tr key={t.id} className='align-middle linha-agenda' style={{ textAlign: 'center' }}>
                              <td><strong>{t.nome}</strong></td>
                              <td><span className="text-secondary" style={{color: '#6c757d'}}>{t.anoLetivo}</span></td>
                              <td>
                                <span
                                  className="badge badge-turno px-2 py-1"
                                  style={{
                                    backgroundColor: turnoStyle.bg,
                                    color: turnoStyle.color
                                  }}
                                >
                                  {t.turno}
                                </span>
                              </td>
                              <td>
                                <span className="fw-semibold" style={{fontWeight: 600, fontSize: '1rem', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4}}>
                                  <Users size={18} style={{marginRight: 4, verticalAlign: 'middle', color: '#6c757d'}} />
                                  {totalAlunos(t.id)}
                                </span>
                              </td>
                              <td>
                                <Dropdown align="end">
                                  <Dropdown.Toggle
                                    variant="light"
                                    size="sm"
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      boxShadow: 'none'
                                    }}
                                    className="dropdown-toggle-no-caret"
                                  >
                                    ⋯
                                  </Dropdown.Toggle>
                                  <Dropdown.Menu>
                                    <Dropdown.Item onClick={() => handleVerDetalhes(t)} className="d-flex align-items-center gap-2">
                                      <Eye size={16} /> Detalhes
                                    </Dropdown.Item>
                                    <Dropdown.Item onClick={() => openModal(t)} className="d-flex align-items-center gap-2 text-primary">
                                      <Edit size={16} className="text-primary" /> Editar
                                    </Dropdown.Item>
                                    <Dropdown.Item onClick={() => handleExcluirTurma(t.id)} className="d-flex align-items-center gap-2 text-danger">
                                      <Trash2 size={16} /> Excluir
                                    </Dropdown.Item>
                                  </Dropdown.Menu>
                                </Dropdown>
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan={5} className="text-center py-4">
                              <div className="agenda-empty-state">
                                <div className="empty-icon">🏫</div>
                                <h5>Nenhuma turma encontrada</h5>
                                <p className="text-muted">Tente ajustar os filtros ou adicione uma nova turma.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </div>

            {/* Versão Mobile */}
            <div className="turmas-mobile-cards d-block d-md-none">
              <div className="turmas-header-mobile mb-3">
                <h3 className="mb-0">Turmas</h3>
              </div>
              
              {turmasPaginadas.length > 0 ? (
                <div className="turmas-grid-mobile">
                  {turmasPaginadas.map(t => {
                    const turnoStyle = getTurnoStyle(t.turno);
                    return (
                      <div key={t.id} className="turmas-card-mobile">
                        <div className="turmas-card-header">
                          <div className="turmas-card-info">
                            <div className="turmas-card-title">{t.nome}</div>
                            <div className="turmas-card-ano">Ano: {t.anoLetivo}</div>
                          </div>
                          <span
                            className="badge px-2 py-1"
                            style={{
                              backgroundColor: turnoStyle.bg,
                              color: turnoStyle.color,
                              fontSize: '0.8rem'
                            }}
                          >
                            {t.turno}
                          </span>
                        </div>
                        
                        <div className="turmas-card-body">
                          <div className="turmas-alunos-info">
                            <Users size={18} className="text-muted me-2" />
                            <span className="fw-semibold">{totalAlunos(t.id)} alunos</span>
                          </div>
                        </div>
                        
                        <div className="turmas-card-actions">
                          <button 
                            className="turmas-action-btn turmas-detalhes-btn"
                            onClick={() => handleVerDetalhes(t)}
                          >
                            <Eye size={16} />
                            Detalhes
                          </button>
                          <button 
                            className="turmas-action-btn turmas-edit-btn"
                            onClick={() => openModal(t)}
                          >
                            <Edit size={16} />
                            Editar
                          </button>
                          <button 
                            className="turmas-action-btn turmas-delete-btn"
                            onClick={() => handleExcluirTurma(t.id)}
                          >
                            <Trash2 size={16} />
                            Excluir
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="turmas-empty-state">
                  <div className="turmas-empty-icon">
                    <Users size={48} />
                  </div>
                  <h5 className="turmas-empty-title">Nenhuma turma encontrada</h5>
                  <p className="turmas-empty-text">
                    {turmaFiltro || anoLetivo || turno || numAlunosFiltro 
                      ? 'Tente ajustar os filtros de busca.'
                      : 'Comece adicionando sua primeira turma.'
                    }
                  </p>
                </div>
              )}
            </div>

            <Paginacao
              paginaAtual={paginaAtual}
              totalPaginas={Math.ceil(turmasFiltradas.length / itensPorPagina)}
              aoMudarPagina={setPaginaAtual}
            />
          </>
        )}

        <Modal show={showModal} onHide={closeModal} centered>
          <Modal.Header closeButton>
            <Modal.Title>{editId ? 'Editar Turma' : 'Nova Turma'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Nome da Turma</Form.Label>
                <Form.Control id="input-nome-turma" type="text" value={novaTurma} onChange={e => setNovaTurma(e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Ano Letivo</Form.Label>
                <Form.Control type="number" min="2020" max="2100" value={anoLetivo} onChange={e => setAnoLetivo(e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Turno</Form.Label>
                <Form.Select value={turno} onChange={e => setTurno(e.target.value)}>
                  <option>Manhã</option>
                  <option>Tarde</option>
                </Form.Select>
              </Form.Group>
              {erro && <div className="text-danger mt-2">{erro}</div>}
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button variant="primary" onClick={handleSalvarTurma}>Salvar</Button>
          </Modal.Footer>
        </Modal>

        {/* Modal de Detalhes da Turma */}
        <Modal show={showDetalhesModal} onHide={closeDetalhesModal} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title className="d-flex align-items-center gap-2">
              <Users size={24} color="#2563eb" />
              Detalhes da Turma - {turmaDetalhes?.nome}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {turmaDetalhes && (
              <div className="row g-4">
                {/* Card de Informações Gerais */}
                <div className="col-12">
                  <Card className="shadow-sm">
                    <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center gap-2" style={{borderRadius: '12px 12px 0 0'}}>
                      <BookOpen size={20} className="me-2 text-primary" />
                      <span className="fw-bold" style={{fontSize: '1.1rem', color: '#1e293b'}}>Informações Gerais</span>
                    </div>
                    <Card.Body>
                      <div className="row">
                        <div className="col-md-4">
                          <div className="mb-3">
                            <label className="form-label fw-semibold text-muted">Ano Letivo</label>
                            <p className="mb-0">{turmaDetalhes.anoLetivo}</p>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="mb-3">
                            <label className="form-label fw-semibold text-muted">Turno</label>
                            <div>
                              <span
                                className="badge px-2 py-1"
                                style={{
                                  backgroundColor: getTurnoStyle(turmaDetalhes.turno).bg,
                                  color: getTurnoStyle(turmaDetalhes.turno).color
                                }}
                              >
                                {turmaDetalhes.turno}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="mb-3">
                            <label className="form-label fw-semibold text-muted">Status</label>
                            <div>
                              <span className="badge bg-success px-2 py-1">Ativa</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </div>

                {/* Card de Professores em cima do card de alunos */}
                <div className="col-md-12">
                  <Card className="shadow-sm">
                    <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center gap-2" style={{borderRadius: '12px 12px 0 0'}}>
                      <User size={20} className="me-2 text-primary" />
                      <span className="fw-bold" style={{fontSize: '1.1rem', color: '#1e293b'}}>Professores</span>
                      <span className="badge bg-primary ms-2" style={{fontSize: '0.95rem'}}>{getProfessoresDaTurma(turmaDetalhes.id).length}</span>
                    </div>
                    <Card.Body className="p-2">
                      {getProfessoresDaTurma(turmaDetalhes.id).length > 0 ? (
                        <div style={{maxHeight: '300px', overflowY: 'auto'}}>
                          <div className="row g-2">
                            {getProfessoresDaTurma(turmaDetalhes.id).map((item, index) => (
                              <div key={index} className="col-12 col-md-6">
                                <Card className="mb-2 card-sm border-left-primary">
                                  <Card.Body className="py-2 px-3">
                                    <div className="d-flex align-items-center">
                                      <User size={16} className="me-2 text-primary" />
                                      <div className="flex-grow-1">
                                        <h6 className="mb-1 fw-semibold text-dark">{item.professor}</h6>
                                        <p className="mb-0 text-muted small">{item.materia}</p>
                                      </div>
                                    </div>
                                  </Card.Body>
                                </Card>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted py-3">
                          <User size={32} className="mb-2 opacity-50" />
                          <p className="mb-0">Nenhum professor vinculado</p>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </div>

                {/* Card de Alunos abaixo do card de professores */}
                <div className="col-md-12">
                  <Card className="shadow-sm h-100">
                    <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center gap-2" style={{borderRadius: '12px 12px 0 0'}}>
                      <Users size={20} className="me-2 text-success" />
                      <span className="fw-bold" style={{fontSize: '1.1rem', color: '#1e293b'}}>Alunos Matriculados</span>
                      <span className="badge bg-success ms-2" style={{fontSize: '0.95rem'}}>{getAlunosDaTurma(turmaDetalhes.id).length}</span>
                    </div>
                    <Card.Body className="p-2">
                      {getAlunosDaTurma(turmaDetalhes.id).length > 0 ? (
                        <div style={{maxHeight: '300px', overflowY: 'auto'}}>
                          <div className="row g-2">
                            {getAlunosDaTurma(turmaDetalhes.id).map((aluno) => (
                              <div key={aluno.id} className="col-12 col-md-6">
                                <Card className="mb-2 card-sm border-left-success">
                                  <Card.Body className="py-2 px-3">
                                    <div className="d-flex align-items-center">
                                      <Users size={16} className="me-2 text-success" />
                                      <div className="flex-grow-1">
                                        <h6 className="mb-1 fw-semibold text-dark">{aluno.nome}</h6>
                                        <p className="mb-0 text-muted small">
                                          {aluno.email || 'Email não cadastrado'}
                                        </p>
                                      </div>
                                    </div>
                                  </Card.Body>
                                </Card>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted py-3">
                          <Users size={32} className="mb-2 opacity-50" />
                          <p className="mb-0">Nenhum aluno matriculado</p>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </div>
              </div>
            )}
          </Modal.Body>
        </Modal>

        <ToastContainer position="bottom-end" className="p-3">
          <Toast bg={toast.variant} show={toast.show} onClose={() => setToast(prev => ({ ...prev, show: false }))} delay={3000} autohide>
            <Toast.Body className="text-white">{toast.message}</Toast.Body>
          </Toast>
        </ToastContainer>
      </Container>
    </AppLayout>
  );
}













