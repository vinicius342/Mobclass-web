import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Table, Spinner, Button, Modal, Form, ToastContainer, Toast,
  Dropdown, Card
} from 'react-bootstrap';
import { PlusCircle } from 'react-bootstrap-icons';
import { Link2, Trash2 } from 'lucide-react';
import Paginacao from '../components/Paginacao';
import {
  collection, getDocs, addDoc, deleteDoc, doc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

interface Professor { id: string; nome: string; }
interface Turma { id: string; nome: string; }
interface Materia { id: string; nome: string; }
interface Vinculo { id: string; professorId: string; materiaId: string; turmaId: string; }

export default function Vinculos() {
  const { userData } = useAuth()!;
  const isAdmin = userData?.tipo === 'administradores';

  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [professorId, setProfessorId] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [materiaId, setMateriaId] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' as 'success' | 'danger' });
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroMateria, setFiltroMateria] = useState('');
  const [filtroProfessor, setFiltroProfessor] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [profSnap, turmaSnap, matSnap, vincSnap] = await Promise.all([
      getDocs(collection(db, 'professores')),
      getDocs(collection(db, 'turmas')),
      getDocs(collection(db, 'materias')),
      getDocs(collection(db, 'professores_materias')),
    ]);

    setProfessores(profSnap.docs.map(d => ({ id: d.id, nome: d.data().nome })).sort((a, b) => a.nome.localeCompare(b.nome)));
    setTurmas(turmaSnap.docs.map(d => ({ id: d.id, nome: d.data().nome })).sort((a, b) => a.nome.localeCompare(b.nome)));
    setMaterias(matSnap.docs.map(d => ({ id: d.id, nome: d.data().nome })).sort((a, b) => a.nome.localeCompare(b.nome)));
    setVinculos(vincSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    setLoading(false);
  };

  const handleCriar = async () => {
    if (!professorId || !turmaId || !materiaId) return;

    const jaExiste = vinculos.some(v =>
      v.professorId === professorId && v.materiaId === materiaId && v.turmaId === turmaId
    );

    if (jaExiste) {
      setToast({ show: true, message: 'Esse vínculo já existe.', variant: 'danger' });
      return;
    }

    try {
      await addDoc(collection(db, 'professores_materias'), { professorId, turmaId, materiaId });
      setToast({ show: true, message: 'Vínculo criado com sucesso!', variant: 'success' });

      // Limpa o formulário
      setProfessorId('');
      setTurmaId('');
      setMateriaId('');
      setShowModal(false);

      fetchData();
    } catch (err) {
      console.error(err);
      setToast({ show: true, message: 'Erro ao criar vínculo.', variant: 'danger' });
    }
  };

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Excluir este vínculo?')) return;
    try {
      await deleteDoc(doc(db, 'professores_materias', id));
      setToast({ show: true, message: 'Vínculo excluído.', variant: 'success' });
      fetchData();
    } catch (err) {
      console.error(err);
      setToast({ show: true, message: 'Erro ao excluir vínculo.', variant: 'danger' });
    }
  };

  const vinculosFiltrados = vinculos
    .filter(v => {
      const professor = professores.find(p => p.id === v.professorId)?.nome.toLowerCase() || '';
      const turma = turmas.find(t => t.id === v.turmaId)?.nome.toLowerCase() || '';
      return (
        (!filtroTurma || v.turmaId === filtroTurma) &&
        (!filtroMateria || v.materiaId === filtroMateria) &&
        (!filtroProfessor || v.professorId === filtroProfessor) &&
        (professor.includes(busca.toLowerCase()) || turma.includes(busca.toLowerCase()))
      );
    })
    .sort((a, b) => {
      const profA = professores.find(p => p.id === a.professorId)?.nome || '';
      const profB = professores.find(p => p.id === b.professorId)?.nome || '';
      const turmaA = turmas.find(t => t.id === a.turmaId)?.nome || '';
      const turmaB = turmas.find(t => t.id === b.turmaId)?.nome || '';
      const matA = materias.find(m => m.id === a.materiaId)?.nome || '';
      const matB = materias.find(m => m.id === b.materiaId)?.nome || '';
      return profA.localeCompare(profB) || turmaA.localeCompare(turmaB) || matA.localeCompare(matB);
    });

  const totalPaginas = Math.ceil(vinculosFiltrados.length / itensPorPagina);
  const vinculosPaginados = vinculosFiltrados.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

  if (!isAdmin) {
    return (
      <AppLayout>
        <Container className="my-4">
          <h5 className="text-danger">Acesso restrito a administradores.</h5>
        </Container>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Container className="my-4">
        <div className="border-gray-200 mb-3">
          <div className="mb-4 px-1">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <div className="d-flex align-items-center gap-2">
                <Link2 size={32} color="#2563eb" style={{ minWidth: 32, minHeight: 32 }} />
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
                  Vínculos
                </h1>
              </div>
              <div className="mt-2 text-end">
                <Button variant="primary" onClick={() => setShowModal(true)}>
                  <PlusCircle className="me-2" size={18} /> Novo Vínculo
                </Button>
              </div>
            </div>
            <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
              Gerencie os vínculos entre professores, turmas e disciplinas
            </p>
          </div>
        </div>

        {/* Cards de resumo acima dos filtros */}
        <div className="row g-3">
          {/* Card Total de Vínculos */}
          <div className="col-md-6">
            <Card className="shadow-sm card-sm border-left-primary">
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{borderRadius: '12px 12px 0 0'}}>
                <span className="fw-bold" style={{fontSize: '1.1rem', color: '#3b4861'}}>Total de Vínculos</span>
                <Link2 size={20} className="text-primary" />
              </div>
              <Card.Body className="py-3">
                <h3 className="mb-0 fw-bold" style={{color: '#2563eb'}}>{vinculosFiltrados.length}</h3>
              </Card.Body>
            </Card>
          </div>
          {/* Card Professores Ativos */}
          <div className="col-md-6">
            <Card className="shadow-sm card-sm border-left-success">
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{borderRadius: '12px 12px 0 0'}}>
                <span className="fw-bold" style={{fontSize: '1.1rem', color: '#3b4861'}}>Professores Ativos</span>
                <span className="d-flex align-items-center gap-2">
                  <PlusCircle size={20} className="text-success" />
                </span>
              </div>
              <Card.Body className="py-3">
                <h3 className="mb-0 fw-bold" style={{color: '#22c55e'}}>{[...new Set(vinculosFiltrados.map(v => v.professorId))].length}</h3>
              </Card.Body>
            </Card>
          </div>
        </div>

        <Card className="mb-4">
          <Card.Body>
            <div className="row g-3">
              <div className="col-md-4">
                <Form.Select value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
                  <option value="">Filtrar por turma</option>
                  {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Select value={filtroMateria} onChange={e => setFiltroMateria(e.target.value)}>
                  <option value="">Filtrar por matéria</option>
                  {materias.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Select value={filtroProfessor} onChange={e => setFiltroProfessor(e.target.value)}>
                  <option value="">Filtrar por professor</option>
                  {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </Form.Select>
              </div>
            </div>
            <div className="row g-3 mt-1">
              <div className="col-md-4">
                <Form.Control
                  type="text"
                  placeholder="Buscar por professor ou turma..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>
            </div>
          </Card.Body>
        </Card>

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        ) : (
          <>
            {/* Versão Desktop */}
            <div className="vinculos-list-desktop d-none d-md-block">
              <Card className="mb-3">
                <Card.Body>
                  {/* Título da tabela dentro do Card */}
                  <h3 className="px-2">Lista de Vínculos</h3>
                  <Table responsive hover className="w-100">
                    <thead className="thead-sticky">
                      <tr style={{ textAlign: 'center' }}>
                        <th className='text-muted'>Professor</th>
                        <th className='text-muted'>Matéria</th>
                        <th className='text-muted'>Turma</th>
                        <th className='text-muted'>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vinculosPaginados.length > 0 ? vinculosPaginados.map(v => {
                        const professor = professores.find(p => p.id === v.professorId)?.nome || '-';
                        const materia = materias.find(m => m.id === v.materiaId)?.nome || '-';
                        const turma = turmas.find(t => t.id === v.turmaId)?.nome || '-';
                        return (
                          <tr key={v.id} className='align-middle linha-agenda' style={{ textAlign: 'center' }}>
                            <td><strong>{professor}</strong></td>
                            <td><span >{materia}</span></td>
                            <td><span>{turma}</span></td>
                            <td>
                              <Dropdown align="end">
                                <Dropdown.Toggle variant="light" size="sm" style={{ border: 'none', background: 'transparent', boxShadow: 'none' }} className="dropdown-toggle-no-caret">
                                  ⋯
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                  <Dropdown.Item onClick={() => handleExcluir(v.id)} className="d-flex align-items-center gap-2 text-danger">
                                    <Trash2 size={16} /> Excluir
                                  </Dropdown.Item>
                                </Dropdown.Menu>
                              </Dropdown>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={4} className="text-center py-4">
                            <div className="agenda-empty-state">
                              <div className="empty-icon">🔗</div>
                              <h5>Nenhum vínculo encontrado</h5>
                              <p className="text-muted">Tente ajustar os filtros ou adicione um novo vínculo.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </div>

            {/* Versão Mobile */}
            <div className="vinculos-mobile-cards d-block d-md-none">
              <div className="vinculos-header-mobile mb-3">
                <h3 className="mb-0">Lista de Vínculos</h3>
              </div>
              
              {vinculosPaginados.length > 0 ? (
                <div className="vinculos-grid-mobile">
                  {vinculosPaginados.map(v => {
                    const professor = professores.find(p => p.id === v.professorId)?.nome || '-';
                    const materia = materias.find(m => m.id === v.materiaId)?.nome || '-';
                    const turma = turmas.find(t => t.id === v.turmaId)?.nome || '-';
                    return (
                      <div key={v.id} className="vinculos-card-mobile">
                        <div className="vinculos-card-header">
                          <div className="vinculos-card-info">
                            <div className="vinculos-card-professor">{professor}</div>
                            <div className="vinculos-card-details">
                              <span className="vinculos-detail-item">📚 {materia}</span>
                              <span className="vinculos-detail-item">🏫 {turma}</span>
                            </div>
                          </div>
                          <Link2 size={20} className="text-primary" />
                        </div>
                        
                        <div className="vinculos-card-actions">
                          <button 
                            className="vinculos-action-btn vinculos-delete-btn"
                            onClick={() => handleExcluir(v.id)}
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
                <div className="vinculos-empty-state">
                  <div className="vinculos-empty-icon">
                    <Link2 size={48} />
                  </div>
                  <h5 className="vinculos-empty-title">Nenhum vínculo encontrado</h5>
                  <p className="vinculos-empty-text">
                    {busca || filtroTurma || materiaId || professorId
                      ? 'Tente ajustar os filtros de busca.'
                      : 'Comece adicionando seu primeiro vínculo.'
                    }
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <Paginacao
          paginaAtual={paginaAtual}
          totalPaginas={totalPaginas}
          aoMudarPagina={setPaginaAtual}
        />

        <Modal show={showModal} onHide={() => setShowModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>Novo Vínculo</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Professor</Form.Label>
                <Form.Select value={professorId} onChange={e => setProfessorId(e.target.value)}>
                  <option value="">Selecione</option>
                  {professores.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Turma</Form.Label>
                <Form.Select value={turmaId} onChange={e => setTurmaId(e.target.value)}>
                  <option value="">Selecione</option>
                  {turmas.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label>Matéria</Form.Label>
                <Form.Select value={materiaId} onChange={e => setMateriaId(e.target.value)}>
                  <option value="">Selecione</option>
                  {materias.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleCriar}>
              Salvar
            </Button>
          </Modal.Footer>
        </Modal>

        <ToastContainer position="bottom-end" className="p-3">
          <Toast
            bg={toast.variant}
            show={toast.show}
            onClose={() => setToast(prev => ({ ...prev, show: false }))}
            delay={3000}
            autohide
          >
            <Toast.Body className="text-white">{toast.message}</Toast.Body>
          </Toast>
        </ToastContainer>
      </Container>
    </AppLayout>
  );
}


