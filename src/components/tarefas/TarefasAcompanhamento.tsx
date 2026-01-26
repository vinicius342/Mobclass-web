// src/components/tarefas/TarefasAcompanhamento.tsx
import { useState } from 'react';
import {
  Card, Row, Col, Form, Button, Dropdown, Table, ButtonGroup
} from 'react-bootstrap';
import { Eye, Edit, Trash2, ArrowLeft, ArrowDownUp } from "lucide-react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faX, faCircleExclamation, faCheck, faComment } from '@fortawesome/free-solid-svg-icons';
import { CheckCircle, XCircle, ExclamationCircle } from 'react-bootstrap-icons';
import Paginacao from '../common/Paginacao';

interface Aluno {
  id: string;
  nome: string;
  turmaId: string;
  status: 'Ativo' | 'Inativo';
}

interface Tarefa {
  id: string;
  materiaId: string;
  titulo?: string;
  descricao: string;
  turmaId: string;
  dataEntrega: string;
  anoLetivo?: string;
  excluida?: boolean;
  bloqueado?: boolean;
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

interface TarefasAcompanhamentoProps {
    anoLetivo: string;
  turmas: Turma[];
  materias: Materia[];
  tarefas: Tarefa[];
  alunos: Aluno[];
  entregas: Entrega[];
  filtroTurma: string;
  filtroMateria: string;
  paginaAtual: number;
  tarefasPorPagina: number;
  ordenacao: 'titulo' | 'data';
  linksSegurosFiltrados: { [tarefaId: string]: Array<{ url: string; titulo: string }> };
  onFiltroTurmaChange: (turmaId: string) => void;
  onFiltroMateriaChange: (materiaId: string) => void;
  onAtividadeSelecionada: (tarefa: Tarefa | null) => void;
  onOrdenacaoChange: (ordenacao: 'titulo' | 'data') => void;
  onEditarTarefa: (tarefaId: string) => void;
  onExcluirTarefa: (tarefa: Tarefa) => void;
  onAtualizarEntrega: (alunoId: string, status: string) => void;
  onOpenObsModal: (entregaId: string, observacoes: string) => void;
  onExportarPDF: () => void;
  onExportarExcel: () => void;
  onPaginaChange: (pagina: number) => void;
  formatarDataBR: (data: string) => string;
}

export default function TarefasAcompanhamento({
  turmas,
  materias,
  tarefas,
  alunos,
  entregas,
  filtroTurma,
  filtroMateria,
  paginaAtual,
  tarefasPorPagina,
  ordenacao,
  linksSegurosFiltrados,
  onFiltroTurmaChange,
  onFiltroMateriaChange,
  onAtividadeSelecionada,
  onOrdenacaoChange,
  onEditarTarefa,
  onExcluirTarefa,
  onAtualizarEntrega,
  onOpenObsModal,
  onExportarPDF,
  onExportarExcel,
  onPaginaChange,
  formatarDataBR,
  anoLetivo
}: TarefasAcompanhamentoProps) {
  const [atividadeSelecionada, setAtividadeSelecionada] = useState<Tarefa | null>(null);

  const todasTurmasSelecionada = filtroTurma === '__todas__';
  const todasMateriasSelecionada = filtroMateria === '__todas__';
  // Obter lista de turmas permitidas para o professor (ignorando id vazio)
  const turmasPermitidas = turmas.filter(t => t.id).map(t => t.id);
  const tarefasFiltradas = tarefas.filter(t => {
    if (t.excluida) return false;
    if (t.anoLetivo && t.anoLetivo.toString() !== anoLetivo) return false;
    if (!turmasPermitidas.includes(t.turmaId)) return false;
    // Se ambos estão em modo 'todas', retorna todas do ano letivo e das turmas permitidas
    if (todasTurmasSelecionada && todasMateriasSelecionada) return true;
    // Se só turmas está em modo 'todas', filtra só por matéria
    if (todasTurmasSelecionada) return t.materiaId === filtroMateria;
    // Se só matérias está em modo 'todas', filtra só por turma
    if (todasMateriasSelecionada) return t.turmaId === filtroTurma;
    // Ambos selecionados
    return t.turmaId === filtroTurma && t.materiaId === filtroMateria;
  });

  // Corrige: se filtroTurma for '__todas__' e houver atividade selecionada, mostra alunos da turma da atividade
  const alunosFiltrados =
    filtroTurma === '__todas__' && atividadeSelecionada
      ? alunos.filter(a => a.turmaId === atividadeSelecionada.turmaId && a.status === 'Ativo')
      : alunos.filter(a => a.turmaId === filtroTurma && a.status === 'Ativo');

  const handleSetAtividadeSelecionada = (tarefa: Tarefa | null) => {
    setAtividadeSelecionada(tarefa);
    onAtividadeSelecionada(tarefa);
  };

  return (
    <>
      <Card className="mb-3">
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Select
                value={filtroTurma}
                onChange={e => {
                  onFiltroTurmaChange(e.target.value);
                  onFiltroMateriaChange('');
                  handleSetAtividadeSelecionada(null);
                }}
              >
                <option value="">Selecione a turma</option>
                <option value="__todas__">Todas as turmas</option>
                {[...turmas].filter(t => t.id !== '').sort((a, b) => a.nome.localeCompare(b.nome)).map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={6}>
              <Form.Select
                value={filtroMateria}
                onChange={e => {
                  onFiltroMateriaChange(e.target.value);
                  handleSetAtividadeSelecionada(null);
                }}
                disabled={!filtroTurma}
              >
                <option value="">Selecione a matéria</option>
                <option value="__todas__">Todas as matérias</option>
                {materias.filter(m => m.id !== '').sort((a, b) => a.nome.localeCompare(b.nome)).map(m => (
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
                        <Dropdown onSelect={key => onOrdenacaoChange(key as any)}>
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
                      <Table hover className="mb-0 align-middle">
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
                              <tr key={tarefa.id} style={{ cursor: 'pointer', borderBottom: 'white' }} onClick={() => handleSetAtividadeSelecionada(tarefa)}>
                                <td className="py-3 px-3" style={{ width: '35%' }}>
                                  <span style={{ fontSize: '1rem', fontWeight: 500 }}>
                                    {tarefa.titulo ? tarefa.titulo : tarefa.descricao || 'Sem título'}
                                  </span>
                                </td>
                                <td className="py-3 px-3" style={{ width: '28%' }}>
                                  <span style={{ color: '#6b7280' }}>
                                    {tarefa.descricao ? tarefa.descricao : tarefa.titulo || 'Sem descrição'}
                                  </span>
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
                                        onClick={() => handleSetAtividadeSelecionada(tarefa)}
                                        className="d-flex align-items-center gap-2"
                                      >
                                        <Eye size={16} /> Acompanhar
                                      </Dropdown.Item>
                                      <Dropdown.Item
                                        onClick={() => onEditarTarefa(tarefa.id)}
                                        className="d-flex align-items-center gap-2 text-primary"
                                      >
                                        <Edit size={16} /> Editar
                                      </Dropdown.Item>
                                      <Dropdown.Item
                                        onClick={() => onExcluirTarefa(tarefa)}
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
                    <Dropdown onSelect={key => onOrdenacaoChange(key as any)}>
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
                            onClick={() => handleSetAtividadeSelecionada(tarefa)}
                          >
                            <Eye size={18} /> Acompanhar
                          </button>
                          <button
                            className="materias-action-btn"
                            style={{ background: '#f3f4f6', color: '#2563eb' }}
                            onClick={() => onEditarTarefa(tarefa.id)}
                          >
                            <Edit size={18} /> Editar
                          </button>
                          <button
                            className="materias-action-btn materias-delete-btn"
                            onClick={() => onExcluirTarefa(tarefa)}
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
                onClick={() => handleSetAtividadeSelecionada(null)}
              >
                <ArrowLeft size={18} />
                <span>Voltar para lista de atividades</span>
              </Button>
            </Col>
            <Col className="d-flex justify-content-end gap-2">
              <Button variant="outline-primary" onClick={onExportarPDF}>
                Exportar PDF
              </Button>
              <Button variant="outline-success" onClick={onExportarExcel}>
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
                                  onOpenObsModal(entrega ? entrega.id : "", entrega?.observacoes || "");
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
                                  onClick={() => onAtualizarEntrega(aluno.id, 'concluida')}
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
                                  onClick={() => onAtualizarEntrega(aluno.id, 'nao_entregue')}
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
              aoMudarPagina={onPaginaChange}
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
                  onClick={() => handleSetAtividadeSelecionada(null)}
                >
                  <ArrowLeft size={18} /> Voltar
                </button>
                <button
                  className="materias-action-btn"
                  style={{ background: '#f3f4f6', color: '#2563eb', minWidth: 0, flex: 1 }}
                  onClick={onExportarPDF}
                >
                  <FontAwesomeIcon icon={faCheck} /> PDF
                </button>
                <button
                  className="materias-action-btn"
                  style={{ background: '#e0f7e9', color: '#22c55e', minWidth: 0, flex: 1 }}
                  onClick={onExportarExcel}
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
                              className={`materias-action-btn aluno-btn-mobile-left${entrega?.status === 'concluida' ? ' btn-active-success' : ' materias-edit-btn'}`}
                              style={
                                entrega?.status === 'concluida'
                                  ? {
                                    flex: 1,
                                    borderRadius: '8px 0 0 8px',
                                    borderRight: '1px solid #fff',
                                    margin: 0,
                                    background: '#22c55e',
                                    color: '#fff',
                                    fontWeight: 600,
                                    border: '2px solid #22c55e'
                                  }
                                  : {
                                    flex: 1,
                                    borderRadius: '8px 0 0 8px',
                                    borderRight: '1px solid #fff',
                                    margin: 0
                                  }
                              }
                              onClick={() => onAtualizarEntrega(aluno.id, 'concluida')}
                            >
                              <FontAwesomeIcon icon={faCheck} /> Confirmar
                            </button>
                            <button
                              className={`materias-action-btn aluno-btn-mobile-right${entrega?.status === 'nao_entregue' ? ' btn-active-danger' : ' materias-delete-btn'}`}
                              style={
                                entrega?.status === 'nao_entregue'
                                  ? {
                                    flex: 1,
                                    borderRadius: '0 8px 8px 0',
                                    borderLeft: '1px solid #fff',
                                    margin: 0,
                                    background: '#dc3545',
                                    color: '#fff',
                                    fontWeight: 600,
                                    border: '2px solid #dc3545'
                                  }
                                  : {
                                    flex: 1,
                                    borderRadius: '0 8px 8px 0',
                                    borderLeft: '1px solid #fff',
                                    margin: 0
                                  }
                              }
                              onClick={() => onAtualizarEntrega(aluno.id, 'nao_entregue')}
                            >
                              <FontAwesomeIcon icon={faX} /> Não Entregue
                            </button>
                          </div>
                          <button
                            className="materias-action-btn aluno-btn-mobile-obs"
                            style={{
                              background: entrega?.observacoes && '#f3f4f6',
                              color: entrega?.observacoes ? '#92400e' : '#212529',
                              width: '100%',
                              marginTop: 8,
                              borderRadius: 8,
                              fontWeight: entrega?.observacoes ? 600 : 400
                            }}
                            onClick={() => onOpenObsModal(entrega ? entrega.id : '', entrega?.observacoes || '')}
                          >
                            <FontAwesomeIcon icon={faComment} />
                            Obs
                            {entrega?.observacoes && (
                              <FontAwesomeIcon icon={faCircleExclamation} className="ms-1" />
                            )}
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
                aoMudarPagina={onPaginaChange}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
