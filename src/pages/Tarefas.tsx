import { useEffect, useState } from 'react';
import {
  Container, Row, Col, Card, Button, Modal, Form, Dropdown, ButtonGroup, Table
} from 'react-bootstrap';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, getDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import Paginacao from '../components/Paginacao';


// Ícones para o cabeçalho e abas
import { GraduationCap, Plus, Eye, Trash2, ArrowLeft, Edit, ArrowDownUp } from "lucide-react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faX, faCircleExclamation, faCheck, faComment } from '@fortawesome/free-solid-svg-icons';
import { CheckCircle, XCircle, ExclamationCircle } from 'react-bootstrap-icons';

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
  links?: Array<{
    url: string;
    titulo: string;
  }>;
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
  const [links, setLinks] = useState<Array<{ url: string; titulo: string }>>([]);
  const [novoLinkUrl, setNovoLinkUrl] = useState('');
  const [novoLinkTitulo, setNovoLinkTitulo] = useState('');

  const [paginaAtual, setPaginaAtual] = useState(1);
  const tarefasPorPagina = 10;

  // Estado para atividade selecionada
  const [atividadeSelecionada, setAtividadeSelecionada] = useState<Tarefa | null>(null);

  // Estado para abas
  const [activeTab, setActiveTab] = useState<'cadastro' | 'acompanhamento'>('acompanhamento');
  const [entregas, setEntregas] = useState<Entrega[]>([]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tarefaParaExcluir, setTarefaParaExcluir] = useState<Tarefa | null>(null);

  // Estado para ordenação
  const [ordenacao, setOrdenacao] = useState<'titulo' | 'data' | 'status' | 'materia'>('data');

  const exportarPDF = () => {
    if (!atividadeSelecionada) return;

    const doc = new jsPDF();
    doc.text(`Relatório de Acompanhamento - ${atividadeSelecionada.titulo || atividadeSelecionada.descricao}`, 14, 15);

    autoTable(doc, {
      startY: 20,
      head: [['Status', 'Aluno', 'Data Conclusao', 'Anexo']],
      body: alunosFiltrados
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map(aluno => {
          const entrega = entregas.find(e => e.alunoId === aluno.id && e.tarefaId === atividadeSelecionada.id);
          return [
            entrega?.status ?? 'Não entregue',
            aluno.nome,
            entrega?.dataConclusao ? formatarDataBR(entrega.dataConclusao) : '-',
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
        'Data de Conclusão': entrega?.dataConclusao ? formatarDataBR(entrega.dataConclusao) : '-',
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
    setTitulo('');
    setDescricao('');
    setTurmaId('');
    setDataEntrega('');
    setLinks([]);
    setNovoLinkUrl('');
    setNovoLinkTitulo('');
    setEditandoId(null);
    setShowModal(false);
  };

  const handleSalvar = async () => {
    if (!materiaSelecionada || !descricao || !turmaId || !dataEntrega) return;
    if (!userData) return;
    const payload: any = {
      materiaId: materiaSelecionada,
      titulo,
      descricao,
      turmaId,
      dataEntrega,
      professorId: userData.uid
    };
    if (links.length > 0) {
      payload.links = links;
    }
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

    // Prepara os dados para atualização
    const updateData: any = { status };
    if (status === 'concluida') {
      updateData.dataConclusao = new Date().toISOString();
    } else {
      updateData.dataConclusao = null; // Remove a data se não está concluída
    }

    if (entregaExistente) {
      // Atualiza no Firestore
      const entregaRef = doc(db, 'entregas', entregaExistente.id);
      await updateDoc(entregaRef, updateData);

      // Atualiza instantaneamente no estado local
      setEntregas(prev =>
        prev.map(e =>
          e.id === entregaExistente.id ? { ...e, ...updateData } : e
        )
      );
    } else {
      // Cria nova entrega no Firestore
      const novaEntrega = {
        alunoId,
        tarefaId: atividadeSelecionada.id,
        ...updateData
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
    setLinks(tarefa.links || []);
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

  // Funções para gerenciar links
  const adicionarLink = () => {
    if (!novoLinkUrl.trim()) return;

    const novoLink = {
      url: novoLinkUrl.trim(),
      titulo: novoLinkTitulo.trim() || 'Link'
    };

    setLinks(prev => [...prev, novoLink]);
    setNovoLinkUrl('');
    setNovoLinkTitulo('');
  };

  const removerLink = (index: number) => {
    setLinks(prev => prev.filter((_, i) => i !== index));
  };


  function formatarDataBR(data: string) {
    if (!data) return '-';
    const d = new Date(data);
    if (isNaN(d.getTime())) return data;
    return d.toLocaleDateString('pt-BR');
  }

  return (
    <AppLayout>
      <Container className="my-4">
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <div className="border-gray-200 mb-3">
            <div className="mb-4 px-1">
              <div className="d-flex align-items-center gap-2 mb-1">
                <GraduationCap size={32} color="#2563eb" style={{ minWidth: 32, minHeight: 32 }} />
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
                  Gerenciamento de Tarefas
                </h1>
              </div>
              <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
                MobClassApp - Portal do Professor
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="container px-0">
            <div className="d-flex py-3">
              <div className="custom-tabs-container w-100">
                <button
                  className={`custom-tab ${activeTab === 'cadastro' ? 'active' : ''}`}
                  onClick={() => setActiveTab('cadastro')}
                  type="button"
                  style={{ flex: 1 }}
                >
                  Cadastro de Atividade
                </button>
                <button
                  className={`custom-tab ${activeTab === 'acompanhamento' ? 'active' : ''}`}
                  onClick={() => setActiveTab('acompanhamento')}
                  type="button"
                  style={{ flex: 1 }}
                >
                  Acompanhamento
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="container py-0 px-0">
            {activeTab === 'acompanhamento' && (
              <>
                <Card className="mb-3">
                  <Card.Body>
                    <Row>
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
                  </Card.Body>
                </Card>

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
                    <>
                      {/* Desktop */}
                      <div className="d-none d-md-block">
                        <Card className="shadow-sm">
                          <Card.Body>
                            <div className="d-flex justify-content-between align-items-center mb-3 px-3">
                              <h3 className="mb-0">Lista de Tarefas</h3>
                              <div className="d-flex align-items-center gap-2">
                                {tarefasFiltradas.length > 0 && !atividadeSelecionada && (
                                  <span className="text-muted px-2" style={{ fontSize: 14 }}>
                                    Clique em uma atividade para acompanhar as entregas dos alunos
                                  </span>
                                )}
                                {tarefasFiltradas.length > 0 && (
                                  <Dropdown onSelect={key => setOrdenacao(key as any)}>
                                    <Dropdown.Toggle
                                      size="sm"
                                      variant="outline-secondary"
                                      id="dropdown-ordenar-tarefas"
                                      className="d-flex align-items-center gap-2 py-1 px-2"
                                    >
                                      <ArrowDownUp size={16} />
                                      Ordenar
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu>
                                      <Dropdown.Item eventKey="titulo" active={ordenacao === 'titulo'}>Título</Dropdown.Item>
                                      <Dropdown.Item eventKey="data" active={ordenacao === 'data'}>Data de Entrega</Dropdown.Item>
                                    </Dropdown.Menu>
                                  </Dropdown>
                                )}
                              </div>
                            </div>
                            {/* Cabeçalho da lista */}
                            {/* Cabeçalho agora está dentro do Table */}
                            {/* Lista de atividades */}
                            <div>
                              {tarefasFiltradas.length > 0 ? (
                                <Table responsive hover className="mb-0 align-middle">
                                  <thead>
                                    <tr>
                                      <th style={{ width: '35%' }} className='text-muted px-3'>Título</th>
                                      <th style={{ width: '28%' }} className='text-muted px-3'>Descrição</th>
                                      <th style={{ width: '13%', textAlign: 'center' }} className='text-muted'>Data Entrega</th>
                                      <th style={{ width: '9%', textAlign: 'center' }} className='text-muted'>Status</th>
                                      <th style={{ width: '15%', textAlign: 'center', paddingRight: 0 }} className='text-muted'>Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {tarefasFiltradas
                                      .slice()
                                      .sort((a, b) => {
                                        switch (ordenacao) {
                                          case 'titulo':
                                            return (a.titulo || 'Sem título').localeCompare(b.titulo || 'Sem título');
                                          case 'data':
                                            return new Date(b.dataEntrega).getTime() - new Date(a.dataEntrega).getTime();
                                          default:
                                            return 0;
                                        }
                                      })
                                      .map(tarefa => (
                                        <tr key={tarefa.id} style={{ cursor: 'pointer', borderBottom: 'white' }} onClick={() => setAtividadeSelecionada(tarefa)}>
                                          <td className="py-3 px-3" style={{ width: '35%' }}>
                                            <span style={{ fontSize: '1rem', fontWeight: 500 }}>
                                              {tarefa.titulo ? tarefa.titulo : tarefa.descricao || 'Sem título'}
                                            </span>
                                          </td>
                                          <td className="py-3 px-3" style={{ width: '28%' }}>
                                            <span style={{ color: '#6b7280' }}>
                                              {tarefa.descricao ? tarefa.descricao : tarefa.titulo || 'Sem descrição'}
                                            </span>
                                          </td>
                                          <td className="py-3 px-3" style={{ width: '13%', textAlign: 'center' }}>{formatarDataBR(tarefa.dataEntrega)}</td>
                                          <td className="py-3 px-3" style={{ width: '12%', textAlign: 'center' }}>
                                            {(() => {
                                              const hoje = new Date();
                                              const dataEntrega = tarefa.dataEntrega ? new Date(tarefa.dataEntrega) : null;
                                              if (dataEntrega) {
                                                if (dataEntrega.getTime() < new Date(hoje.setHours(0, 0, 0, 0)).getTime()) {
                                                  return <span className="status-badge enviado">Concluída</span>;
                                                } else {
                                                  return <span className="status-badge agendado">Em andamento</span>;
                                                }
                                              }
                                              return <span className="status-badge rascunho">Sem data</span>;
                                            })()}
                                          </td>
                                          <td className="py-3 px-3" style={{ width: '12%', textAlign: 'center', paddingRight: 0 }} onClick={e => e.stopPropagation()}>
                                            <Dropdown align="end">
                                              <Dropdown.Toggle
                                                variant="light"
                                                size="sm"
                                                style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
                                                className="dropdown-toggle-no-caret"
                                                id={`dropdown-acao-tarefa-${tarefa.id}`}
                                              >
                                                ⋯
                                              </Dropdown.Toggle>
                                              <Dropdown.Menu>
                                                <Dropdown.Item
                                                  onClick={() => setAtividadeSelecionada(tarefa)}
                                                  className="d-flex align-items-center gap-2"
                                                >
                                                  <Eye size={16} /> Acompanhar
                                                </Dropdown.Item>
                                                <Dropdown.Item
                                                  onClick={() => editarTarefa(tarefa.id)}
                                                  className="d-flex align-items-center gap-2 text-primary"
                                                >
                                                  <Edit size={16} /> Editar
                                                </Dropdown.Item>
                                                <Dropdown.Item
                                                  onClick={() => {
                                                    setTarefaParaExcluir(tarefa);
                                                    setShowDeleteModal(true);
                                                  }}
                                                  className="d-flex align-items-center gap-2 text-danger"
                                                >
                                                  <Trash2 size={16} /> Excluir
                                                </Dropdown.Item>
                                              </Dropdown.Menu>
                                            </Dropdown>
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </Table>
                              ) : (
                                <div className="text-center text-muted py-5">
                                  <FontAwesomeIcon icon={faCircleExclamation} size="2x" className="mb-3" />
                                  <div>Nenhuma atividade encontrada para esta turma e matéria.</div>
                                </div>
                              )}
                            </div>
                          </Card.Body>
                        </Card>
                      </div>
                      {/* Mobile */}
                      <div className="d-block d-md-none materias-mobile-cards">
                        <div className="materias-header-mobile mb-3">
                          <div className="d-flex align-items-center justify-content-between">
                            <h3 className="mb-0">Tarefas</h3>
                            {tarefasFiltradas.length > 0 && (
                              <Dropdown onSelect={key => setOrdenacao(key as any)}>
                                <Dropdown.Toggle
                                  size="sm"
                                  variant="outline-secondary"
                                  id="dropdown-ordenar-tarefas-mobile"
                                  className="d-flex align-items-center gap-1 py-1 px-2"
                                >
                                  <ArrowDownUp size={14} />
                                  <span className="d-none d-sm-inline">Ordenar</span>
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                  <Dropdown.Item eventKey="titulo" active={ordenacao === 'titulo'}>Título</Dropdown.Item>
                                  <Dropdown.Item eventKey="data" active={ordenacao === 'data'}>Data de Entrega</Dropdown.Item>
                                </Dropdown.Menu>
                              </Dropdown>
                            )}
                          </div>
                        </div>
                        {tarefasFiltradas.length > 0 ? (
                          <div className="materias-grid-mobile">
                            {tarefasFiltradas
                              .slice() // cria uma cópia para não mutar o array original
                              .sort((a, b) => {

                                switch (ordenacao) {
                                  case 'titulo':
                                    return (a.titulo || 'Sem título').localeCompare(b.titulo || 'Sem título');
                                  case 'data':
                                    return new Date(b.dataEntrega).getTime() - new Date(a.dataEntrega).getTime(); // decrescente
                                  default:
                                    return 0;
                                }
                              })
                              .map(tarefa => (
                                <div key={tarefa.id} className="materias-card-mobile" style={{ marginBottom: 16 }}>
                                  <div className="materias-card-header">
                                    <div className="materias-card-info">
                                      <div className="materias-card-title">{tarefa.titulo || 'Sem título'}</div>
                                      <div className="materias-card-codigo">{tarefa.descricao}</div>
                                    </div>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 22 }}>
                                      {(() => {
                                        const hoje = new Date();
                                        const dataEntrega = tarefa.dataEntrega ? new Date(tarefa.dataEntrega) : null;
                                        if (dataEntrega) {
                                          if (dataEntrega.getTime() < new Date(hoje.setHours(0, 0, 0, 0)).getTime()) {
                                            return <span className="status-badge enviado">Concluída</span>;
                                          } else {
                                            return <span className="status-badge agendado">Em andamento</span>;
                                          }
                                        }
                                        return <span className="status-badge rascunho">Sem data</span>;
                                      })()}
                                    </span>
                                  </div>
                                  <div className="materias-card-actions">
                                    {tarefa.links && tarefa.links.length > 0 && (
                                      <div className="mb-2">
                                        <small className="text-muted fw-semibold">Links:</small>
                                        <div className="d-flex flex-wrap gap-1 mt-1">
                                          {tarefa.links.map((link, index) => (
                                            <a
                                              key={index}
                                              href={link.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="btn btn-sm btn-outline-primary"
                                              style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                            >
                                              🔗 {link.titulo}
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <button
                                      className="materias-action-btn materias-edit-btn"
                                      onClick={() => setAtividadeSelecionada(tarefa)}
                                    >
                                      <Eye size={18} /> Acompanhar
                                    </button>
                                    <button
                                      className="materias-action-btn"
                                      style={{ background: '#f3f4f6', color: '#2563eb' }}
                                      onClick={() => editarTarefa(tarefa.id)}
                                    >
                                      <Edit size={18} /> Editar
                                    </button>
                                    <button
                                      className="materias-action-btn materias-delete-btn"
                                      onClick={() => {
                                        setTarefaParaExcluir(tarefa);
                                        setShowDeleteModal(true);
                                      }}
                                    >
                                      <Trash2 size={18} /> Excluir
                                    </button>
                                  </div>
                                </div>
                              ))})
                          </div>
                        ) : (
                          <div className="materias-empty-state">
                            <div className="materias-empty-icon">
                              <FontAwesomeIcon icon={faX} size="2x" />
                            </div>
                            <h5 className="materias-empty-title">Nenhuma tarefa encontrada</h5>
                            <p className="materias-empty-text">Nenhuma atividade para esta turma/matéria.</p>
                          </div>
                        )}
                      </div>
                    </>
                  )
                ) : (
                  <>
                    {/* Botões desktop acima da lista de alunos */}
                    <Row className="align-items-center mb-3 d-none d-md-flex">
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

                    {/* Lista de alunos como cards, padrão Materias.tsx */}
                    <div className="alunos-list-desktop d-none d-md-block">
                      <Card>
                        <Card.Body>
                          <h3 className="mb-3 px-3">Lista de Alunos</h3>
                          <div className="d-flex justify-content-between px-3 py-2 border-bottom fw-bold text-muted" style={{ fontSize: '1rem', fontWeight: 600 }}>
                            <div style={{ width: '8%', textAlign: 'center' }}>Status</div>
                            <div style={{ width: '32%' }}>Nome</div>
                            <div style={{ width: '16%', textAlign: 'center' }}>Data Conclusão</div>
                            <div style={{ width: '12%', textAlign: 'center' }}>Anexo</div>
                            <div style={{ width: '12%', textAlign: 'center' }}>Observações</div>
                            <div style={{ width: '16%', textAlign: 'center' }}>Entregue?</div>
                          </div>
                          <div>
                            {alunosFiltrados
                              .sort((a, b) => a.nome.localeCompare(b.nome))
                              .slice((paginaAtual - 1) * tarefasPorPagina, paginaAtual * tarefasPorPagina)
                              .map(aluno => {
                                const entrega = entregas.find(e =>
                                  e.alunoId === aluno.id &&
                                  e.tarefaId === atividadeSelecionada.id
                                );
                                return (
                                  <Card key={aluno.id} className="custom-card-frequencia" style={{ borderBottom: '1px solid #f1f3f4' }}>
                                    <Card.Body className="d-flex justify-content-between align-items-center py-3 px-3">
                                      <div style={{ width: '8%', textAlign: 'center' }}>
                                        {entrega?.status === 'concluida' ? (
                                          <CheckCircle color="#22c55e" size={20} title="Entregue" />
                                        ) : entrega?.status === 'nao_entregue' ? (
                                          <XCircle color="#dc3545" size={20} title="Não entregue" />
                                        ) : (
                                          <ExclamationCircle color="#6c757d" size={20} title="Pendente" />
                                        )}
                                      </div>
                                      <div style={{ width: '32%' }}>
                                        <span className="aluno-nome-frequencia" style={{ fontSize: '1rem' }}>{aluno.nome}</span>
                                      </div>
                                      <div style={{ width: '16%', textAlign: 'center' }}>{entrega?.dataConclusao ? formatarDataBR(entrega.dataConclusao) : '-'}</div>
                                      <div style={{ width: '12%', textAlign: 'center' }}>
                                        {entrega?.anexoUrl ? (
                                          <a href={entrega.anexoUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6" }}>
                                            Ver Anexo
                                          </a>
                                        ) : (
                                          <span style={{ color: "rgb(33 37 41 / 75%)" }}>Sem anexo</span>
                                        )}
                                      </div>
                                      <div style={{ width: '12%', textAlign: 'center' }}>
                                        <FontAwesomeIcon
                                          icon={faComment}
                                          size="lg"
                                          style={{
                                            color:
                                              entrega?.observacoes && entrega.observacoes.trim() !== ""
                                                ? "#FFC107"
                                                : "#212529",
                                            cursor: "pointer"
                                          }}
                                          onClick={() => {
                                            openObsModal(entrega ? entrega.id : "", entrega?.observacoes || "");
                                          }}
                                        />
                                      </div>
                                      <div style={{ width: '16%', textAlign: 'center' }}>
                                        <ButtonGroup className="aluno-btn-group">
                                          <Button
                                            variant="outline-success"
                                            size="sm"
                                            className={`aluno-btn-action${entrega?.status === 'concluida' ? ' active-btn-success' : ''}`}
                                            style={{ borderRight: 'none' }}
                                            title="Confirmar entrega"
                                            active={entrega?.status === 'concluida'}
                                            onClick={() => atualizarEntrega(aluno.id, 'concluida')}
                                          >
                                            <FontAwesomeIcon icon={faCheck} /> <span className="d-none d-md-inline">Sim</span>
                                          </Button>
                                          <Button
                                            variant="outline-danger"
                                            size="sm"
                                            className={`aluno-btn-action${entrega?.status === 'nao_entregue' ? ' active-btn-danger' : ''}`}
                                            title="Marcar como não entregue"
                                            style={{ borderLeft: 'none' }}
                                            active={entrega?.status === 'nao_entregue'}
                                            onClick={() => atualizarEntrega(aluno.id, 'nao_entregue')}
                                          >
                                            <FontAwesomeIcon icon={faX} /> <span className="d-none d-md-inline">Não</span>
                                          </Button>
                                        </ButtonGroup>
                                      </div>
                                    </Card.Body>
                                  </Card>
                                );
                              })}
                          </div>
                        </Card.Body>
                      </Card>
                      <Paginacao
                        paginaAtual={paginaAtual}
                        totalPaginas={Math.ceil(alunosFiltrados.length / tarefasPorPagina)}
                        aoMudarPagina={setPaginaAtual}
                      />
                    </div>

                    {/* Versão Mobile */}
                    <div className="alunos-mobile-cards d-block d-md-none">
                      <div className="materias-header-mobile mb-3 d-flex flex-column gap-2">
                        <h3 className="mb-0">Alunos</h3>
                        <div className="d-flex gap-2 flex-wrap">
                          <button
                            className="materias-action-btn materias-edit-btn"
                            style={{ minWidth: 0, flex: 1 }}
                            onClick={() => setAtividadeSelecionada(null)}
                          >
                            <ArrowLeft size={18} /> Voltar
                          </button>
                          <button
                            className="materias-action-btn"
                            style={{ background: '#f3f4f6', color: '#2563eb', minWidth: 0, flex: 1 }}
                            onClick={exportarPDF}
                          >
                            <FontAwesomeIcon icon={faCheck} /> PDF
                          </button>
                          <button
                            className="materias-action-btn"
                            style={{ background: '#e0f7e9', color: '#22c55e', minWidth: 0, flex: 1 }}
                            onClick={exportarExcel}
                          >
                            <FontAwesomeIcon icon={faCheck} /> Excel
                          </button>
                        </div>
                      </div>
                      {alunosFiltrados.length > 0 ? (
                        <div className="materias-grid-mobile">
                          {alunosFiltrados
                            .sort((a, b) => a.nome.localeCompare(b.nome))
                            .slice((paginaAtual - 1) * tarefasPorPagina, paginaAtual * tarefasPorPagina)
                            .map(aluno => {
                              const entrega = entregas.find(e =>
                                e.alunoId === aluno.id &&
                                e.tarefaId === atividadeSelecionada.id
                              );
                              return (
                                <div key={aluno.id} className="materias-card-mobile" style={{ marginBottom: 16 }}>
                                  <div className="materias-card-header">
                                    <div className="materias-card-info">
                                      <div className="materias-card-title">{aluno.nome}</div>
                                    </div>
                                    <span
                                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22 }}
                                      title={
                                        entrega?.status === 'concluida'
                                          ? 'Entregue'
                                          : entrega?.status === 'nao_entregue'
                                            ? 'Não entregue'
                                            : 'Pendente'
                                      }
                                    >
                                      {entrega?.status === 'concluida' ? (
                                        <CheckCircle color="#22c55e" size={20} title="Entregue" />
                                      ) : entrega?.status === 'nao_entregue' ? (
                                        <XCircle color="#dc3545" size={20} title="Não entregue" />
                                      ) : (
                                        <ExclamationCircle color="#6c757d" size={20} title="Pendente" />
                                      )}
                                    </span>
                                  </div>
                                  <div className="materias-card-actions materias-card-actions-mobile">
                                    <div className="aluno-btn-group-mobile" style={{ display: 'flex', width: '100%' }}>
                                      <button
                                        className="materias-action-btn materias-edit-btn aluno-btn-mobile-left"
                                        style={{ flex: 1, borderRadius: '8px 0 0 8px', borderRight: '1px solid #fff', margin: 0 }}
                                        onClick={() => atualizarEntrega(aluno.id, 'concluida')}
                                      >
                                        <FontAwesomeIcon icon={faCheck} /> Confirmar
                                      </button>
                                      <button
                                        className="materias-action-btn materias-delete-btn aluno-btn-mobile-right"
                                        style={{ flex: 1, borderRadius: '0 8px 8px 0', borderLeft: '1px solid #fff', margin: 0 }}
                                        onClick={() => atualizarEntrega(aluno.id, 'nao_entregue')}
                                      >
                                        <FontAwesomeIcon icon={faX} /> Não Entregue
                                      </button>
                                    </div>
                                    <button
                                      className="materias-action-btn aluno-btn-mobile-obs"
                                      style={{ background: '#f3f4f6', color: '#212529', width: '100%', marginTop: 8, borderRadius: 8 }}
                                      onClick={() => openObsModal(entrega ? entrega.id : '', entrega?.observacoes || '')}
                                    >
                                      <FontAwesomeIcon icon={faComment} /> Obs
                                    </button>
                                    {entrega?.anexoUrl && (
                                      <a
                                        href={entrega.anexoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="materias-action-btn aluno-btn-mobile-anexo"
                                        style={{ background: '#e0e7ef', color: '#2563eb', width: '100%', marginTop: 8, borderRadius: 8 }}
                                      >
                                        Anexo
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="materias-empty-state">
                          <div className="materias-empty-icon">
                            <FontAwesomeIcon icon={faX} size="2x" />
                          </div>
                          <h5 className="materias-empty-title">Nenhum aluno encontrado</h5>
                          <p className="materias-empty-text">Nenhum aluno para esta turma/matéria.</p>
                        </div>
                      )}
                      <div className="mt-3 d-flex justify-content-center">
                        <Paginacao
                          paginaAtual={paginaAtual}
                          totalPaginas={Math.ceil(alunosFiltrados.length / tarefasPorPagina)}
                          aoMudarPagina={setPaginaAtual}
                        />
                      </div>
                    </div>
                  </>
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

                  {/* Seção de Links */}
                  <Form.Group className="mb-3">
                    <Form.Label>Links de Referência</Form.Label>

                    {/* Adicionar novo link */}
                    <div className="border rounded p-3 mb-2" style={{ backgroundColor: '#f8f9fa' }}>
                      <div className="mb-2">
                        <Form.Control
                          type="text"
                          placeholder="Título do link"
                          value={novoLinkTitulo}
                          onChange={e => setNovoLinkTitulo(e.target.value)}
                          className="mb-2"
                        />
                        <div className="d-flex gap-2">
                          <Form.Control
                            type="url"
                            placeholder="https://exemplo.com"
                            value={novoLinkUrl}
                            onChange={e => setNovoLinkUrl(e.target.value)}
                          />
                          <Button
                            variant="outline-primary"
                            onClick={adicionarLink}
                            disabled={!novoLinkUrl.trim()}
                          >
                            <Plus size={16} />
                          </Button>
                        </div>
                      </div>
                      <small className="text-muted">
                        Adicione links úteis para a atividade (vídeos, artigos, materiais de apoio, etc.)
                      </small>
                    </div>

                    {/* Lista de links adicionados */}
                    {links.length > 0 && (
                      <div className="border rounded p-2">
                        <small className="text-muted fw-semibold d-block mb-2">Links adicionados:</small>
                        {links.map((link, index) => (
                          <div key={index} className="d-flex align-items-center justify-content-between p-2 mb-1 bg-light rounded">
                            <div className="flex-grow-1">
                              <div className="fw-medium" style={{ fontSize: '0.9rem' }}>
                                {link.titulo}
                              </div>
                              <div className="text-muted" style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                                {link.url}
                              </div>
                            </div>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => removerLink(index)}
                              className="ms-2"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
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




















