import React from 'react';
import { Card, Row, Col, Form, Button, Spinner, Table } from 'react-bootstrap';
import { ArrowLeftRight, ArrowRight, BookText, Check, CheckCircle2, User, X, Users } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import type { Turma } from '../../models/Turma';
import type { Aluno } from '../../models/Aluno';

type Props = {
  anoLetivoRematricula: number;
  setAnoLetivoRematricula: (v: number) => void;
  anosDisponiveis: number[];
  turmaFiltroRematricula: string;
  setTurmaFiltroRematricula: (v: string) => void;
  proximaTurma: string;
  setProximaTurma: (v: string) => void;
  turmas: Turma[];
  getTurmasProximas: () => Turma[];
  getAlunosFiltrados: () => Aluno[];
  statusPromocao: Record<string, 'promovido' | 'reprovado' | null>;
  setStatusPromocao: (updater: (prev: Record<string, 'promovido' | 'reprovado' | null>) => Record<string, 'promovido' | 'reprovado' | null>) => void;
  alunosTransferencia: Record<string, string>;
  setAlunosTransferencia: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleAprovarTodos: () => void;
  handleReprovarTodos: () => void;
  loading: boolean;
  mediasAlunos: Record<string, number | null>;
  getSituacaoBadge: (alunoId: string) => React.ReactNode;
  handleAbrirModalTransferencia: (aluno: Aluno) => void;
  handleAbrirBoletim: (aluno: Aluno) => void;
  acaoFinalizada: Record<string, 'promovido' | 'reprovado' | 'transferido'>;
  getStatusStyle: (status: string) => { bg: string; color: string };
};

const RematriculaTab: React.FC<Props> = ({
  anoLetivoRematricula,
  setAnoLetivoRematricula,
  anosDisponiveis,
  turmaFiltroRematricula,
  setTurmaFiltroRematricula,
  proximaTurma,
  setProximaTurma,
  turmas,
  getTurmasProximas,
  getAlunosFiltrados,
  statusPromocao,
  setStatusPromocao,
  alunosTransferencia,
  setAlunosTransferencia,
  handleAprovarTodos,
  handleReprovarTodos,
  loading,
  mediasAlunos,
  getSituacaoBadge: getSituacaoBadge,
  handleAbrirModalTransferencia,
  handleAbrirBoletim,
  getStatusStyle,
}) => {
  return (
    <>
      {/* Filtros para Rematrícula */}
      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex align-items-center gap-2 mb-3">
            <ArrowLeftRight size={20} className="" />
            <h5 className="mb-0">Seleção de Turma</h5>
          </div>
          <div className="row g-3">
            <div className="col-md-4">
              <Form.Label className='filter-label'>Ano Letivo</Form.Label>
              <Form.Select
                value={anoLetivoRematricula}
                onChange={e => {
                  setAnoLetivoRematricula(parseInt(e.target.value));
                  setTurmaFiltroRematricula('');
                  setProximaTurma('');
                }}
              >
                {anosDisponiveis
                  .slice()
                  .sort((a, b) => a - b)
                  .map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
              </Form.Select>
            </div>
            <div className="col-md-4">
              <Form.Label className='filter-label'>Turma Atual</Form.Label>
              <Form.Select value={turmaFiltroRematricula} onChange={e => {
                setTurmaFiltroRematricula(e.target.value);
                setProximaTurma('');
              }}>
                <option value="">Selecione a turma atual</option>
                {turmas.filter(t => !t.turmaOriginalId && t.anoLetivo === anoLetivoRematricula.toString()).map(turma => (
                  <option key={turma.id} value={turma.id}>{turma.nome}</option>
                ))}
              </Form.Select>
            </div>
            <div className="col-md-4">
              <Form.Label className="d-flex align-items-center gap-2 filter-label">
                <ArrowRight size={16} className="text-primary" />
                Próxima Turma
              </Form.Label>
              <Form.Select
                value={proximaTurma}
                onChange={e => setProximaTurma(e.target.value)}
                disabled={!turmaFiltroRematricula}
              >
                <option value="">
                  {turmaFiltroRematricula && getTurmasProximas().length === 0
                    ? `Nenhuma turma cadastrada para ${parseInt(anoLetivoRematricula.toString()) + 1}`
                    : 'Selecione a próxima turma'}
                </option>
                {getTurmasProximas().map(turma => (
                  <option key={turma.id} value={turma.id}>
                    {turma.nome} - ({parseInt(anoLetivoRematricula.toString()) + 1})
                  </option>
                ))}
              </Form.Select>
              {turmaFiltroRematricula && getTurmasProximas().length === 0 && (
                <Form.Text className="text-warning d-flex align-items-center gap-1 mt-1">
                  <FontAwesomeIcon icon={faCircleExclamation} />
                  Crie turmas para {parseInt(anoLetivoRematricula.toString()) + 1} em "Gerenciar Turmas"
                </Form.Text>
              )}
            </div>
          </div>
        </Card.Body>
      </Card>

      {!turmaFiltroRematricula && (
        <Card className="shadow-sm mb-4">
          <Card.Body>
            <div className="text-center text-muted py-5">
              <FontAwesomeIcon icon={faCircleExclamation} size="2x" className="mb-3" />
              <div>Selecione uma turma para visualizar os alunos disponíveis para rematrícula.</div>
            </div>
          </Card.Body>
        </Card>
      )}

      {turmaFiltroRematricula && (
        <>
          <Row className='mb-3'>
            <Col md={3}>
              <Card className="shadow-sm card-sm border-left-primary mb-1">
                <Card.Body className="py-3 px-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <div className="text-muted small" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Total</div>
                    <Users size={16} style={{ color: '#2563eb', opacity: 0.7 }} />
                  </div>
                  <h4 className="mb-0 fw-bold" style={{ color: '#2563eb' }}>{getAlunosFiltrados().length}</h4>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="shadow-sm card-sm border-left-success mb-1">
                <Card.Body className="py-3 px-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <div className="text-muted small" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Aprovados</div>
                    <CheckCircle2 size={16} style={{ color: '#22c55e', opacity: 0.7 }} />
                  </div>
                  <h4 className="mb-0 fw-bold" style={{ color: '#22c55e' }}>
                    {Object.values(statusPromocao).filter(s => s === 'promovido').length}
                  </h4>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="shadow-sm card-sm mb-1" style={{ borderLeft: '4px solid #ef4444' }}>
                <Card.Body className="py-3 px-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <div className="text-muted small" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Reprovados</div>
                    <X size={16} style={{ color: '#ef4444', opacity: 0.7 }} />
                  </div>
                  <h4 className="mb-0 fw-bold" style={{ color: '#ef4444' }}>
                    {Object.values(statusPromocao).filter(s => s === 'reprovado').length}
                  </h4>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="shadow-sm card-sm mb-1" style={{ borderLeft: '4px solid #3b82f6' }}>
                <Card.Body className="py-3 px-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <div className="text-muted small" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Transferidos</div>
                    <ArrowLeftRight size={16} style={{ color: '#3b82f6', opacity: 0.7 }} />
                  </div>
                  <h4 className="mb-0 fw-bold" style={{ color: '#3b82f6' }}>
                    {Object.keys(alunosTransferencia).length}
                  </h4>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <div className="d-flex d-md-none gap-2 mb-3">
            <Button
              variant="success"
              onClick={handleAprovarTodos}
              className="d-flex align-items-center justify-content-center gap-1 flex-fill"
            >
              <Check size={16} />
              Aprovar Todos
            </Button>
            <Button
              variant="danger"
              onClick={handleReprovarTodos}
              className="d-flex align-items-center justify-content-center gap-1 flex-fill"
            >
              <X size={16} />
              Reprovar Todos
            </Button>
          </div>

          <Card className="mb-4">
            <Card.Body className="pb-0">
              <div className="d-flex align-items-center justify-content-between px-2 mb-2">
                <h3 className="mb-0 d-flex align-items-center gap-2">
                  Lista de Alunos - {turmas.find(t => t.id === turmaFiltroRematricula)?.nome} - {anoLetivoRematricula}
                </h3>
                <div className="d-none d-md-flex gap-2">
                  <Button
                    variant="outline-success"
                    size="sm"
                    onClick={handleAprovarTodos}
                    className="d-flex align-items-center gap-1 btn-aprovar-todos"
                  >
                    <Check size={16} />
                    Aprovar Todos
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={handleReprovarTodos}
                    className="d-flex align-items-center gap-1 btn-reprovar-todos"
                  >
                    <X size={16} />
                    Reprovar Todos
                  </Button>
                </div>
              </div>
            </Card.Body>
            <Card.Body className="pt-0">
              {loading ? (
                <div className="d-flex justify-content-center align-items-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : (
                <>
                  {/* Tabela Desktop */}
                  <Table hover className="mb-0 turmas-table-desktop">
                    <thead className="thead-sticky">
                      <tr style={{ textAlign: 'center' }}>
                        <th className='text-muted' style={{ width: '35%' }}>Aluno</th>
                        <th className='text-muted'>Média Final</th>
                        <th className='text-muted'>Situação</th>
                        <th className='text-muted'>Ações</th>
                        <th className='text-muted'>Boletim</th>
                      </tr>
                    </thead>
                    <tbody className=''>
                      {getAlunosFiltrados().length > 0 ? getAlunosFiltrados().map(aluno => {
                        const mediaFinal = mediasAlunos[aluno.id];
                        const corMedia = mediaFinal !== null && mediaFinal !== undefined
                          ? mediaFinal >= 7 ? 'text-success' : mediaFinal >= 5 ? 'text-warning' : 'text-danger'
                          : 'text-muted';
                        const status = aluno.historicoStatus?.[anoLetivoRematricula.toString()] || '';
                        const badgeStyle = getStatusStyle(status);

                        return (
                          <tr key={aluno.id} className='align-middle linha-agenda' style={{ textAlign: 'center', height: '70px' }}>
                            <td style={{ textAlign: 'left' }}>
                              <div className="d-flex align-items-center gap-2">
                                <div className="user-icon-circle-frequencia">
                                  <User size={24} color="#fff" />
                                </div>
                                <strong>{aluno.nome}</strong>
                              </div>
                            </td>
                            <td>
                              <span className={`fw-bold ${corMedia}`} style={{ fontSize: '1.1rem' }}>
                                {mediaFinal !== null && mediaFinal !== undefined ? mediaFinal.toFixed(1) : '-'}
                              </span>
                            </td>
                            <td>
                              {getSituacaoBadge(aluno.id)}
                            </td>
                            <td>
                              {/* Ações por aluno */}
                              {!status ? (
                                <div className="d-flex gap-2 justify-content-center">
                                  <Button
                                    className='btn-acao-aprovado'
                                    size="sm"
                                    onClick={() => {
                                      setStatusPromocao(prev => {
                                        if (prev[aluno.id] === 'promovido') {
                                          const { [aluno.id]: _, ...rest } = prev;
                                          return rest;
                                        }
                                        return { ...prev, [aluno.id]: 'promovido' };
                                      });
                                      if (alunosTransferencia[aluno.id]) {
                                        const novaTransferencia = { ...alunosTransferencia };
                                        delete novaTransferencia[aluno.id];
                                        setAlunosTransferencia(novaTransferencia);
                                      }
                                    }}
                                    title="Aprovar"
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '6px',
                                      fontWeight: '500',
                                      backgroundColor: statusPromocao[aluno.id] === 'promovido' ? '#22c55e' : 'white',
                                      color: statusPromocao[aluno.id] === 'promovido' ? 'white' : 'black',
                                      border: '1px solid #cbd5e1',
                                      height: '32px',
                                      minWidth: '32px'
                                    }}
                                  >
                                    <Check size={16} strokeWidth={2.5} />
                                  </Button>
                                  <Button
                                    className='btn-acao-reprovado'
                                    size="sm"
                                    onClick={() => {
                                      setStatusPromocao(prev => {
                                        if (prev[aluno.id] === 'reprovado') {
                                          const { [aluno.id]: _, ...rest } = prev;
                                          return rest;
                                        }
                                        return { ...prev, [aluno.id]: 'reprovado' };
                                      });
                                      if (alunosTransferencia[aluno.id]) {
                                        const novaTransferencia = { ...alunosTransferencia };
                                        delete novaTransferencia[aluno.id];
                                        setAlunosTransferencia(novaTransferencia);
                                      }
                                    }}
                                    title="Reprovar"
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '6px',
                                      fontWeight: '500',
                                      backgroundColor: statusPromocao[aluno.id] === 'reprovado' ? '#ef4444' : 'white',
                                      color: statusPromocao[aluno.id] === 'reprovado' ? 'white' : 'black',
                                      border: '1px solid #cbd5e1',
                                      height: '32px',
                                      minWidth: '32px'
                                    }}
                                  >
                                    <X size={16} strokeWidth={2.5} />
                                  </Button>
                                  <Button
                                    className="btn-acao-transferencia d-flex align-items-center gap-1"
                                    size="sm"
                                    onClick={() => handleAbrirModalTransferencia(aluno)}
                                    title="Transferir"
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '6px',
                                      fontWeight: '500',
                                      backgroundColor: alunosTransferencia[aluno.id] ? '#3b82f6' : 'white',
                                      color: alunosTransferencia[aluno.id] ? 'white' : 'black',
                                      border: '1px solid #cbd5e1',
                                      height: '32px',
                                      minWidth: '32px'
                                    }}
                                  >
                                    <ArrowLeftRight size={18} strokeWidth={2.5} />
                                  </Button>
                                </div>
                              ) : (
                                <div>
                                  <span
                                    className="badge badge-status-acoes"
                                    style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.color }}
                                  >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td>
                              <Button
                                variant="primary"
                                size="sm"
                                className="d-flex align-items-center gap-1"
                                onClick={() => handleAbrirBoletim(aluno)}
                                style={{
                                  margin: '0 auto',
                                  color: 'black',
                                  background: 'white',
                                  border: '1px solid #cbd5e1',
                                }}
                                title="Ver Boletim"
                              >
                                <BookText size={16} />
                              </Button>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={5} className="text-center py-4">
                            <div className="agenda-empty-state">
                              <div className="empty-icon">👥</div>
                              <h5>Nenhum aluno encontrado</h5>
                              <p className="text-muted">Tente ajustar os filtros ou verifique se há alunos cadastrados.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>

                  {/* Cards Mobile */}
                  <div className="turmas-mobile-cards">
                    {getAlunosFiltrados().length > 0 ? getAlunosFiltrados().map(aluno => {
                      const mediaFinal = mediasAlunos[aluno.id];
                      return (
                        <div key={aluno.id} className="turmas-aluno-card">
                          <div className="turmas-aluno-header">
                            <div className="d-flex align-items-center gap-2">
                              <User size={18} />
                              <strong>{aluno.nome}</strong>
                            </div>
                          </div>
                          <div className="turmas-aluno-info">
                            <div className="info-row">
                              <span className="info-label">Média Final:</span>
                              <span style={{
                                fontWeight: '600',
                                color: mediaFinal !== null && mediaFinal !== undefined
                                  ? mediaFinal >= 7 ? '#22c55e' : mediaFinal >= 5 ? '#eab308' : '#ef4444'
                                  : '#6c757d'
                              }}>
                                {mediaFinal !== null && mediaFinal !== undefined ? mediaFinal.toFixed(1) : '-'}
                              </span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">Situação:</span>
                              {getSituacaoBadge(aluno.id)}
                            </div>
                          </div>
                          <div className="turmas-acoes-mobile">
                            <div className="d-flex gap-2 justify-content-center flex-wrap">
                              <Button
                                className="btn-mobile-acao"
                                size="sm"
                                onClick={() => {
                                  setStatusPromocao(prev => {
                                    if (prev[aluno.id] === 'promovido') {
                                      const { [aluno.id]: _, ...rest } = prev;
                                      return rest;
                                    }
                                    return { ...prev, [aluno.id]: 'promovido' };
                                  });
                                  if (alunosTransferencia[aluno.id]) {
                                    const novaTransferencia = { ...alunosTransferencia };
                                    delete novaTransferencia[aluno.id];
                                    setAlunosTransferencia(novaTransferencia);
                                  }
                                }}
                                title="Aprovar"
                                style={{
                                  backgroundColor: statusPromocao[aluno.id] === 'promovido' ? '#22c55e' : 'white',
                                  color: statusPromocao[aluno.id] === 'promovido' ? 'white' : 'black',
                                  border: '1px solid #cbd5e1',
                                  flex: 1
                                }}
                              >
                                <Check size={16} strokeWidth={2.5} />
                                <span className="ms-1">Aprovar</span>
                              </Button>
                              <Button
                                className="btn-mobile-acao"
                                size="sm"
                                onClick={() => {
                                  setStatusPromocao(prev => {
                                    if (prev[aluno.id] === 'reprovado') {
                                      const { [aluno.id]: _, ...rest } = prev;
                                      return rest;
                                    }
                                    return { ...prev, [aluno.id]: 'reprovado' };
                                  });
                                  if (alunosTransferencia[aluno.id]) {
                                    const novaTransferencia = { ...alunosTransferencia };
                                    delete novaTransferencia[aluno.id];
                                    setAlunosTransferencia(novaTransferencia);
                                  }
                                }}
                                title="Reprovar"
                                style={{
                                  backgroundColor: statusPromocao[aluno.id] === 'reprovado' ? '#ef4444' : 'white',
                                  color: statusPromocao[aluno.id] === 'reprovado' ? 'white' : 'black',
                                  border: '1px solid #cbd5e1',
                                  flex: 1
                                }}
                              >
                                <X size={16} strokeWidth={2.5} />
                                <span className="ms-1">Reprovar</span>
                              </Button>
                              <Button
                                className="btn-mobile-acao"
                                size="sm"
                                onClick={() => handleAbrirModalTransferencia(aluno)}
                                title="Transferir"
                                style={{
                                  backgroundColor: alunosTransferencia[aluno.id] ? '#3b82f6' : 'white',
                                  color: alunosTransferencia[aluno.id] ? 'white' : 'black',
                                  border: '1px solid #cbd5e1',
                                  flex: 1
                                }}
                              >
                                <ArrowLeftRight size={16} strokeWidth={2.5} />
                                <span className="ms-1">Transferir</span>
                              </Button>
                            </div>
                            <Button
                              variant="primary"
                              size="sm"
                              className="d-flex align-items-center justify-content-center gap-2 mt-2"
                              onClick={() => handleAbrirBoletim(aluno)}
                              style={{
                                width: '100%',
                                color: 'black',
                                background: 'white',
                                border: '1px solid #cbd5e1',
                              }}
                              title="Ver Boletim"
                            >
                              <BookText size={16} />
                              <span>Ver Boletim</span>
                            </Button>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="text-center py-4">
                        <div className="agenda-empty-state">
                          <div className="empty-icon">👥</div>
                          <h5>Nenhum aluno encontrado</h5>
                          <p className="text-muted">Tente ajustar os filtros ou verifique se há alunos cadastrados.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </>
      )}
    </>
  );
};

export default RematriculaTab;
