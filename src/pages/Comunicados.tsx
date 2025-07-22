// src/pages/Comunicados.tsx - Atualizado para permitir professores criarem comunicados e usar vínculos
import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Table, Button, Modal, Form, ToastContainer, Toast, Row, Col, InputGroup, FormControl,
  Dropdown
} from 'react-bootstrap';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp, getDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import Paginacao from '../components/Paginacao';
import { Megaphone } from 'react-bootstrap-icons';

interface Comunicado {
  id: string;
  assunto: string;
  mensagem: string;
  turmaId: string;
  turmaNome: string;
  data: Timestamp;
}
interface Turma {
  id: string;
  nome: string;
}
interface Vinculo {
  professorId: string;
  materiaId: string;
  turmaId: string;
}

export default function Comunicados() {
  const { userData } = useAuth()!;
  const isAdmin = userData?.tipo === 'administradores';

  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [, setVinculos] = useState<Vinculo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' as 'success' | 'danger' });

  const [busca, setBusca] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 3;

  useEffect(() => {
    fetchData();
  }, [userData]);

  useEffect(() => {
    if (showModal) {
      setTimeout(() => {
        document.getElementById('input-assunto')?.focus();
      }, 100);
    }
  }, [showModal]);

  const fetchData = async () => {
    let turmaDocs = [];
    if (isAdmin) {
      const turmaSnap = await getDocs(collection(db, 'turmas'));
      turmaDocs = turmaSnap.docs;
    } else {
      const vincSnap = await getDocs(query(collection(db, 'professores_materias'), where('professorId', '==', userData?.uid)));
      const vincList = vincSnap.docs.map(d => d.data() as Vinculo);
      setVinculos(vincList);
      const turmaIds = [...new Set(vincList.map(v => v.turmaId))];
      turmaDocs = await Promise.all(turmaIds.map(async id => await getDoc(doc(db, 'turmas', id))));
    }

    const listaTurmas = turmaDocs
      .map(d => ({ id: d.id, nome: d.data()?.nome || '-' }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setTurmas(listaTurmas);

    const comunicadosQuery = isAdmin
      ? query(collection(db, 'comunicados'), orderBy('data', 'desc'))
      : query(collection(db, 'comunicados'), where('turmaId', 'in', listaTurmas.map(t => t.id)), orderBy('data', 'desc'));

    const snap = await getDocs(comunicadosQuery);
    const lista = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Comunicado[];
    setComunicados(lista);
  };

  const handleSalvar = async () => {
    if (!assunto || !mensagem) return;
    const turmaSelecionada = turmas.find(t => t.id === turmaId);
    const payload = {
      assunto,
      mensagem,
      turmaId,
      turmaNome: turmaSelecionada?.nome || '',
      data: Timestamp.now(),
    };

    try {
      if (editandoId) {
        await updateDoc(doc(db, 'comunicados', editandoId), payload);
        setToast({ show: true, message: 'Comunicado atualizado com sucesso!', variant: 'success' });
      } else {
        await addDoc(collection(db, 'comunicados'), payload);
        setToast({ show: true, message: 'Comunicado enviado com sucesso!', variant: 'success' });
      }
      setShowModal(false);
      limparFormulario();
      fetchData();
      setPaginaAtual(1);
    } catch (err) {
      console.error(err);
      setToast({ show: true, message: 'Erro ao salvar comunicado.', variant: 'danger' });
    }
  };

  const handleEditar = (comunicado: Comunicado) => {
    setEditandoId(comunicado.id);
    setAssunto(comunicado.assunto);
    setMensagem(comunicado.mensagem);
    setTurmaId(comunicado.turmaId);
    setShowModal(true);
  };

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Excluir este comunicado?')) return;
    try {
      await deleteDoc(doc(db, 'comunicados', id));
      setToast({ show: true, message: 'Comunicado excluído.', variant: 'success' });
      fetchData();
    } catch (err) {
      console.error(err);
      setToast({ show: true, message: 'Erro ao excluir comunicado.', variant: 'danger' });
    }
  };

  const limparFormulario = () => {
    setAssunto('');
    setMensagem('');
    setTurmaId('');
    setEditandoId(null);
  };

  const turmasDisponiveis = turmas;

  const comunicadosFiltrados = comunicados.filter(c =>
    c.assunto.toLowerCase().includes(busca.toLowerCase()) ||
    c.mensagem.toLowerCase().includes(busca.toLowerCase()) ||
    (c.turmaNome || '').toLowerCase().includes(busca.toLowerCase())
  );

  const totalPaginas = Math.ceil(comunicadosFiltrados.length / itensPorPagina);
  const comunicadosPaginados = comunicadosFiltrados.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

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
                    <Megaphone size={24} color="#fff" />
                  </div>
                  <div>
                    <h2 className="fs-3 fw-bold text-dark mb-0">Comunicados</h2>
                    <p className="text-muted mb-0" style={{ fontSize: 14 }}>
                      MobClassApp - Portal do Professor
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Col md={6}>
            <InputGroup>
              <FormControl
                placeholder="Buscar por assunto, mensagem ou turma"
                value={busca}
                onChange={e => { setBusca(e.target.value); setPaginaAtual(1); }}
              />
              {isAdmin && (
                <Button onClick={() => { limparFormulario(); setShowModal(true); }}>
                  Novo Comunicado
                </Button>
              )}
            </InputGroup>
          </Col>
        </Row>

        <Table responsive bordered hover>
          <thead className="table-light">
            <tr>
              <th>Assunto</th>
              <th>Mensagem</th>
              <th>Turma</th>
              <th>Data</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {comunicadosPaginados.map(c => (
              <tr key={c.id}>
                <td>{c.assunto}</td>
                <td style={{ whiteSpace: 'pre-line' }}>{c.mensagem}</td>
                <td>{c.turmaNome || turmas.find(t => t.id === c.turmaId)?.nome || '-'}</td>
                <td>{c.data?.toDate().toLocaleString('pt-BR')}</td>
                <td>
                  <Dropdown align="end">
                    <Dropdown.Toggle variant="light" size="sm">
                      <i className="bi bi-three-dots-vertical"></i>
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      <Dropdown.Item onClick={() => handleEditar(c)}>
                        <i className="bi bi-pencil me-2"></i> Editar
                      </Dropdown.Item>
                      {isAdmin && (
                        <Dropdown.Item onClick={() => handleExcluir(c.id)}>
                          <i className="bi bi-trash me-2"></i> Excluir
                        </Dropdown.Item>
                      )}
                    </Dropdown.Menu>
                  </Dropdown>
                </td>
              </tr>
            ))}
            {comunicadosPaginados.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center">Nenhum comunicado encontrado.</td>
              </tr>
            )}
          </tbody>
        </Table>

        <Paginacao
          paginaAtual={paginaAtual}
          totalPaginas={totalPaginas}
          aoMudarPagina={setPaginaAtual}
        />

        <Modal show={showModal} onHide={() => setShowModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar Comunicado' : 'Novo Comunicado'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Turma</Form.Label>
                <Form.Select value={turmaId} onChange={e => setTurmaId(e.target.value)}>
                  <option value="">Todas as turmas</option>
                  {turmasDisponiveis.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Assunto</Form.Label>
                <Form.Control id="input-assunto" value={assunto} onChange={e => setAssunto(e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Mensagem</Form.Label>
                <Form.Control as="textarea" rows={8} value={mensagem} onChange={e => setMensagem(e.target.value)} />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSalvar}>{editandoId ? 'Atualizar' : 'Salvar'}</Button>
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









