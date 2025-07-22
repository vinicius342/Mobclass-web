import { JSX, useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Table, Spinner, Row, Col, Button, Modal, Form,
  ToastContainer, Toast, Pagination, Dropdown
} from 'react-bootstrap';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { PlusCircle } from 'react-bootstrap-icons';
import { Notebook } from 'lucide-react';

interface Materia {
  id: string;
  nome: string;
  codigo: string;
}

export default function Materias(): JSX.Element {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'danger' }>({ show: false, message: '', variant: 'success' });

  useEffect(() => {
    fetchMaterias();
  }, []);

  useEffect(() => {
    if (showModal) {
      setTimeout(() => {
        document.getElementById('nome-materia')?.focus();
      }, 100);
    }
  }, [showModal]);

  const fetchMaterias = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'materias'));
    const lista = snap.docs.map(d => ({
      id: d.id,
      nome: d.data().nome,
      codigo: d.data().codigo
    })).sort((a, b) => a.nome.localeCompare(b.nome));
    setMaterias(lista);
    setLoading(false);
  };

  const openModal = (item?: Materia) => {
    if (item) {
      setEditId(item.id);
      setNome(item.nome);
    } else {
      setEditId(null);
      setNome('');
    }
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const gerarCodigoMateria = (nome: string): string => {
    const prefixo = nome.substring(0, 3).toUpperCase();
    const numero = Math.floor(100 + Math.random() * 900);
    return `${prefixo}${numero}`;
  };

  const handleSalvar = async () => {
    if (!nome) return;
    const codigoGerado = editId
      ? materias.find(m => m.id === editId)?.codigo || gerarCodigoMateria(nome)
      : gerarCodigoMateria(nome);

    const payload = { nome, codigo: codigoGerado };

    try {
      if (editId) {
        await updateDoc(doc(db, 'materias', editId), payload);
      } else {
        await addDoc(collection(db, 'materias'), payload);
      }
      setToast({ show: true, message: editId ? 'Matéria atualizada' : 'Matéria criada', variant: 'success' });
      closeModal();
      fetchMaterias();
    } catch (err) {
      console.error(err);
      setToast({ show: true, message: 'Erro ao salvar matéria.', variant: 'danger' });
    }
  };

  const handleExcluir = async (id: string) => {
    if (window.confirm('Deseja excluir esta matéria?')) {
      try {
        await deleteDoc(doc(db, 'materias', id));
        setToast({ show: true, message: 'Matéria excluída.', variant: 'success' });
        fetchMaterias();
      } catch (err) {
        console.error(err);
        setToast({ show: true, message: 'Erro ao excluir matéria.', variant: 'danger' });
      }
    }
  };

  const totalPaginas = Math.ceil(materias.length / itensPorPagina);
  const inicio = (paginaAtual - 1) * itensPorPagina;
  const fim = inicio + itensPorPagina;
  const materiasPaginadas = materias.slice(inicio, fim);

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
                    <Notebook size={24} color="#fff" />
                  </div>
                  <div>
                    <h2 className="fs-3 fw-bold text-dark mb-0">Matérias</h2>
                    <p className="text-muted mb-0" style={{ fontSize: 14 }}>
                      MobClassApp - Portal do Professor
                    </p>
                  </div>
                </div>
                <Col className="text-end">
                  <Button variant="primary" onClick={() => openModal()}>
                    <PlusCircle className="me-2" size={18} /> Nova Matéria
                  </Button>
                </Col>
              </div>
            </div>
          </div>
        </Row>

        {loading ? (
          <div className="d-flex justify-content-center align-items-center vh-50">
            <Spinner animation="border" />
          </div>
        ) : (
          <>
            <Table responsive bordered hover>
              <thead className="table-light">
                <tr>
                  <th>Nome</th>
                  <th>Código</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {materiasPaginadas.length > 0 ? materiasPaginadas.map(item => (
                  <tr key={item.id}>
                    <td>{item.nome}</td>
                    <td>{item.codigo}</td>
                    <td>
                      <Dropdown align="end">
                        <Dropdown.Toggle variant="light" size="sm">
                          <i className="bi bi-three-dots-vertical"></i>
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          <Dropdown.Item onClick={() => openModal(item)}>
                            <i className="bi bi-pencil me-2"></i> Editar
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => handleExcluir(item.id)}>
                            <i className="bi bi-trash me-2"></i> Excluir
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="text-center">Nenhuma matéria encontrada.</td></tr>
                )}
              </tbody>
            </Table>

            <Pagination className="justify-content-center">
              <Pagination.Prev disabled={paginaAtual === 1} onClick={() => setPaginaAtual(p => p - 1)} />
              {[...Array(totalPaginas)].map((_, i) => (
                <Pagination.Item
                  key={i}
                  active={paginaAtual === i + 1}
                  onClick={() => setPaginaAtual(i + 1)}
                >
                  {i + 1}
                </Pagination.Item>
              ))}
              <Pagination.Next disabled={paginaAtual === totalPaginas} onClick={() => setPaginaAtual(p => p + 1)} />
            </Pagination>
          </>
        )}

        <Modal show={showModal} onHide={closeModal} centered>
          <Modal.Header closeButton>
            <Modal.Title>{editId ? 'Editar Matéria' : 'Nova Matéria'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Nome da Matéria</Form.Label>
                <Form.Control id="nome-materia" type="text" value={nome} onChange={e => setNome(e.target.value)} />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button variant="primary" onClick={handleSalvar}>Salvar</Button>
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










