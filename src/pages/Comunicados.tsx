import { useEffect, useState, useRef } from 'react';
import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import {
  Container, Button, Modal, Form, ToastContainer, Toast, Row, Col, FormControl,
  Card, Badge,
} from 'react-bootstrap';
import { PlusCircle, CheckCircle, Clock, FileEarmark, Calendar } from 'react-bootstrap-icons';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAnoLetivoAtual } from '../hooks/useAnoLetivoAtual';
import Paginacao from '../components/common/Paginacao';
import { Megaphone, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { turmaService } from '../services/data/TurmaService';
import { ProfessorMateriaService } from '../services/data/ProfessorMateriaService';
import { comunicadoService } from '../services/data/ComunicadoService';
import type { Turma } from '../models/Turma';
import type { ProfessorMateria } from '../models/ProfessorMateria';
import type { Comunicado } from '../models/Comunicado';
import { truncateText } from '../utils/textUtils';

// Instanciar services
const professorMateriaService = new ProfessorMateriaService();

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ptBR } from "date-fns/locale";
import { registerLocale } from "react-datepicker";

registerLocale("pt-BR", ptBR as any);

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
  const [showModal, setShowModal] = useState(false);
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoIds, setEditandoIds] = useState<string[]>([]); // IDs de todos os comunicados do grupo
  const [status, setStatus] = useState<'enviado' | 'agendado' | 'rascunho'>('enviado');
  const [dataAgendamento, setDataAgendamento] = useState<Date | null>(null);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' as 'success' | 'danger' });

  const [busca, setBusca] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroAssunto, setFiltroAssunto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const [expandedTurmas, setExpandedTurmas] = useState<Set<string>>(new Set());
  const itensPorPagina = 6;
  const maxCaracteres = 150;
  const isFetchingRef = useRef(false);

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
    if (isFetchingRef.current) return; // Evitar chamadas duplicadas
    isFetchingRef.current = true;

    try {
      let listaTurmas: Turma[] = [];

      if (isAdmin) {
        listaTurmas = await turmaService.listarPorAnoLetivo(anoLetivo.toString());
      } else {
        if (!userData?.email) {
          setTurmas([]);
          setComunicados([]);
          return;
        }

        // Buscar professor pelo email
        const professorService = new (await import('../services/data/ProfessorService')).ProfessorService();
        const allProfessores = await professorService.listar();
        const professorAtual = allProfessores.find((p: any) => p.email === userData.email);

        if (!professorAtual) {
          console.error('Professor não encontrado com email:', userData.email);
          setTurmas([]);
          setComunicados([]);
          return;
        }

        const vincList = await professorMateriaService.listarPorProfessor(professorAtual.id);

        const turmaIds = [...new Set(vincList.map((v: ProfessorMateria) => v.turmaId))];
        const todasTurmas = await turmaService.listarPorAnoLetivo(anoLetivo.toString());
        listaTurmas = todasTurmas.filter((t: Turma) => turmaIds.includes(t.id));
      }

      setTurmas(listaTurmas.sort((a, b) => a.nome.localeCompare(b.nome)));

      let comunicadosList: Comunicado[];
      if (isAdmin) {
        comunicadosList = await comunicadoService.listarPorAnoLetivo(anoLetivo.toString());
      } else {
        const turmaIds = listaTurmas.map(t => t.id);
        comunicadosList = turmaIds.length > 0
          ? await comunicadoService.listarPorTurmas(turmaIds)
          : [];
      }
      setComunicados(comunicadosList);
    } finally {
      isFetchingRef.current = false;
    }
  };

  const handleSalvar = async () => {
    // Validar dados
    const validacao = comunicadoService.validarComunicado({
      assunto,
      mensagem,
      turmasSelecionadas,
      status,
      dataAgendamento,
    });

    if (!validacao.valido) {
      setToast({ show: true, message: validacao.erro || 'Erro de validação', variant: 'danger' });
      return;
    }

    try {
      if (editandoId && editandoIds.length > 0) {
        // Modo edição - atualizar todos os comunicados do grupo
        const promises = editandoIds.map(async (id) => {
          const comunicadoOriginal = comunicados.find(c => c.id === id);
          if (comunicadoOriginal) {
            const turmaSelecionada = turmas.find(t => t.id === comunicadoOriginal.turmaId);
            const payload = comunicadoService.prepararPayloadAtualizacao({
              assunto,
              mensagem,
              turmaId: comunicadoOriginal.turmaId,
              turmaNome: turmaSelecionada?.nome || '',
              status,
              dataAgendamento: dataAgendamento || undefined,
            });

            await comunicadoService.atualizar(id, payload);
          }
        });

        await Promise.all(promises);
        setToast({ show: true, message: `${editandoIds.length} comunicado(s) atualizado(s) com sucesso!`, variant: 'success' });
      } else {
        // Modo criação - determinar turmas
        let turmasParaCriar = turmasSelecionadas.includes('todas')
          ? turmasDisponiveis
          : turmas.filter(t => turmasSelecionadas.includes(t.id));

        const totalCriados = await comunicadoService.criarParaMultiplasTurmas(
          {
            assunto,
            mensagem,
            status,
            dataAgendamento: dataAgendamento || undefined,
          },
          turmasParaCriar
        );

        setToast({ show: true, message: `Comunicado criado para ${totalCriados} turma(s)!`, variant: 'success' });
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

  const handleEditar = (comunicado: any) => {
    setEditandoId(comunicado.id);
    setAssunto(comunicado.assunto);
    setMensagem(comunicado.mensagem);

    // Se o comunicado está agrupado (tem turmasIds), buscar todos os IDs originais
    if (comunicado.turmasIds && Array.isArray(comunicado.turmasIds) && comunicado.turmasIds.length > 0) {
      setTurmasSelecionadas(comunicado.turmasIds);

      // Buscar os IDs originais de todos os comunicados do grupo
      const idsOriginais = comunicados
        .filter(c =>
          c.assunto === comunicado.assunto &&
          c.mensagem === comunicado.mensagem &&
          c.status === comunicado.status &&
          comunicado.turmasIds.includes(c.turmaId)
        )
        .map(c => c.id);

      setEditandoIds(idsOriginais);
    } else {
      setTurmasSelecionadas([comunicado.turmaId]);
      setEditandoIds([comunicado.id]);
    }

    setStatus(comunicado.status);

    // Definir data de agendamento se existir
    if (comunicado.dataAgendamento) {
      setDataAgendamento(comunicado.dataAgendamento.toDate());
    }

    setShowModal(true);
  };

  const handleExcluir = async (comunicado: any) => {
    // Determinar quantos comunicados serão excluídos
    let idsParaExcluir: string[] = [];

    if (comunicado.turmasIds && Array.isArray(comunicado.turmasIds) && comunicado.turmasIds.length > 0) {
      // Comunicado agrupado - buscar todos os IDs originais
      idsParaExcluir = comunicados
        .filter(c =>
          c.assunto === comunicado.assunto &&
          c.mensagem === comunicado.mensagem &&
          c.status === comunicado.status &&
          comunicado.turmasIds.includes(c.turmaId)
        )
        .map(c => c.id);
    } else {
      // Comunicado único
      idsParaExcluir = [comunicado.id];
    }

    const mensagemConfirmacao = idsParaExcluir.length > 1
      ? `Excluir este comunicado de ${idsParaExcluir.length} turmas?`
      : 'Excluir este comunicado?';

    if (!window.confirm(mensagemConfirmacao)) return;

    try {
      // Excluir todos os comunicados do grupo
      await Promise.all(idsParaExcluir.map(id => comunicadoService.deletar(id)));

      setToast({
        show: true,
        message: `${idsParaExcluir.length} comunicado(s) excluído(s).`,
        variant: 'success'
      });
      fetchData();
    } catch (err) {
      console.error(err);
      setToast({ show: true, message: 'Erro ao excluir comunicado.', variant: 'danger' });
    }
  };

  const limparFormulario = () => {
    setAssunto('');
    setMensagem('');
    setTurmasSelecionadas([]);
    setStatus('enviado');
    setDataAgendamento(null);
    setEditandoId(null);
    setEditandoIds([]);
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

  const toggleExpandTurmas = (comunicadoId: string) => {
    setExpandedTurmas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(comunicadoId)) {
        newSet.delete(comunicadoId);
      } else {
        newSet.add(comunicadoId);
      }
      return newSet;
    });
  };

  const renderTurmasBadges = (turmasNomes: string[], comunicadoId: string, maxVisible: number = 2) => {
    if (!turmasNomes || !Array.isArray(turmasNomes) || turmasNomes.length === 0) {
      return <span style={{ color: '#6c757d', fontSize: '0.8rem' }}>Sem turma</span>;
    }

    if (turmasNomes.length === 1) {
      return (
        <span
          style={{
            background: '#e0edff',
            color: '#2563eb',
            fontWeight: 700,
            border: 'none',
            borderRadius: '12px',
            padding: '0.25rem 0.6rem',
            fontSize: '0.75rem',
            letterSpacing: '0.1px',
            lineHeight: 1.1,
            display: 'inline-block'
          }}
        >
          {turmasNomes[0]}
        </span>
      );
    }

    const isExpanded = expandedTurmas.has(comunicadoId);
    const turmasSorted = [...turmasNomes].sort();
    const turmasToShow = isExpanded ? turmasSorted : turmasSorted.slice(0, maxVisible);
    const remainingCount = turmasSorted.length - maxVisible;

    return (
      <>
        {turmasToShow.map((nome, idx) => (
          <span
            key={idx}
            style={{
              background: '#e0edff',
              color: '#2563eb',
              fontWeight: 700,
              border: 'none',
              borderRadius: '12px',
              padding: '0.25rem 0.6rem',
              fontSize: '0.75rem',
              letterSpacing: '0.1px',
              lineHeight: 1.1,
              marginRight: 4,
              marginBottom: 4,
              display: 'inline-block'
            }}
          >
            {nome}
          </span>
        ))}
        {remainingCount > 0 && (
          <span
            onClick={() => toggleExpandTurmas(comunicadoId)}
            style={{
              background: '#f1f5f9',
              color: '#64748b',
              fontWeight: 600,
              border: 'none',
              borderRadius: '12px',
              padding: '0.25rem 0.6rem',
              fontSize: '0.75rem',
              letterSpacing: '0.1px',
              lineHeight: 1.1,
              marginRight: 4,
              marginBottom: 4,
              display: 'inline-block',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#e2e8f0'}
            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = '#f1f5f9'}
          >
            {isExpanded ? 'menos' : `+${remainingCount} mais`}
          </span>
        )}
      </>
    );
  };

  const turmasDisponiveis = turmas;
  const assuntosDisponiveis = comunicadoService.extrairAssuntos(comunicados);

  const comunicadosFiltrados = comunicadoService.aplicarFiltros(comunicados, {
    busca,
    turmaId: filtroTurma,
    assunto: filtroAssunto,
    status: filtroStatus,
  });

  // Agrupar comunicados por assunto + mensagem + status + dataAgendamento (SEM o campo data que varia)
  const comunicadosAgrupados = comunicadosFiltrados.reduce((acc, comunicado) => {
    // Criar chave única baseada APENAS no conteúdo (sem timestamp de criação)
    const dataAgendamentoKey = comunicado.dataAgendamento ? comunicado.dataAgendamento.toMillis() : 'sem-agendamento';
    const chave = `${comunicado.assunto}|${comunicado.mensagem}|${comunicado.status}|${dataAgendamentoKey}`;

    if (!acc[chave]) {
      acc[chave] = {
        ...comunicado,
        turmasIds: [comunicado.turmaId],
        turmasNomes: [comunicado.turmaNome || turmas.find(t => t.id === comunicado.turmaId)?.nome || '-']
      };
    } else {
      // Adicionar turma ao grupo existente se não estiver já incluída
      if (!acc[chave].turmasIds.includes(comunicado.turmaId)) {
        acc[chave].turmasIds.push(comunicado.turmaId);
        acc[chave].turmasNomes.push(comunicado.turmaNome || turmas.find(t => t.id === comunicado.turmaId)?.nome || '-');
      }
    }

    return acc;
  }, {} as Record<string, any>);

  // Converter objeto agrupado em array
  const comunicadosUnicos = Object.values(comunicadosAgrupados);

  const totalPaginas = Math.ceil(comunicadosUnicos.length / itensPorPagina);
  const comunicadosPaginados = comunicadosUnicos.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

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
          {(isAdmin || turmas.length > 0) && (
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
                    {[...turmasDisponiveis].sort((a, b) => a.nome.localeCompare(b.nome)).map(t => (
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
                    <option value="enviado">Enviado</option>
                    <option value="agendado">Agendado</option>
                    <option value="rascunho">Rascunho</option>
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
        {(isAdmin || turmas.length > 0) && (
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
                        onClick={() => handleExcluir(c)}
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </Button>
                    )}
                  </div>
                </div>
                {/* Turma e Data abaixo do título, lado a lado */}
                <div className="d-flex align-items-center gap-3 mb-2" style={{ marginLeft: '2px', flexWrap: 'wrap' }}>
                  <div className="d-flex align-items-center gap-1" style={{ flexWrap: 'wrap' }}>
                    <span style={{ color: '#6c757d', fontWeight: 'bold', fontSize: '0.8rem', marginRight: '0.25rem' }}>
                      {c.turmasNomes && c.turmasNomes.length > 1 ? 'Turmas:' : 'Turma:'}
                    </span>
                    {c.turmasNomes && c.turmasNomes.length > 0 ? (
                      renderTurmasBadges(c.turmasNomes, c.id)
                    ) : (
                      <span style={{ color: '#6c757d', fontSize: '0.8rem' }}>
                        {(c.turmaNome === '-' || c.turmaId === '') ? 'Todas as turmas' : (c.turmaNome || turmas.find(t => t.id === c.turmaId)?.nome || '-')}
                      </span>
                    )}
                  </div>
                  <small style={{ color: '#6c757d', fontSize: '0.8rem' }}>
                    {c.status === 'agendado' && c.dataAgendamento
                      ? `Agendado para: ${c.dataAgendamento.toDate().toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}`
                      : (() => {
                          try {
                            if (c.data && typeof c.data.toDate === 'function') {
                              return `Criado em: ${c.data.toDate().toLocaleDateString('pt-BR')}`;
                            } else if (c.data && c.data._seconds) {
                              // Firestore Timestamp serializado com _seconds e _nanoseconds
                              const dataObj = new Date(c.data._seconds * 1000);
                              return `Criado em: ${dataObj.toLocaleDateString('pt-BR')}`;
                            } else if (c.data) {
                              const dataObj = typeof c.data === 'string' ? new Date(c.data) : new Date(c.data);
                              return `Criado em: ${dataObj.toLocaleDateString('pt-BR')}`;
                            }
                            return 'Data não disponível';
                          } catch (error) {
                            return 'Data inválida';
                          }
                        })()
                    }
                  </small>
                </div>
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