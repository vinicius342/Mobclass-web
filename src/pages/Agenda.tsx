// src/pages/Agenda.tsx - Atualizado para carregar turmas e matérias com base nos vínculos
import { JSX, useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Table, Button, Modal, Form, Tabs, Tab, Row, Col, Dropdown,
} from 'react-bootstrap';
import { Calendar } from "lucide-react";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, getDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { PlusCircle } from 'react-bootstrap-icons';
import { useAuth } from '../contexts/AuthContext';
import Paginacao from '../components/Paginacao';

interface AgendaItem {
  id: string;
  diaSemana: string;
  horario: string;
  materiaId: string;
  turmaId: string;
}
interface Turma {
  id: string;
  nome: string;
}
interface Materia {
  id: string;
  nome: string;
}
interface Professor {
  id: string;
  nome: string;
}

const diasSemana = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
const diasIndexMap = Object.fromEntries(diasSemana.map((d, i) => [d, i]));

export default function Agenda(): JSX.Element {
  const { userData } = useAuth()!;
  const isAdmin = userData?.tipo === 'administradores';

  const [agendaPorTurma, setAgendaPorTurma] = useState<Record<string, AgendaItem[]>>({});
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [vinculos, setVinculos] = useState<{ professorId: string; materiaId: string; turmaId: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [tab, setTab] = useState<'cadastrar' | 'porTurma'>(isAdmin ? 'cadastrar' : 'porTurma');

  const [turmaId, setTurmaId] = useState('');
  const [diaSemana, setDiaSemana] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [filtroCadastroTurma, setFiltroCadastroTurma] = useState('');
  const [filtroVisualizacaoTurma, setFiltroVisualizacaoTurma] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itensPorPagina = 10;

  useEffect(() => {
    const fetchInitial = async () => {
      const profSnap = await getDocs(collection(db, 'professores'));
      let vincSnap;
      if (isAdmin) {
        vincSnap = await getDocs(collection(db, 'professores_materias'));
      } else if (userData && userData.uid) {
        vincSnap = await getDocs(
          query(collection(db, 'professores_materias'), where('professorId', '==', userData.uid))
        );
      } else {
        vincSnap = { docs: [] }; // fallback if userData is null
      }

      const vincList = vincSnap.docs.map(d => d.data() as any);
      setVinculos(vincList);

      const turmaIds = [...new Set(vincList.map(v => v.turmaId))];
      const materiaIds = [...new Set(vincList.map(v => v.materiaId))];

      const turmaDocs = isAdmin
        ? (await getDocs(collection(db, 'turmas'))).docs
        : await Promise.all(turmaIds.map(id => getDoc(doc(db, 'turmas', id))));

      const materiaDocs = isAdmin
        ? (await getDocs(collection(db, 'materias'))).docs
        : await Promise.all(materiaIds.map(id => getDoc(doc(db, 'materias', id))));

      setProfessores(profSnap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
      setMaterias(materiaDocs.map(d => ({ id: d.id, nome: d.data()?.nome || '-' })));
      setTurmas(turmaDocs.map(d => ({ id: d.id, nome: d.data()?.nome || '-' })));
      setLoading(false);
    };
    fetchInitial();
  }, [userData]);

  useEffect(() => {
    if (!loading) fetchAgendaPorTurma();
  }, [loading]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroCadastroTurma]);

  const fetchAgendaPorTurma = async () => {
    const snap = await getDocs(collection(db, 'agenda'));
    const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as AgendaItem[];
    const agrupado: Record<string, AgendaItem[]> = {};
    data.forEach(item => {
      if (!agrupado[item.turmaId]) agrupado[item.turmaId] = [];
      agrupado[item.turmaId].push(item);
    });
    setAgendaPorTurma(agrupado);
  };

  const handleShow = () => setShowModal(true);
  const handleClose = () => {
    setEditId(null);
    setTurmaId('');
    setDiaSemana('');
    setInicio('');
    setFim('');
    setMateriaId('');
    setShowModal(false);
  };

  const handleSalvar = async () => {
    if (!turmaId || !diaSemana || !inicio || !fim || !materiaId) return;
    const horario = `${inicio} - ${fim}`;
    const payload = { turmaId, diaSemana, horario, materiaId };
    if (editId) await updateDoc(doc(db, 'agenda', editId), payload);
    else await addDoc(collection(db, 'agenda'), payload);
    handleClose();
    fetchAgendaPorTurma();
  };

  const handleEditar = (item: AgendaItem) => {
    setEditId(item.id);
    setTurmaId(item.turmaId);
    setDiaSemana(item.diaSemana);
    const [inicioHorario, fimHorario] = item.horario.split(' - ');
    setInicio(inicioHorario);
    setFim(fimHorario);
    setMateriaId(item.materiaId);
    setShowModal(true);
  };

  const handleExcluir = async (id: string) => {
    if (window.confirm('Excluir esta aula?')) {
      await deleteDoc(doc(db, 'agenda', id));
      fetchAgendaPorTurma();
    }
  };

  const getMateriaInfo = (materiaId: string, turmaId?: string) => {
    const materia = materias.find(m => m.id === materiaId);
    if (!materia) return '-';

    const vinculo = vinculos.find(v => v.materiaId === materiaId && (!turmaId || v.turmaId === turmaId));
    const professor = professores.find(p => p.id === vinculo?.professorId);

    return `${materia.nome} (${professor?.nome || '---'})`;
  };

  const dadosOrdenados = Object.values(agendaPorTurma).flat()
    .sort((a, b) => {
      const nomeTurmaA = turmas.find(t => t.id === a.turmaId)?.nome || '';
      const nomeTurmaB = turmas.find(t => t.id === b.turmaId)?.nome || '';
      const nomeDiff = nomeTurmaA.localeCompare(nomeTurmaB);
      if (nomeDiff !== 0) return nomeDiff;
      const diaDiff = diasIndexMap[a.diaSemana] - diasIndexMap[b.diaSemana];
      return diaDiff !== 0 ? diaDiff : a.horario.localeCompare(b.horario);
    });

  const dadosFiltrados = dadosOrdenados.filter(item =>
    !filtroCadastroTurma || item.turmaId === filtroCadastroTurma
  );

  const totalPaginas = Math.ceil(dadosFiltrados.length / itensPorPagina);
  const dadosPaginados = dadosFiltrados.slice((currentPage - 1) * itensPorPagina, currentPage * itensPorPagina);

  return (
    <AppLayout>
      <Container className="my-4">


        <div className="bg-white border-bottom border-gray-200">
          <div className="container px-4">
            <div className="d-flex align-items-center justify-content-between py-4">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="d-flex align-items-center justify-content-center rounded bg-primary"
                  style={{ width: 48, height: 48 }}
                >
                  <Calendar size={24} color="#fff" />
                </div>
                <div>
                  <h2 className="fs-3 fw-bold text-dark mb-0">Agenda de Aulas</h2>
                  <p className="text-muted mb-0" style={{ fontSize: 14 }}>
                    MobClassApp - Portal do Professor
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>


        <Tabs activeKey={tab} onSelect={(k) => setTab(k as any)} className="mb-3">
          {isAdmin && (
            <Tab eventKey="cadastrar" title="Cadastrar">
              <Row className="mb-3">
                <Col md={6} className="text-start">
                  <Form.Select value={filtroCadastroTurma} onChange={e => setFiltroCadastroTurma(e.target.value)}>
                    <option value="">Filtrar por turma</option>
                    {[...turmas].sort((a, b) => a.nome.localeCompare(b.nome)).map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={6} className="text-end">
                  <Button variant="primary" onClick={handleShow}>
                    <PlusCircle className="me-2" size={18} /> Nova Aula
                  </Button>
                </Col>
              </Row>

              <Table responsive bordered hover>
                <thead className="table-light">
                  <tr>
                    <th>Dia</th>
                    <th>Horário</th>
                    <th>Matéria</th>
                    <th>Turma</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosPaginados.map(item => (
                    <tr key={item.id}>
                      <td>{item.diaSemana}</td>
                      <td>{item.horario}</td>
                      <td>{getMateriaInfo(item.materiaId, item.turmaId)}</td>
                      <td>{turmas.find(t => t.id === item.turmaId)?.nome}</td>
                      <td>
                        <Dropdown align="end">
                          <Dropdown.Toggle variant="light" size="sm">
                            <i className="bi bi-three-dots-vertical"></i>
                          </Dropdown.Toggle>
                          <Dropdown.Menu>
                            <Dropdown.Item onClick={() => handleEditar(item)}>
                              <i className="bi bi-pencil-square me-2"></i> Editar
                            </Dropdown.Item>
                            <Dropdown.Item onClick={() => handleExcluir(item.id)}>
                              <i className="bi bi-trash me-2"></i> Excluir
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <Paginacao
                paginaAtual={currentPage}
                totalPaginas={totalPaginas}
                aoMudarPagina={setCurrentPage}
              />
            </Tab>
          )}

          <Tab eventKey="porTurma" title="Visualizar por Turma">
            <Form.Select className="mb-4" value={filtroVisualizacaoTurma} onChange={e => setFiltroVisualizacaoTurma(e.target.value)}>
              <option value="">Filtrar por turma</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Form.Select>
            {turmas
              .filter(t => !filtroVisualizacaoTurma || t.id === filtroVisualizacaoTurma)
              .sort((a, b) => a.nome.localeCompare(b.nome))
              .map(t => (
                <div key={t.id} className="agenda-container">
                  <h5 className="agenda-header">{t.nome}</h5>
                  <Table bordered size="sm" responsive className="agenda-table">
                    <thead>
                      <tr>
                        {diasSemana.map(dia => <th key={dia}>{dia}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {diasSemana.map(dia => (
                          <td key={dia}>
                            {(agendaPorTurma[t.id]?.filter(a => a.diaSemana === dia) || [])
                              .sort((a, b) => a.horario.localeCompare(b.horario))
                              .map((a, idx) => (
                                <div key={idx} className="agenda-entry">
                                  <strong>{a.horario}</strong> - {getMateriaInfo(a.materiaId, a.turmaId)}
                                </div>
                              ))}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </Table>
                </div>
              ))}
          </Tab>
        </Tabs>

        <Modal show={showModal} onHide={handleClose} centered>
          <Modal.Header closeButton>
            <Modal.Title>{editId ? 'Editar Aula' : 'Nova Aula'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Turma</Form.Label>
                <Form.Select value={turmaId} onChange={e => setTurmaId(e.target.value)}>
                  <option value="">Selecione a turma</option>
                  {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Dia da Semana</Form.Label>
                <Form.Select value={diaSemana} onChange={e => setDiaSemana(e.target.value)}>
                  <option value="">Selecione o dia</option>
                  {diasSemana.map(d => <option key={d} value={d}>{d}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Início</Form.Label>
                <Form.Control type="time" value={inicio} onChange={e => setInicio(e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Fim</Form.Label>
                <Form.Control type="time" value={fim} onChange={e => setFim(e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Matéria</Form.Label>
                <Form.Select value={materiaId} onChange={e => setMateriaId(e.target.value)}>
                  <option value="">Selecione a matéria</option>
                  {materias.map(m => (
                    <option key={m.id} value={m.id}>{getMateriaInfo(m.id, turmaId)}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button variant="primary" onClick={handleSalvar}>Salvar</Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </AppLayout>
  );
}

























