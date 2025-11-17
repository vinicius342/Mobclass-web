// src/pages/Comunicados.tsx - Atualizado para permitir professores criarem comunicados e usar vínculos
import { useEffect, useState } from 'react';
import React from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Button, Modal, Form, ToastContainer, Toast, Row, Col, FormControl,
  Card, Badge,
  // ProgressBar
} from 'react-bootstrap';
import { PlusCircle, CheckCircle, Clock, FileEarmark, Calendar } from 'react-bootstrap-icons';
import { X } from 'lucide-react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp, getDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useAnoLetivoAtual } from '../hooks/useAnoLetivoAtual';
import Paginacao from '../components/Paginacao';
import { Megaphone, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

// Imports para DatePicker
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ptBR } from "date-fns/locale";
import { registerLocale } from "react-datepicker";

// Registrar locale português
registerLocale("pt-BR", ptBR as any);

interface Comunicado {
  id: string;
  assunto: string;
  mensagem: string;
  turmaId: string;
  turmaNome: string;
  data: Timestamp;
  status: 'enviado' | 'agendado' | 'rascunho';
  dataAgendamento?: Timestamp;
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
  const { anoLetivo } = useAnoLetivoAtual();

  // Componente CustomDateInput para usar com DatePicker
  type CustomDateInputProps = {
    value?: string;
    onClick?: () => void;
  };
  
  const CustomDateInput = React.forwardRef<HTMLInputElement, CustomDateInputProps>(
    ({ value, onClick }, ref) => {
      return (
        <div
          onClick={onClick}
          ref={ref as React.Ref<HTMLDivElement>}
          className="position-relative"
          style={{ width: "100%" }}
        >
          <input
            type="text"
            value={value}
            readOnly
            className="form-control"
            placeholder="Selecione data e hora"
            autoComplete="off"
            style={{ width: "100%", paddingRight: "2.5rem" }}
          />
          <Calendar
            size={18}
            className="position-absolute"
            style={{
              top: "50%",
              right: "10px",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "#6c757d"
            }}
          />
        </div>
      );
    }
  );

  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [, setVinculos] = useState<Vinculo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [status, setStatus] = useState<'enviado' | 'agendado' | 'rascunho'>('enviado');
  const [dataAgendamento, setDataAgendamento] = useState<Date | null>(null);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' as 'success' | 'danger' });

  const [busca, setBusca] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroAssunto, setFiltroAssunto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const itensPorPagina = 6;
  const maxCaracteres = 150;

  useEffect(() => {
    fetchData();
  }, [userData, anoLetivo]);

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
      const turmaSnap = await getDocs(query(collection(db, 'turmas'), where('anoLetivo', '==', anoLetivo.toString())));
      turmaDocs = turmaSnap.docs;
    } else {
      const vincSnap = await getDocs(query(collection(db, 'professores_materias'), where('professorId', '==', userData?.uid)));
      const vincList = vincSnap.docs.map(d => d.data() as Vinculo);
      setVinculos(vincList);
      const turmaIds = [...new Set(vincList.map(v => v.turmaId))];
      const turmaDocsTemp = await Promise.all(turmaIds.map(async id => await getDoc(doc(db, 'turmas', id))));
      // Filtrar apenas turmas do ano letivo atual
      turmaDocs = turmaDocsTemp.filter(d => d.data()?.anoLetivo?.toString() === anoLetivo.toString());
    }

    const listaTurmas = turmaDocs
      .map(d => ({ id: d.id, nome: d.data()?.nome || '-' }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setTurmas(listaTurmas);

    const comunicadosQuery = isAdmin
      ? query(collection(db, 'comunicados'), orderBy('data', 'desc'))
      : query(collection(db, 'comunicados'), where('turmaId', 'in', listaTurmas.map(t => t.id)), orderBy('data', 'desc'));

    const snap = await getDocs(comunicadosQuery);
    const lista = snap.docs.map(d => ({ 
      id: d.id, 
      ...(d.data() as any),
      status: d.data().status || 'enviado'
    })) as Comunicado[];
    setComunicados(lista);
  };

  const handleSalvar = async () => {
    if (!assunto || !mensagem) return;
    
    // Validar data de agendamento se status for agendado
    if (status === 'agendado' && !dataAgendamento) {
      setToast({ show: true, message: 'Data de agendamento é obrigatória para comunicados agendados.', variant: 'danger' });
      return;
    }

    // Validar se pelo menos uma turma foi selecionada
    if (turmasSelecionadas.length === 0) {
      setToast({ show: true, message: 'Selecione pelo menos uma turma.', variant: 'danger' });
      return;
    }

    try {
      if (editandoId) {
        // No modo edição, mantém o comportamento antigo (uma turma)
        const turmaSelecionada = turmas.find(t => t.id === turmaId);
        const payload: any = {
          assunto,
          mensagem,
          turmaId,
          turmaNome: turmaSelecionada?.nome || '',
          data: Timestamp.now(),
          status,
        };

        // Adicionar data de agendamento se status for agendado
        if (status === 'agendado' && dataAgendamento) {
          payload.dataAgendamento = Timestamp.fromDate(dataAgendamento);
        }

        await updateDoc(doc(db, 'comunicados', editandoId), payload);
        setToast({ show: true, message: 'Comunicado atualizado com sucesso!', variant: 'success' });
      } else {
        // No modo criação, cria um comunicado para cada turma selecionada
        let turmasParaCriar: string[] = [];
        
        // Se "todas" foi selecionado, usar todas as turmas disponíveis
        if (turmasSelecionadas.includes('todas')) {
          turmasParaCriar = turmasDisponiveis.map(t => t.id);
        } else {
          turmasParaCriar = turmasSelecionadas;
        }

        for (const turmaIdSelecionada of turmasParaCriar) {
          const turmaSelecionada = turmas.find(t => t.id === turmaIdSelecionada);
          const payload: any = {
            assunto,
            mensagem,
            turmaId: turmaIdSelecionada,
            turmaNome: turmaSelecionada?.nome || '',
            data: Timestamp.now(),
            status,
          };

          // Adicionar data de agendamento se status for agendado
          if (status === 'agendado' && dataAgendamento) {
            payload.dataAgendamento = Timestamp.fromDate(dataAgendamento);
          }

          await addDoc(collection(db, 'comunicados'), payload);
        }
        setToast({ show: true, message: `Comunicado criado para ${turmasParaCriar.length} turma(s)!`, variant: 'success' });
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
    setTurmasSelecionadas([comunicado.turmaId]);
    setStatus(comunicado.status);
    
    // Definir data de agendamento se existir
    if (comunicado.dataAgendamento) {
      setDataAgendamento(comunicado.dataAgendamento.toDate());
    }
    
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
    setTurmasSelecionadas([]);
    setStatus('enviado');
    setDataAgendamento(null);
    setEditandoId(null);
  };

  const limparFiltros = () => {
    setFiltroTurma('');
    setFiltroAssunto('');
    setFiltroStatus('');
    setBusca('');
    setPaginaAtual(1);
  };

  const toggleMessage = (id: string) => {
    setExpandedMessages(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const turmasDisponiveis = turmas;
  const assuntosDisponiveis = [...new Set(comunicados.map(c => c.assunto))].sort();

  const comunicadosFiltrados = comunicados.filter(c => {
    const matchBusca = c.assunto.toLowerCase().includes(busca.toLowerCase()) ||
      c.mensagem.toLowerCase().includes(busca.toLowerCase()) ||
      (c.turmaNome || '').toLowerCase().includes(busca.toLowerCase());
    
    const matchTurma = filtroTurma === '' || c.turmaId === filtroTurma;
    const matchAssunto = filtroAssunto === '' || c.assunto === filtroAssunto;
    const matchStatus = filtroStatus === '' || c.status === filtroStatus;
    
    return matchBusca && matchTurma && matchAssunto && matchStatus;
  });

  const totalPaginas = Math.ceil(comunicadosFiltrados.length / itensPorPagina);
  const comunicadosPaginados = comunicadosFiltrados.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

  return (
    <AppLayout>
      <Container className="my-4">
        <div className="border-gray-200 mb-3">
          <div className="mb-4 px-1">
            <div className="d-flex align-items-center gap-2 mb-1">
              <Megaphone size={32} color="#2563eb" style={{ minWidth: 32, minHeight: 32 }} />
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
                Comunicados
              </h1>
            </div>
            <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
              Envie e gerencie comunicados para as turmas
            </p>
          </div>
        </div>

        {/* Botão de Novo Comunicado no canto direito - Desktop */}
        <div className="d-none d-md-flex justify-content-end mb-3">
          {isAdmin && (
            <Button variant="primary" onClick={() => { limparFormulario(); setShowModal(true); }}>
              <PlusCircle className="me-2" size={18} />
              Novo Comunicado
            </Button>
          )}
        </div>

        {/* Campo de busca dentro de Card */}
        <Card className="shadow-sm mb-3">
          <Card.Body>
            <FormControl
              placeholder="Buscar por assunto, mensagem ou turma"
              value={busca}
              onChange={e => { setBusca(e.target.value); setPaginaAtual(1); }}
              style={{ borderRadius: '8px', padding: '12px 16px' }}
            />
          </Card.Body>
        </Card>

        {/* Filtros dentro de Card */}
        <Card className="mb-3 shadow-sm">
          <Card.Body>
            <Row className="align-items-center">
              <Col md={3}>
                <Form.Group>
                  <Form.Select
                    value={filtroTurma}
                    onChange={e => { setFiltroTurma(e.target.value); setPaginaAtual(1); }}
                    style={{ fontSize: '14px' }}
                  >
                    <option value="" disabled hidden>Filtrar por turma</option>
                    <option value="">Todas</option>
                    {turmasDisponiveis.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={3}>
                <Form.Group>
                  <Form.Select
                    value={filtroAssunto}
                    onChange={e => { setFiltroAssunto(e.target.value); setPaginaAtual(1); }}
                    style={{ fontSize: '14px' }}
                  >
                    <option value="" disabled hidden>Filtrar por assunto</option>
                    <option value="">Todos</option>
                    {assuntosDisponiveis.map(assunto => (
                      <option key={assunto} value={assunto}>{assunto}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={3}>
                <Form.Group>
                  <Form.Select
                    value={filtroStatus}
                    onChange={e => { setFiltroStatus(e.target.value); setPaginaAtual(1); }}
                    style={{ fontSize: '14px' }}
                  >
                    <option value="" disabled hidden>Filtrar por status</option>
                    <option value="">Todos</option>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              {/* Botão Desktop */}
              <Col md={3} className="d-none d-md-flex justify-content-center align-items-center">
                <Button variant="link" onClick={limparFiltros} className="text-muted p-0 d-flex align-items-center justify-content-center" style={{ fontSize: '14px', textDecoration: 'none' }}>
                  <X className="me-2" size={18} />
                  Limpar filtros
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Botão Limpar Filtros - Mobile */}
        <div className="w-100 mb-2 d-block d-md-none">
          <Row>
            <Col>
              <Button
                onClick={limparFiltros}
                className="w-100 d-flex align-items-center justify-content-center gap-2 bg-white"
                style={{ color: 'black', border: '1px solid #e1e7ef' }}
              >
                <X size={20} />
                Limpar Filtros
              </Button>
            </Col>
          </Row>
        </div>

        {/* Botão de Novo Comunicado - Mobile */}
        {isAdmin && (
          <div className="w-100 mb-3 d-block d-md-none">
            <Row>
              <Col>
                <Button 
                  variant="primary" 
                  className="w-100 d-flex align-items-center justify-content-center gap-2"
                  onClick={() => { limparFormulario(); setShowModal(true); }}
                >
                  <PlusCircle size={20} />
                  Novo Comunicado
                </Button>
              </Col>
            </Row>
          </div>
        )}

        {/* Cards dos Comunicados verticalmente agrupados */}
        <div className="d-flex flex-column gap-4">
          {comunicadosPaginados.map(c => (
            <Card key={c.id} className="w-100 mb-0" style={{ borderRadius: '20px', transition: 'all 0.2s ease' }}>
              <Card.Body className="p-3">
                {/* Header do Card com Título e Status */}
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div className="flex-grow-1 d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                    <h3 className="fs-5 fw-bold text-dark mb-0 mb-1" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                      {c.assunto}
                    </h3>
                    <Badge
                      className={`status-badge ${c.status}`}
                      style={{ flexShrink: 0 }}
                    >
                      {/* Ícone + texto do status */}
                      {c.status === 'enviado' || (c.status !== 'agendado' && c.status !== 'rascunho') ? (
                        <>
                          <CheckCircle size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Enviado
                        </>
                      ) : c.status === 'agendado' ? (
                        <>
                          <Clock size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Agendado
                        </>
                      ) : (
                        <>
                          <FileEarmark size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Rascunho
                        </>
                      )}
                    </Badge>
                  </div>
                  <div className="d-flex gap-2 align-items-center justify-content-center" style={{ alignSelf: 'center', flexShrink: 0 }}>
                    <Button
                      variant="link"
                      className="p-0 text-primary d-flex align-items-center px-2"
                      style={{ fontSize: '1rem' }}
                      onClick={() => handleEditar(c)}
                      title="Editar"
                    >
                      <Edit size={18} />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="link"
                        className="p-0 text-danger d-flex align-items-center px-2"
                        style={{ fontSize: '1rem' }}
                        onClick={() => handleExcluir(c.id)}
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </Button>
                    )}
                  </div>
                </div>
                {/* Turma e Data abaixo do título, lado a lado */}
                <div className="d-flex align-items-center gap-3 mb-2" style={{ marginLeft: '2px' }}>
                  <p style={{ color: '#6c757d', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: 0 }}>
                    Turma: {(c.turmaNome === '-' || c.turmaId === '') ? 'Todas as turmas' : (c.turmaNome || turmas.find(t => t.id === c.turmaId)?.nome || '-')}
                  </p>
                  <small style={{ color: '#6c757d', fontSize: '0.8rem' }}>
                    {c.status === 'agendado' && c.dataAgendamento 
                      ? `Agendado para: ${c.dataAgendamento.toDate().toLocaleDateString('pt-BR', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}`
                      : `Criado em: ${c.data?.toDate().toLocaleDateString('pt-BR')}`
                    }
                  </small>
                </div>
                {/*
                Barra de Progresso de Leitura
                <div className="mb-3">
                  <div className="d-flex align-items-center mb-1" style={{ width: '70%', minHeight: '24px' }}>
                    <div className="d-flex align-items-center w-100">
                      // Definição de percent e barColor fora do bloco para uso no style da porcentagem
                      {(() => {
                        return null;
                      })()}
                      {(() => {
                        // Definir percent e barColor para uso abaixo
                        // ...existing code...
                        return null;
                      })()}
                      {(() => {
                        // ...existing code...
                        return null;
                      })()}
                      // Cálculo da cor e percent para barra e porcentagem
                      {(() => {
                        const percent = ((c.leituras || 0) / (c.totalAlunos || 1)) * 100;
                        let barColor = '#22c55e'; // verde enviado
                        if (c.status === 'agendado') barColor = '#3b82f6'; // azul agendado
                        if (c.status === 'rascunho') barColor = '#facc15'; // amarelo rascunho
                        const barStyle = {
                          height: '8px',
                          borderRadius: '7px',
                          width: '100%',
                          backgroundColor: '#e9ecef',
                          '--bs-progress-bar-bg': barColor,
                        } as React.CSSProperties;
                        return (
                          <>
                            <ProgressBar
                              now={percent}
                              style={barStyle}
                              variant={undefined}
                            />
                            <span
                              style={{
                                marginLeft: 12,
                                fontSize: '0.8rem',
                                color: barColor,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                height: '100%'
                              }}
                            >
                              {Math.round(percent)}% leram
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                */}
                {/* Mensagem com Expandir/Recolher com efeito suave */}
                <div className="mb-3">
                  <div
                    className={`comunicado-mensagem-transicao${expandedMessages[c.id] ? ' expanded' : ''}`}
                    style={{ fontSize: '0.9rem', color: '#495057', lineHeight: '1.5', overflow: 'hidden', transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1)' }}
                  >
                    <div style={{ paddingRight: 2 }}>
                      {expandedMessages[c.id] ? c.mensagem : truncateText(c.mensagem, maxCaracteres)}
                    </div>
                  </div>
                  {c.mensagem.length > maxCaracteres && (
                    <div style={{ textAlign: 'left', marginTop: 4 }}>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0" 
                        onClick={() => toggleMessage(c.id)}
                        style={{ fontSize: '0.85rem', textDecoration: 'none', marginLeft: 0, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        {expandedMessages[c.id] ? (
                          <>
                            <ChevronUp size={16} style={{ marginRight: 2 }} /> Ler menos
                          </>
                        ) : (
                          <>
                            <ChevronDown size={16} style={{ marginRight: 2 }} /> Ler mais
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>

        {/* Mensagem quando não há comunicados */}
        {comunicadosPaginados.length === 0 && (
          <Card className="text-center py-5" style={{ borderRadius: '12px', border: '2px dashed #dee2e6' }}>
            <Card.Body>
              <Megaphone size={48} color="#6c757d" className="mb-3" />
              <h5 style={{ color: '#6c757d' }}>Nenhum comunicado encontrado</h5>
              <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                {busca || filtroTurma || filtroAssunto || filtroStatus ? 'Tente ajustar os filtros' : 'Seja o primeiro a criar um comunicado'}
              </p>
            </Card.Body>
          </Card>
        )}

        {/* Paginação */}
        {totalPaginas > 1 && (
          <Paginacao
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            aoMudarPagina={setPaginaAtual}
          />
        )}

        {/* Modal de Criar/Editar */}
        <Modal show={showModal} onHide={() => setShowModal(false)} centered>
          <Modal.Header closeButton style={{ borderBottom: 'none' }}>
            <Modal.Title>{editandoId ? 'Editar Comunicado' : 'Novo Comunicado'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontWeight: 'bold' }}>Selecione as turmas</Form.Label>
                <div
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      padding: 12,
                      maxHeight: 220,
                      overflowY: 'auto',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      margin: '0 auto',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Checkbox "Todas as turmas" */}
                    <Form.Check
                      type="checkbox"
                      id="turma-todas"
                      label="Todas as turmas"
                      checked={turmasSelecionadas.includes('todas')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          // Selecionar "todas" e desmarcar turmas específicas
                          setTurmasSelecionadas(['todas']);
                        } else {
                          // Desmarcar "todas"
                          setTurmasSelecionadas([]);
                        }
                      }}
                      disabled={editandoId !== null}
                      style={{ fontWeight: turmasSelecionadas.includes('todas') ? 'bold' : 'normal' }}
                    />
                    
                    {/* Checkboxes das turmas individuais */}
                    {[...turmasDisponiveis].sort((a, b) => a.nome.localeCompare(b.nome)).map(t => (
                      <Form.Check
                        key={t.id}
                        type="checkbox"
                        id={`turma-${t.id}`}
                        label={t.nome}
                        checked={turmasSelecionadas.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Remover "todas" se estiver selecionado e adicionar a turma específica
                            const novasSelecionadas = turmasSelecionadas.filter(id => id !== 'todas');
                            setTurmasSelecionadas([...novasSelecionadas, t.id]);
                          } else {
                            setTurmasSelecionadas(turmasSelecionadas.filter(id => id !== t.id));
                          }
                        }}
                        disabled={editandoId !== null}
                      />
                    ))}
                  </div>
                </div>
                {editandoId && (
                  <Form.Text className="text-muted">
                    Não é possível alterar as turmas ao editar um comunicado
                  </Form.Text>
                )}
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Assunto</Form.Label>
                <Form.Control id="input-assunto" value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Digite o assunto do comunicado" />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Select value={status} onChange={e => setStatus(e.target.value as 'enviado' | 'agendado' | 'rascunho')}>
                  <option value="enviado">Enviado</option>
                  <option value="agendado">Agendado</option>
                  <option value="rascunho">Rascunho</option>
                </Form.Select>
              </Form.Group>
              
              {/* Campo de Data de Agendamento - só aparece se status for agendado */}
              {status === 'agendado' && (
                <Form.Group className="mb-3">
                  <Form.Label>Data e Hora do Agendamento</Form.Label>
                  <DatePicker
                    selected={dataAgendamento}
                    onChange={(date: Date | null) => setDataAgendamento(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="dd/MM/yyyy HH:mm"
                    locale="pt-BR"
                    calendarClassName="custom-calendar-small"
                    customInput={<CustomDateInput />}
                    showPopperArrow={false}
                    autoComplete="off"
                    wrapperClassName="w-100"
                    minDate={new Date()}
                    timeCaption="Hora"
                    placeholderText="Selecione data e hora"
                  />
                  <Form.Text className="text-muted">
                    Selecione quando o comunicado deve ser enviado
                  </Form.Text>
                </Form.Group>
              )}
              
              <Form.Group className="mb-3">
                <Form.Label>Mensagem</Form.Label>
                <Form.Control as="textarea" rows={8} value={mensagem} onChange={e => setMensagem(e.target.value)} placeholder="Digite a mensagem do comunicado" />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer style={{ borderTop: 'none' }}>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSalvar}>{editandoId ? 'Atualizar' : 'Salvar'}</Button>
          </Modal.Footer>
        </Modal>

        {/* Toast de Notificações */}
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









