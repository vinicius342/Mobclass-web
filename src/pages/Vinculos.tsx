import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Table, Spinner, Row, Col, Button, Modal, Form, ToastContainer, Toast,
  InputGroup, FormControl, Dropdown
} from 'react-bootstrap';
import Paginacao from '../components/Paginacao';
import {
  collection, getDocs, addDoc, deleteDoc, doc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link2 } from 'lucide-react';

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
        <Row className="mb-3 justify-content-between">
          <div className="bg-white border-bottom border-gray-200 mb-4">
            <div className="container px-4">
              <div className="d-flex align-items-center justify-content-between py-4">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="d-flex align-items-center justify-content-center rounded bg-primary"
                    style={{ width: 48, height: 48 }}
                  >
                    <Link2 size={24} color="#fff" />
                  </div>
                  <div>
                    <h2 className="fs-3 fw-bold text-dark mb-0">Vínculos Professor-Matéria</h2>
                    <p className="text-muted mb-0" style={{ fontSize: 14 }}>
                      MobClassApp - Portal do Professor
                    </p>
                  </div>
                </div>
                <Col className="text-end">
                  <Button onClick={() => setShowModal(true)}>Novo Vínculo</Button>
                </Col>
              </div>
            </div>
          </div>
        </Row>

        <Row className="mb-3">
          <Col md={4}>
            <Form.Select value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
              <option value="">Filtrar por turma</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Form.Select>
          </Col>
          <Col md={8}>
            <InputGroup>
              <FormControl
                placeholder="Buscar por professor"
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </InputGroup>
          </Col>
        </Row>

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        ) : (
          <>
            <Table responsive bordered hover>
              <thead className="table-light">
                <tr>
                  <th>Professor</th>
                  <th>Matéria</th>
                  <th>Turma</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {vinculosPaginados.map(v => {
                  const professor = professores.find(p => p.id === v.professorId)?.nome || '-';
                  const materia = materias.find(m => m.id === v.materiaId)?.nome || '-';
                  const turma = turmas.find(t => t.id === v.turmaId)?.nome || '-';
                  return (
                    <tr key={v.id}>
                      <td>{professor}</td>
                      <td>{materia}</td>
                      <td>{turma}</td>
                      <td>
                        <Dropdown align="end">
                          <Dropdown.Toggle variant="light" size="sm">
                            <i className="bi bi-three-dots-vertical"></i>
                          </Dropdown.Toggle>
                          <Dropdown.Menu>
                            <Dropdown.Item onClick={() => handleExcluir(v.id)}>
                              <i className="bi bi-trash me-2"></i> Excluir
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                    </tr>
                  );
                })}
                {vinculosPaginados.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center">
                      Nenhum vínculo encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
            <Paginacao
              paginaAtual={paginaAtual}
              totalPaginas={totalPaginas}
              aoMudarPagina={setPaginaAtual}
            />
          </>
        )}

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


