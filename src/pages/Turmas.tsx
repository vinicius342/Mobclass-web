import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Row, Col, Table, Button, Modal, Form, Spinner, ToastContainer, Toast, Dropdown
} from 'react-bootstrap';
import { PlusCircle } from 'react-bootstrap-icons';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, documentId,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import Paginacao from '../components/Paginacao';
import { Users } from 'lucide-react';

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
}

export default function Turmas() {
  const authContext = useAuth();
  const userData = authContext?.userData;

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [novaTurma, setNovaTurma] = useState('');
  const [anoLetivo, setAnoLetivo] = useState('');
  const [turno, setTurno] = useState('Manhã');
  const [editId, setEditId] = useState<string | null>(null);

  const [erro, setErro] = useState('');
  const [turmaFiltro, setTurmaFiltro] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'danger' }>({ show: false, message: '', variant: 'success' });

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
      const alunosSnap = await getDocs(collection(db, 'alunos'));

      setTurmas(turmasSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => a.nome.localeCompare(b.nome)));
      setAlunos(alunosSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
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
  const turmasFiltradas = turmas.filter(t => !turmaFiltro || t.nome.startsWith(turmaFiltro));

  // Extrai as séries únicas das turmas (primeira palavra do nome)
  const seriesUnicas = Array.from(new Set(turmas.map(t => t.nome.split(' ')[0]))).sort();

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const turmasPaginadas = turmasFiltradas.slice(inicio, inicio + itensPorPagina);

  return (
    <AppLayout>
      <Container className="my-4">
        <Row className="justify-content-between align-items-center mb-3">
          <div className="bg-white border-bottom border-gray-200 mb-4">
            <div className="container px-4">
              <div className="d-flex align-items-center justify-content-between py-4">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="d-flex align-items-center justify-content-center rounded bg-primary"
                    style={{ width: 48, height: 48 }}
                  >
                    <Users size={24} color="#fff" />
                  </div>
                  <div>
                    <h2 className="fs-3 fw-bold text-dark mb-0">Turmas</h2>
                    <p className="text-muted mb-0" style={{ fontSize: 14 }}>
                      MobClassApp - Portal do Professor
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Col md={4}>
            <Form.Select value={turmaFiltro} onChange={e => { setTurmaFiltro(e.target.value); setPaginaAtual(1); }}>
              <option value="">Filtrar por série</option>
              {seriesUnicas.map(serie => (
                <option key={serie} value={serie}>{serie} Ano</option>
              ))}
            </Form.Select>

          </Col>
          <Col className="text-end">
            <Button variant="primary" onClick={() => openModal()}>
              <PlusCircle className="me-2" size={18} /> Nova Turma
            </Button>
          </Col>
        </Row>

        {loading ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <Spinner animation="border" />
          </div>
        ) : (
          <>
            <Table responsive bordered hover>
              <thead className="table-light">
                <tr>
                  <th>Nome</th>
                  <th>Ano Letivo</th>
                  <th>Turno</th>
                  <th>Total de Alunos</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {turmasPaginadas.length > 0 ? turmasPaginadas.map(t => (
                  <tr key={t.id}>
                    <td>{t.nome}</td>
                    <td>{t.anoLetivo}</td>
                    <td>{t.turno}</td>
                    <td>{totalAlunos(t.id)}</td>
                    <td>
                      <Dropdown align="end">
                        <Dropdown.Toggle variant="light" size="sm">
                          <i className="bi bi-three-dots-vertical"></i>
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          <Dropdown.Item onClick={() => openModal(t)}>
                            <i className="bi bi-pencil me-2"></i> Editar
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => handleExcluirTurma(t.id)}>
                            <i className="bi bi-trash me-2"></i> Excluir
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="text-center">Nenhuma turma encontrada.</td></tr>
                )}
              </tbody>
            </Table>
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

        <ToastContainer position="bottom-end" className="p-3">
          <Toast bg={toast.variant} show={toast.show} onClose={() => setToast(prev => ({ ...prev, show: false }))} delay={3000} autohide>
            <Toast.Body className="text-white">{toast.message}</Toast.Body>
          </Toast>
        </ToastContainer>
      </Container>
    </AppLayout>
  );
}













