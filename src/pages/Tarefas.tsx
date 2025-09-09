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
import { useUrlValidator } from '../hooks/useUrlValidator';

import { GraduationCap, Plus, Eye, Trash2, ArrowLeft, Edit, ArrowDownUp } from "lucide-react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faX, faCircleExclamation, faCheck, faComment } from '@fortawesome/free-solid-svg-icons';
import { CheckCircle, XCircle, ExclamationCircle } from 'react-bootstrap-icons';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import React from 'react';

// -------------------- Tipagens --------------------
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
  bloqueado?: boolean; // (opcional) se quiser marcar tarefa por ter links ruins
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

  // Novo sistema de validação de URLs com segurança avançada
  const { validateUrl, trustedDomains } = useUrlValidator();

  // Função auxiliar para verificar se um link é seguro (async)
  const isSafeLink = async (url: string): Promise<boolean> => {
    try {
      const validation = await validateUrl(url);
      return validation.isValid;
    } catch (error) {
      console.error('Erro na validação de URL:', error);
      return false;
    }
  };

  // Estado para links filtrados (para renderização)
  const [linksSegurosFiltrados, setLinksSegurosFiltrados] = useState<{[tarefaId: string]: Array<{url: string; titulo: string}>}>({});

  // Função para filtrar links seguros de todas as tarefas
  const filtrarLinksSegurosDasTarefas = async (tarefasList: Tarefa[]) => {
    const linksSegurosPorTarefa: {[tarefaId: string]: Array<{url: string; titulo: string}>} = {};
    
    for (const tarefa of tarefasList) {
      if (tarefa.links && tarefa.links.length > 0) {
        const linksValidos = [];
        for (const link of tarefa.links) {
          const isSeguro = await isSafeLink(link.url);
          if (isSeguro) {
            linksValidos.push(link);
          }
        }
        linksSegurosPorTarefa[tarefa.id] = linksValidos;
      } else {
        linksSegurosPorTarefa[tarefa.id] = [];
      }
    }
    
    setLinksSegurosFiltrados(linksSegurosPorTarefa);
  };

  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);

  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroMateria, setFiltroMateria] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, setLoading] = useState(true); // se quiser, troque para const [loading, setLoading] e mostre spinner
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

  const [atividadeSelecionada, setAtividadeSelecionada] = useState<Tarefa | null>(null);
  const [activeTab, setActiveTab] = useState<'cadastro' | 'acompanhamento'>('acompanhamento');
  const [entregas, setEntregas] = useState<Entrega[]>([]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tarefaParaExcluir, setTarefaParaExcluir] = useState<Tarefa | null>(null);

  const [ordenacao, setOrdenacao] = useState<'titulo' | 'data' | 'status' | 'materia'>('data');

  const [showObsModal, setShowObsModal] = React.useState(false);
  const [currentObs, setCurrentObs] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [urlError, setUrlError] = useState('');
  const [urlSuccess, setUrlSuccess] = useState('');
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!userData) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

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

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 35 },
      { wch: 15 },
      { wch: 20 },
      { wch: 10 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Acompanhamento');
    XLSX.writeFile(
      workbook,
      `acompanhamento_${atividadeSelecionada.titulo || atividadeSelecionada.descricao}.xlsx`
    );
  };

  const handleSaveObs = async () => {
    if (!editingId) return;
    try {
      await updateDoc(doc(db, "entregas", editingId), { observacoes: currentObs });
      setEntregas(prev => prev.map(item => (item.id === editingId ? { ...item, observacoes: currentObs } : item)));
      setShowObsModal(false);
      setEditingId(null);
      setCurrentObs('');
    } catch (error) {
      console.error("Erro ao salvar observação:", error);
      alert('Não foi possível salvar a observação.');
    }
  };

  const fetchData = async () => {
    setLoading(true);

    let turmaDocs: any[] = [];
    if (isAdmin) {
      turmaDocs = (await getDocs(collection(db, 'turmas'))).docs;
    } else {
      if (!userData) {
        setLoading(false);
        return;
      }
      const vincSnap = await getDocs(query(collection(db, 'professores_materias'), where('professorId', '==', userData.uid)));
      const vincList = vincSnap.docs.map(d => d.data() as Vinculo);
      setVinculos(vincList);

      const turmaIds = [...new Set(vincList.map(v => v.turmaId))];
      turmaDocs = await Promise.all(
        turmaIds.map(async id => await getDoc(doc(db, 'turmas', id)))
      );
    }
    setTurmas(turmaDocs.map(d => ({ id: d.id, nome: d.data()?.nome || '-' })));

    const vincSnap2 = isAdmin
      ? await getDocs(collection(db, 'professores_materias'))
      : userData
        ? await getDocs(query(collection(db, 'professores_materias'), where('professorId', '==', userData.uid)))
        : { docs: [] as any[] };

    const vincList2 = vincSnap2.docs.map(d => d.data() as Vinculo);
    setVinculos(vincList2);

    const entregasSnap = await getDocs(collection(db, 'entregas'));
    setEntregas(entregasSnap.docs.map(docu => {
      const { id: _id, ...data } = docu.data() as Entrega;
      return { id: docu.id, ...data };
    }));

    const materiaIds = [...new Set(vincList2.map(v => v.materiaId))];
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
      : tarefasSnap.docs.filter(docu => materiaIds.includes(docu.data().materiaId));

    setTurmas(turmaDocs.map(d => ({ id: d.id, nome: d.data()?.nome || '-' })));
    const tarefasProcessadas = tarefasFiltradas.map(d => ({ id: d.id, ...(d.data() as any) }));
    setTarefas(tarefasProcessadas);

    // Filtrar links seguros das tarefas carregadas
    filtrarLinksSegurosDasTarefas(tarefasProcessadas);

    setLoading(false);

    const alunosSnap = await getDocs(collection(db, 'alunos'));
    setAlunos(alunosSnap.docs.map(docu => {
      const data = docu.data() as Omit<Aluno, 'id'>;
      return { ...data, id: docu.id };
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

    // Valida e sanitiza links usando o novo sistema (agora assíncrono)
    const validatedLinks = [];
    for (const link of links) {
      const validation = await validateUrl(link.url);
      if (validation.isValid) {
        validatedLinks.push({
          url: validation.sanitizedUrl || link.url,
          titulo: link.titulo
        });
      }
    }

    const payload: any = {
      materiaId: materiaSelecionada,
      titulo,
      descricao,
      turmaId,
      dataEntrega,
      professorId: userData.uid,
      links: validatedLinks
    };

    // Se houver diferença (links foram removidos por segurança)
    if (links.length > 0 && validatedLinks.length < links.length) {
      payload.bloqueado = false; // Pode marcar como bloqueado se preferir
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
      const entregaRef = doc(db, 'entregas', entregaExistente.id);
      await updateDoc(entregaRef, { status });
      setEntregas(prev => prev.map(e => (e.id === entregaExistente.id ? { ...e, status } : e)));
    } else {
      const novaEntrega = {
        alunoId,
        tarefaId: atividadeSelecionada.id,
        ...updateData
      };
      const docRef = await addDoc(collection(db, 'entregas'), novaEntrega);
      setEntregas(prev => [...prev, { id: docRef.id, ...novaEntrega }]);
    }
  };

  const alunosFiltrados = filtroTurma
    ? alunos.filter(aluno => aluno.turmaId === filtroTurma)
    : [];

  const tarefasFiltradas = tarefas.filter(
    t => t.turmaId === filtroTurma && t.materiaId === filtroMateria && !t.excluida
  );


  const editarTarefa = async (tarefaId: string) => {
    const tarefa = tarefas.find(t => t.id === tarefaId);
    if (!tarefa) return;
    setEditandoId(tarefa.id);
    setMateriaSelecionada(tarefa.materiaId);
    setTitulo(tarefa.titulo || '');
    setDescricao(tarefa.descricao);
    setTurmaId(tarefa.turmaId);
    setDataEntrega(tarefa.dataEntrega);
    // Valida e higieniza os links ao abrir para edição (agora assíncrono)
    const validatedLinks = [];
    if (tarefa.links) {
      for (const link of tarefa.links) {
        const validation = await validateUrl(link.url);
        if (validation.isValid) {
          validatedLinks.push({
            url: validation.sanitizedUrl || link.url,
            titulo: link.titulo
          });
        }
      }
    }
    setLinks(validatedLinks);
    setShowModal(true);
  };

  const excluirTarefa = async (tarefaId: string) => {
    await deleteDoc(doc(db, 'tarefas', tarefaId));
    const entregasQuery = query(collection(db, 'entregas'), where('tarefaId', '==', tarefaId));
    const entregasSnap = await getDocs(entregasQuery);
    const promises = entregasSnap.docs.map(entregaDoc => deleteDoc(doc(db, 'entregas', entregaDoc.id)));
    await Promise.all(promises);
    fetchData();
  };

  const openObsModal = (id: string, obs: string) => {
    setEditingId(id);
    setCurrentObs(obs);
    setShowObsModal(true);
  };

  const adicionarLink = async () => {
    if (!novoLinkUrl.trim()) {
      setUrlError('URL é obrigatória');
      setUrlSuccess('');
      setSecurityWarnings([]);
      return;
    }

    // Usa o novo sistema de validação avançada (agora assíncrono)
    const validation = await validateUrl(novoLinkUrl.trim());

    if (!validation.isValid) {
      setUrlError(`🚫 BLOQUEADO: ${validation.error || 'URL inválida'}`);
      setUrlSuccess('');
      setSecurityWarnings([]);

      // Log detalhado para debug
      console.error('[Security Block]', {
        url: novoLinkUrl.trim(),
        error: validation.error,
        score: validation.securityScore,
        category: validation.domainCategory
      });
      return;
    }

    // URL válida - mostra sucesso e warnings se houver
    setUrlError('');

    // Mostra informações baseadas na categoria do domínio
    const warnings = validation.warnings || [];
    const score = validation.securityScore || 100;
    const category = validation.domainCategory || 'unknown';

    let successMessage = '';

    switch (category) {
      case 'trusted':
        successMessage = `✅ Site confiável validado (Score: ${score}/100)`;
        break;
      case 'educational':
        successMessage = `🎓 Site educacional aceito (Score: ${score}/100)`;
        break;
      case 'unknown':
        if (validation.allowWithWarning) {
          successMessage = `⚠️ Site aceito com verificação extra (Score: ${score}/100)`;
          warnings.unshift('Este site não está na lista de confiáveis, mas passou na verificação de segurança');
        } else {
          successMessage = `✅ URL aceita (Score: ${score}/100)`;
        }
        break;
    }

    if (score < 80) {
      warnings.push(`⚠️ Score de segurança moderado: ${score}/100`);
      console.warn(`[Security Warning] URL com score baixo: ${score}`, validation.warnings);
    }

    setSecurityWarnings(warnings);
    setUrlSuccess(successMessage);

    const novoLink = {
      url: validation.sanitizedUrl || novoLinkUrl.trim(),
      titulo: novoLinkTitulo.trim() || 'Link'
    };

    setLinks(prev => [...prev, novoLink]);
    setNovoLinkUrl('');
    setNovoLinkTitulo('');

    // Limpa mensagens após 5 segundos para dar tempo de ler
    setTimeout(() => {
      setUrlSuccess('');
      setSecurityWarnings([]);
    }, 5000);

    // Log de sucesso
    console.info('[URL Security] Link adicionado com sucesso:', {
      originalUrl: novoLinkUrl.trim(),
      sanitizedUrl: validation.sanitizedUrl,
      score: validation.securityScore,
      category: validation.domainCategory,
      warnings: validation.warnings
    });
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

  // -------------------- Render --------------------
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
                                            {/* Links seguros (se houver) */}
                                            {Array.isArray(tarefa.links) && tarefa.links.length > 0 && (
                                              <div className="mt-1">
                                                <small className="text-muted fw-semibold">Links:</small>{' '}
                                                {(linksSegurosFiltrados[tarefa.id] || []).map((link, idx) => (
                                                  <a
                                                    key={idx}
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="ms-2"
                                                  >
                                                    🔗 {link.titulo || 'link'}
                                                  </a>
                                                ))}
                                                {tarefa.links.length > (linksSegurosFiltrados[tarefa.id]?.length || 0) && (
                                                  <span className="ms-2 text-warning" style={{ fontSize: 12 }}>
                                                    (alguns links foram ocultados por segurança)
                                                  </span>
                                                )}
                                              </div>
                                            )}
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

                                  {/* Links seguros no mobile */}
                                  {Array.isArray(tarefa.links) && tarefa.links.length > 0 && (
                                    <div className="mb-2">
                                      <small className="text-muted fw-semibold">Links:</small>
                                      <div className="d-flex flex-wrap gap-1 mt-1">
                                        {(linksSegurosFiltrados[tarefa.id] || []).map((link, index) => (
                                          <a
                                            key={index}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-sm btn-outline-primary"
                                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                          >
                                            🔗 {link.titulo || 'link'}
                                          </a>
                                        ))}
                                      </div>
                                      {tarefa.links.length > (linksSegurosFiltrados[tarefa.id]?.length || 0) && (
                                        <div className="text-warning" style={{ fontSize: 12 }}>
                                          Alguns links foram ocultados por segurança.
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="materias-card-actions">
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
                              ))}
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

                    {/* Lista de alunos (desktop) */}
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
                                  e.tarefaId === atividadeSelecionada!.id
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
                                e.tarefaId === atividadeSelecionada!.id
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

                  {/* Seção de Links com validação melhorada */}
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
                            onChange={e => {
                              setNovoLinkUrl(e.target.value);
                              if (urlError) setUrlError(''); // Limpa erro ao digitar
                              if (urlSuccess) setUrlSuccess(''); // Limpa sucesso ao digitar
                              if (securityWarnings.length > 0) setSecurityWarnings([]); // Limpa warnings ao digitar
                            }}
                            isInvalid={!!urlError}
                            isValid={!!urlSuccess && !urlError}
                          />
                          <Button
                            variant="outline-primary"
                            onClick={adicionarLink}
                            disabled={!novoLinkUrl.trim()}
                          >
                            <Plus size={16} />
                          </Button>
                        </div>

                        {/* Mensagens de feedback */}
                        {urlError && (
                          <div className="mt-2 p-2 bg-danger bg-opacity-10 border border-danger rounded">
                            <small className="text-danger fw-bold">
                              <FontAwesomeIcon icon={faX} className="me-1" />
                              {urlError}
                            </small>
                          </div>
                        )}

                        {urlSuccess && !urlError && (
                          <div className="mt-2 p-2 bg-success bg-opacity-10 border border-success rounded">
                            <small className="text-success fw-bold">
                              <FontAwesomeIcon icon={faCheck} className="me-1" />
                              {urlSuccess}
                            </small>
                          </div>
                        )}

                        {securityWarnings.length > 0 && !urlError && (
                          <div className="mt-2 p-2 bg-warning bg-opacity-10 border border-warning rounded">
                            <small className="text-warning fw-bold">
                              <FontAwesomeIcon icon={faCircleExclamation} className="me-1" />
                              Avisos de Segurança:
                            </small>
                            <ul className="mb-0 mt-1" style={{ fontSize: '0.75rem' }}>
                              {securityWarnings.map((warning, idx) => (
                                <li key={idx} className="text-warning">{warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <small className="text-muted">
                        <strong>Sites aceitos:</strong> YouTube, Google, Microsoft, *.edu.br, *.gov.br, universidades e plataformas educacionais.
                      </small>
                    </div>

                    {/* Lista de links adicionados */}
                    {links.length > 0 && (
                      <div className="border rounded p-2">
                        <small className="text-muted fw-semibold d-block mb-2">✅ Links adicionados:</small>
                        {links.map((link, index) => (
                          <div key={index} className="d-flex align-items-center justify-content-between p-2 mb-1 bg-light rounded">
                            <div className="flex-grow-1">
                              <div className="fw-medium" style={{ fontSize: '0.9rem' }}>
                                🔗 {link.titulo}
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

                    {/* Lista de domínios confiáveis */}
                    <details className="mt-2">
                      <summary className="text-muted" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                        Ver sites confiáveis permitidos.
                      </summary>
                      <div className="mt-2 p-3 bg-light rounded" style={{ fontSize: '0.8rem' }}>
                        <div className="row">
                          <div className="col-md-6">
                            <strong>🎓 Educacionais:</strong><br />
                            YouTube, Khan Academy, Coursera, Wikipedia, TED, Udemy<br /><br />
                            <strong>📝 Google Services:</strong><br />
                            Docs, Drive, Classroom, Meet, Forms, Sites<br /><br />
                            <strong>💼 Microsoft:</strong><br />
                            Office, OneDrive, Teams, SharePoint<br />
                          </div>
                          <div className="col-md-6">
                            <strong>🇧🇷 Brasileiros:</strong><br />
                            *.gov.br, *.edu.br, USP, UNICAMP, UFRJ, Scielo<br /><br />
                            <strong>💻 Desenvolvimento:</strong><br />
                            GitHub, Stack Overflow, Mozilla, W3Schools<br /><br />
                          </div>
                        </div>
                      </div>
                    </details>
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





















