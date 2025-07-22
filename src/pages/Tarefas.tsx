import { useEffect, useState } from 'react';
import {
  Container, Row, Col, Card, Button, Modal, Form, Table
} from 'react-bootstrap';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, getDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import AppLayout from '../components/AppLayout';
// TODO: Resolver depois
// import { PlusCircle } from 'react-bootstrap-icons';
import { useAuth } from '../contexts/AuthContext';
import Paginacao from '../components/Paginacao';


// Ícones para o cabeçalho e abas
import { GraduationCap, Plus, Eye, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faX, faCircleExclamation, faCheck, faComment } from '@fortawesome/free-solid-svg-icons';

//PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// XLSX
import * as XLSX from 'xlsx';
import React from 'react';

interface Entrega {
  id: string;
  alunoId: string;
  tarefaId: string;
  dataEntrega: string;
  status: string;
  dataConclusao?: string;
  anexoUrl?: string;
  observacoes?: string;
}


interface Aluno {
  id: string;
  nome: string;
  turmaId: string;
}

interface Tarefa {
  id: string;
  materiaId: string;
  titulo?: string;
  descricao: string;
  turmaId: string;
  dataEntrega: string;
  excluida?: boolean;
}

interface Turma {
  id: string;
  nome: string;
}

interface Materia {
  id: string;
  nome: string;
}

interface Vinculo {
  professorId: string;
  materiaId: string;
  turmaId: string;
}

export default function Tarefas() {
  const { userData } = useAuth()!;
  const isAdmin = userData?.tipo === 'administradores';

  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);

  const [] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroMateria, setFiltroMateria] = useState('');
  const [, setLoading] = useState(true);
  const [alunos, setAlunos] = useState<Aluno[]>([]);


  const [showModal, setShowModal] = useState(false);
  const [materiaSelecionada, setMateriaSelecionada] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [dataEntrega, setDataEntrega] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [paginaAtual, setPaginaAtual] = useState(1);
  const tarefasPorPagina = 10;

  // Estado para atividade selecionada
  const [atividadeSelecionada, setAtividadeSelecionada] = useState<Tarefa | null>(null);

  // Estado para abas
  const [activeTab, setActiveTab] = useState<'cadastro' | 'acompanhamento'>('acompanhamento');
  const [entregas, setEntregas] = useState<Entrega[]>([]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tarefaParaExcluir, setTarefaParaExcluir] = useState<Tarefa | null>(null);

  const exportarPDF = () => {
    if (!atividadeSelecionada) return;

    const doc = new jsPDF();
    doc.text(`Relatório de Acompanhamento - ${atividadeSelecionada.titulo || atividadeSelecionada.descricao}`, 14, 15);

    autoTable(doc, {
      startY: 20,
      head: [['Aluno', 'Status', 'Data Conclusão', 'Anexo']],
      body: alunosFiltrados
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map(aluno => {
          const entrega = entregas.find(e => e.alunoId === aluno.id && e.tarefaId === atividadeSelecionada.id);
          return [
            aluno.nome,
            entrega?.status ?? 'Não entregue',
            entrega?.dataConclusao ?? '-',
            entrega?.anexoUrl ? 'Sim' : 'Não'
          ];
        })
    });

    doc.save(`acompanhamento_${atividadeSelecionada.titulo || atividadeSelecionada.descricao}.pdf`);
  };

  const exportarExcel = () => {
    if (!atividadeSelecionada) return;

    const data = alunosFiltrados.map(aluno => {
      const entrega = entregas.find(e => e.alunoId === aluno.id && e.tarefaId === atividadeSelecionada.id);
      return {
        Aluno: aluno.nome,
        Status: entrega?.status ?? 'Não entregue',
        'Data de Conclusão': entrega?.dataConclusao ?? '-',
        Anexo: entrega?.anexoUrl ? 'Sim' : 'Não'
      };
    });

    // Cria a planilha
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Define a largura das colunas (opcional)
    worksheet['!cols'] = [
      { wch: 35 }, // Aluno
      { wch: 15 }, // Status
      { wch: 20 }, // Data de Conclusão
      { wch: 10 }  // Anexo
    ];

    // Cria o workbook e adiciona a aba
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Acompanhamento');

    // Salva o arquivo
    XLSX.writeFile(
      workbook,
      `acompanhamento_${atividadeSelecionada.titulo || atividadeSelecionada.descricao}.xlsx`
    );
  };

  useEffect(() => {
    if (!userData) return;
    fetchData();
  }, [userData]);

  const handleSaveObs = async () => {
  if (!editingId) return;

  try {
    // Atualizar no Firebase
    await updateDoc(doc(db, "entregas", editingId), {
      observacoes: currentObs,
    });

    // Atualizar estado local da lista de entregas
    setEntregas(prev => prev.map(item => 
      item.id === editingId ? { ...item, observacoes: currentObs } : item
    ));

    setShowObsModal(false);
    setEditingId(null);
    setCurrentObs('');
  } catch (error) {
    console.error("Erro ao salvar observação:", error);
    // Você pode mostrar um alerta aqui para o usuário
  }
};

  const fetchData = async () => {
    setLoading(true);

    let turmaDocs = [];
    if (isAdmin) {
      turmaDocs = (await getDocs(collection(db, 'turmas'))).docs;
    } else {
      let vincSnap;
      if (!userData) {
        setLoading(false);
        return;
      }
      vincSnap = await getDocs(query(collection(db, 'professores_materias'), where('professorId', '==', userData.uid)));
      const vincList = vincSnap.docs.map(d => d.data() as Vinculo);
      setVinculos(vincList);

      const turmaIds = [...new Set(vincList.map(v => v.turmaId))];
      turmaDocs = await Promise.all(
        turmaIds.map(async id => await getDoc(doc(db, 'turmas', id)))
      );
    }
    setTurmas(turmaDocs.map(d => ({ id: d.id, nome: d.data()?.nome || '-' })));

    const vincSnap = isAdmin
      ? await getDocs(collection(db, 'professores_materias'))
      : userData
        ? await getDocs(query(collection(db, 'professores_materias'), where('professorId', '==', userData.uid)))
        : { docs: [] };

    const vincList = vincSnap.docs.map(d => d.data() as Vinculo);
    setVinculos(vincList);

    const entregasSnap = await getDocs(collection(db, 'entregas'));
    setEntregas(entregasSnap.docs.map(doc => {
      const { id: _id, ...data } = doc.data() as Entrega;
      return { id: doc.id, ...data };
    }));

    const materiaIds = [...new Set(vincList.map(v => v.materiaId))];
    const materiasSnap = await Promise.all(
      materiaIds.map(async id => {
        const m = await getDoc(doc(db, 'materias', id));
        return { id: m.id, nome: m.data()?.nome || '-' };
      })
    );
    setMaterias(materiasSnap);

    const tarefasSnap = await getDocs(collection(db, 'tarefas'));
    const tarefasFiltradas = isAdmin
      ? tarefasSnap.docs
      : tarefasSnap.docs.filter(doc => materiaIds.includes(doc.data().materiaId));

    setTurmas(turmaDocs.map(d => ({ id: d.id, nome: d.data()?.nome || '-' })));
    setTarefas(tarefasFiltradas.map(d => ({ id: d.id, ...(d.data() as any) })));
    setLoading(false);
    const alunosSnap = await getDocs(collection(db, 'alunos'));
    setAlunos(alunosSnap.docs.map(doc => {
      const data = doc.data() as Omit<Aluno, 'id'>;
      return { ...data, id: doc.id };
    }));

  };

  const handleClose = () => {
    setMateriaSelecionada('');
    setDescricao('');
    setTurmaId('');
    setDataEntrega('');
    setEditandoId(null);
    setShowModal(false);
  };

  const handleSalvar = async () => {
    if (!materiaSelecionada || !descricao || !turmaId || !dataEntrega) return;
    if (!userData) return;
    const payload = { materiaId: materiaSelecionada, titulo, descricao, turmaId, dataEntrega, professorId: userData.uid };
    if (editandoId) {
      await updateDoc(doc(db, 'tarefas', editandoId), payload);
    } else {
      await addDoc(collection(db, 'tarefas'), payload);
    }
    handleClose();
    fetchData();
  };
  const atualizarEntrega = async (alunoId: string, status: string) => {
    if (!atividadeSelecionada) return;

    // Procura entrega existente para este aluno e tarefa
    const entregaExistente = entregas.find(
      e => e.alunoId === alunoId && e.tarefaId === atividadeSelecionada.id
    );

    if (entregaExistente) {
      // Atualiza no Firestore
      const entregaRef = doc(db, 'entregas', entregaExistente.id);
      await updateDoc(entregaRef, { status });

      // Atualiza instantaneamente no estado local
      setEntregas(prev =>
        prev.map(e =>
          e.id === entregaExistente.id ? { ...e, status } : e
        )
      );
    } else {
      // Cria nova entrega no Firestore
      const novaEntrega = {
        alunoId,
        tarefaId: atividadeSelecionada.id,
        status,
        dataEntrega: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'entregas'), novaEntrega);

      // Atualiza instantaneamente no estado local
      setEntregas(prev => [
        ...prev,
        { id: docRef.id, ...novaEntrega }
      ]);
    }
  };


  const alunosFiltrados = filtroTurma
    ? alunos.filter(aluno => aluno.turmaId === filtroTurma)
    : [];

  // Filtra as tarefas conforme turma e matéria selecionadas
  const tarefasFiltradas = tarefas.filter(
    t => t.turmaId === filtroTurma && t.materiaId === filtroMateria && !t.excluida
  );

  // Função para editar tarefa
  const editarTarefa = (tarefaId: string) => {
    const tarefa = tarefas.find(t => t.id === tarefaId);
    if (!tarefa) return;
    setEditandoId(tarefa.id);
    setMateriaSelecionada(tarefa.materiaId);
    setTitulo(tarefa.titulo || '');
    setDescricao(tarefa.descricao);
    setTurmaId(tarefa.turmaId);
    setDataEntrega(tarefa.dataEntrega);
    setShowModal(true); // <-- aqui abre o modal
  };

  // Função para excluir tarefa
  const excluirTarefa = async (tarefaId: string) => {
    // Exclui a tarefa
    await deleteDoc(doc(db, 'tarefas', tarefaId));

    // Busca todas as entregas relacionadas a essa tarefa
    const entregasQuery = query(collection(db, 'entregas'), where('tarefaId', '==', tarefaId));
    const entregasSnap = await getDocs(entregasQuery);

    // Exclui cada entrega relacionada
    const promises = entregasSnap.docs.map(entregaDoc => deleteDoc(doc(db, 'entregas', entregaDoc.id)));
    await Promise.all(promises);

    fetchData();
  };

  const [showObsModal, setShowObsModal] = React.useState(false);
  const [currentObs, setCurrentObs] = React.useState(''); // texto da observação que está editando
  const [editingId, setEditingId] = React.useState<string | null>(null); // id da linha que está editando


  const openObsModal = (id: string, obs: string) => {
    setEditingId(id);
    setCurrentObs(obs);
    setShowObsModal(true);
  };


  function formatarDataBR(data: string) {
    if (!data) return '-';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  return (
    <AppLayout>
      <Container className="my-4">
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <div className="bg-white border-bottom border-gray-200">
            <div className="container px-4">
              <div className="d-flex align-items-center justify-content-between py-4">
                <div className="d-flex align-items-center gap-3">
                  <div className="d-flex align-items-center justify-content-center rounded bg-primary" style={{ width: 48, height: 48 }}>
                    <GraduationCap size={24} color="#fff" />
                  </div>
                  <div>
                    <h2 className="fs-3 fw-bold text-dark mb-0">Gerenciamento de Tarefas</h2>
                    <p className="text-muted mb-0" style={{ fontSize: 14 }}>MobClassApp - Portal do Professor</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white border-bottom border-gray-200">
            <div className="container px-4">
              <div className="d-flex gap-3 py-3">
                <Button
                  variant={activeTab === 'cadastro' ? 'primary' : 'outline-primary'}
                  className="d-flex align-items-center gap-2"
                  onClick={() => setActiveTab('cadastro')}
                >
                  <Plus size={18} />
                  <span>Cadastro de Atividade</span>
                </Button>
                <Button
                  variant={activeTab === 'acompanhamento' ? 'primary' : 'outline-primary'}
                  className="d-flex align-items-center gap-2"
                  onClick={() => setActiveTab('acompanhamento')}
                >
                  <Eye size={18} />
                  <span>Acompanhamento</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="container py-4">
            {activeTab === 'acompanhamento' && (
              <>
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Select
                      value={filtroTurma}
                      onChange={e => {
                        setFiltroTurma(e.target.value);
                        setFiltroMateria('');
                        setAtividadeSelecionada(null);
                      }}
                    >
                      <option value="">Selecione a turma</option>
                      {[...turmas].sort((a, b) => a.nome.localeCompare(b.nome)).map(t => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Select
                      value={filtroMateria}
                      onChange={e => {
                        setFiltroMateria(e.target.value);
                        setAtividadeSelecionada(null);
                      }}
                      disabled={!filtroTurma}
                    >
                      <option value="">Selecione a matéria</option>
                      {materias.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </Form.Select>
                  </Col>
                </Row>

                {!atividadeSelecionada ? (
                  (!filtroTurma || !filtroMateria) ? (
                    <Card className="shadow-sm">
                      <Card.Body>
                        <div className="text-center text-muted py-5">
                          <FontAwesomeIcon icon={faCircleExclamation} size="2x" className="mb-3" />
                          <div>Selecione a turma e atividade para visualizar os alunos.</div>
                        </div>
                      </Card.Body>
                    </Card>
                  ) : (
                    <Card className="shadow-sm">
                      <Card.Body>
                        <Table bordered hover responsive>
                          <thead className="table-light">
                            <tr>
                              <th className="text-center">Status</th>
                              <th className="text-center">Título</th>
                              <th className="text-center">Descrição</th>
                              <th className="text-center">Data Entrega</th>
                              <th className="text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tarefasFiltradas.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center text-muted" style={{ borderBottom: '1px solid #dee2e6', background: '#fff' }}>
                                  Nenhuma atividade encontrada para esta turma e matéria.
                                </td>
                              </tr>
                            ) : (
                              tarefasFiltradas.map(tarefa => (
                                <tr
                                  key={tarefa.id}
                                  style={{
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #dee2e6',
                                    background: '#fff'
                                  }}
                                  onClick={() => setAtividadeSelecionada(tarefa)}
                                >
                                  <td className="text-center" style={{ border: 'none', borderBottom: '1px solid #dee2e6', background: '#fff' }}>
                                    {(() => {
                                      const hoje = new Date();
                                      const dataEntrega = tarefa.dataEntrega ? new Date(tarefa.dataEntrega) : null;

                                      if (dataEntrega) {
                                        if (dataEntrega.getTime() < new Date(hoje.setHours(0, 0, 0, 0)).getTime()) {
                                          return <span style={{ color: "#28a745", fontWeight: 500 }}>Concluída</span>;
                                        } else {
                                          return <span style={{ color: "#0d6efd", fontWeight: 500 }}>Em andamento</span>;
                                        }
                                      }

                                      return <span className="text-muted">Sem data</span>;
                                    })()}
                                  </td>
                                  <td className="text-center" style={{ border: 'none', borderBottom: '1px solid #dee2e6', background: '#fff' }}>{tarefa.titulo || tarefa.descricao}</td>
                                  <td className="text-center" style={{ border: 'none', borderBottom: '1px solid #dee2e6', background: '#fff' }}>{tarefa.descricao}</td>
                                  <td className="text-center" style={{ border: 'none', borderBottom: '1px solid #dee2e6', background: '#fff' }}>
                                    {formatarDataBR(tarefa.dataEntrega)}
                                  </td>
                                  <td
                                    className="text-center"
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                      border: 'none',
                                      borderBottom: '1px solid #dee2e6',
                                      background: '#fff',
                                      textAlign: 'center',
                                      verticalAlign: 'middle',
                                      minWidth: '80px'
                                    }}
                                  >
                                    <Button
                                      size="sm"
                                      variant="link"
                                      onClick={() => editarTarefa(tarefa.id)}
                                      style={{ padding: 0, marginRight: 20 }}
                                    >
                                      <Pencil size={18} color="#0d6efd" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="link"
                                      onClick={e => {
                                        e.stopPropagation();
                                        setTarefaParaExcluir(tarefa);
                                        setShowDeleteModal(true);
                                      }}
                                      style={{ padding: 0 }}
                                    >
                                      <Trash2 size={18} color="#dc3545" />
                                    </Button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                  )
                ) : (
                  <>
                    <Row className="align-items-center mb-3">
                      <Col xs="auto">
                        <Button
                          variant="outline-primary"
                          className="d-flex align-items-center gap-2"
                          onClick={() => setAtividadeSelecionada(null)}
                        >
                          <ArrowLeft size={18} />
                          <span>Voltar para lista de atividades</span>
                        </Button>
                      </Col>
                      <Col className="d-flex justify-content-end gap-2">
                        <Button variant="outline-primary" onClick={exportarPDF}>
                          Exportar PDF
                        </Button>
                        <Button variant="outline-success" onClick={exportarExcel}>
                          Exportar Excel
                        </Button>
                      </Col>
                    </Row>

                    {/* Aqui sua tabela existente dos alunos que fizeram a atividade */}
                    <Card className="shadow-sm">
                      <Card.Body>
                        <Table responsive bordered hover>
                          <thead className="table-light">
                            <tr>
                              <th>Status</th>
                              <th>Aluno</th>
                              <th>Data Conclusão</th>
                              <th>Anexo</th>
                              <th>Observações</th>
                              <th>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {alunosFiltrados
                              .sort((a, b) => a.nome.localeCompare(b.nome))
                              .slice((paginaAtual - 1) * tarefasPorPagina, paginaAtual * tarefasPorPagina)
                              .map(aluno => {
                                const entrega = entregas.find(e =>
                                  e.alunoId === aluno.id &&
                                  e.tarefaId === atividadeSelecionada.id
                                );
                                return (
                                  <tr key={aluno.id}>
                                    <td className="text-center">
                                      {/* Status icons */}
                                      {entrega?.status === 'concluida' ? (
                                        <FontAwesomeIcon icon={faCheck} style={{ color: "#2fae2d" }} />
                                      ) : entrega?.status === 'pendente' ? (
                                        <FontAwesomeIcon icon={faCircleExclamation} style={{ color: "#FFD43B" }} />
                                      ) : (
                                        <FontAwesomeIcon icon={faX} style={{ color: "#dc3545" }} />
                                      )}
                                    </td>
                                    <td
                                      style={{
                                        maxWidth: 300,
                                        overflowX: 'auto',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {aluno.nome}
                                    </td>
                                    <td className="text-center">{entrega?.dataConclusao ?? '-'}</td>
                                    <td>
                                      {entrega?.anexoUrl ? (
                                        <a href={entrega.anexoUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6" }}>
                                          Ver Anexo
                                        </a>
                                      ) : (
                                        <span style={{ color: "rgb(33 37 41 / 75%)" }}>Sem anexo</span>
                                      )}
                                    </td>
                                    <td className="text-center">
                                      <FontAwesomeIcon
                                        icon={faComment}
                                        size="lg"
                                        style={{
                                          color:
                                            entrega?.observacoes && entrega.observacoes.trim() !== ""
                                              ? "#FFC107" // amarelo escuro
                                              : "#212529",
                                          cursor: "pointer"
                                        }}
                                        onClick={() => {
                                          openObsModal(entrega ? entrega.id : "", entrega?.observacoes || "");
                                        }}
                                      />
                                    </td>
                                    <td className="d-flex flex-column gap-2" style={{ whiteSpace: 'nowrap' }}>
                                      <div className="d-flex gap-2">
                                        <Button variant="success" size="sm" onClick={() => atualizarEntrega(aluno.id, 'concluida')}>Confirmar</Button>
                                        <Button variant="danger" size="sm" onClick={() => atualizarEntrega(aluno.id, 'nao_entregue')}>Não Entregue</Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </Table>
                        <Paginacao
                          paginaAtual={paginaAtual}
                          totalPaginas={Math.ceil(alunosFiltrados.length / tarefasPorPagina)}
                          aoMudarPagina={setPaginaAtual}
                        />
                      </Card.Body>
                    </Card>
                  </>
                )}

                {/* Aviso abaixo da tabela de atividades */}
                {!atividadeSelecionada && tarefasFiltradas.length > 0 && (
                  <div className="text-center text-muted my-3">
                    Clique em uma atividade para acompanhar as entregas dos alunos
                  </div>
                )}
              </>
            )}

            <Modal show={showObsModal} onHide={() => setShowObsModal(false)}>
              <Modal.Header closeButton>
                <Modal.Title>Editar Observação</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={currentObs}
                  onChange={(e) => setCurrentObs(e.target.value)}
                  placeholder="Digite a observação..."
                />
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowObsModal(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={handleSaveObs}>
                  Salvar
                </Button>
              </Modal.Footer>
            </Modal>


            {activeTab === 'cadastro' && (
              <div className="d-flex flex-column align-items-center justify-content-center py-5">
                <div className="d-flex align-items-center justify-content-center rounded-circle bg-primary bg-opacity-10 mb-3" style={{ width: 64, height: 64 }}>
                  <Plus size={32} color="#0d6efd" />
                </div>
                <h3 className="fw-semibold text-dark mb-2">
                  Formulário de Cadastro de Atividade
                </h3>
                <p className="text-muted mb-4" style={{ maxWidth: 400 }}>
                  Preencha o formulário para cadastrar uma nova atividade.
                </p>
                <Button variant="primary" onClick={() => setShowModal(true)}>
                  <Plus className="me-2" size={18} /> Nova Tarefa
                </Button>
              </div>
            )}

            <Modal show={showModal} onHide={handleClose} centered>
              <Modal.Header closeButton>
                <Modal.Title>
                  <h3 className="text-dark mb-0">{editandoId ? 'Editar Tarefa' : '+ Cadastro de Atividade'}</h3>
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>Turma *</Form.Label>
                    <Form.Select value={turmaId} onChange={e => setTurmaId(e.target.value)}>
                      <option value="">Selecione a turma</option>
                      {[...turmas]
                        .sort((a, b) => a.nome.localeCompare(b.nome))
                        .map(t => (
                          <option key={t.id} value={t.id}>{t.nome}</option>
                        ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Matéria/Disciplina *</Form.Label>
                    <Form.Select
                      value={materiaSelecionada}
                      onChange={e => setMateriaSelecionada(e.target.value)}
                      disabled={!turmaId}
                    >
                      <option value="">Selecione a matéria</option>
                      {vinculos
                        .filter(v => v.turmaId === turmaId)
                        .map(v => {
                          const materia = materias.find(m => m.id === v.materiaId);
                          return materia ? (
                            <option key={materia.id} value={materia.id}>{materia.nome}</option>
                          ) : null;
                        })}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Título da Atividade *</Form.Label>
                    <Form.Control
                      type="text"
                      value={titulo}
                      onChange={e => setTitulo(e.target.value)}
                      placeholder="Digite o título da atividade"
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Descrição da Atividade *</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={descricao}
                      onChange={e => setDescricao(e.target.value)}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Entrega *</Form.Label>
                    <Form.Control
                      type="date"
                      value={dataEntrega}
                      onChange={e => setDataEntrega(e.target.value)}
                    />
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
                <Button variant="primary" onClick={handleSalvar}>Salvar</Button>
              </Modal.Footer>
            </Modal>

            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
              <Modal.Header closeButton>
                <Modal.Title>Excluir Atividade</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <p>
                  Você está prestes a excluir a atividade <strong>
                    {tarefaParaExcluir?.titulo || tarefaParaExcluir?.descricao}
                  </strong>.
                  <br />
                  Deseja continuar?
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    if (tarefaParaExcluir) {
                      await excluirTarefa(tarefaParaExcluir.id);
                      setShowDeleteModal(false);
                      setTarefaParaExcluir(null);
                    }
                  }}
                >
                  Excluir
                </Button>
              </Modal.Footer>
            </Modal>
          </div>
        </div>
      </Container>
    </AppLayout>
  );
}




















