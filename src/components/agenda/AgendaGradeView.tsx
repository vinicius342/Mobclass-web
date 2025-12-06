// src/components/agenda/AgendaGradeView.tsx
import { Card, Row, Col, Form, Button, Dropdown } from 'react-bootstrap';
import { Sun, Sunset, Moon, Download, ChevronDown, ChevronRight, Edit, Trash2, Plus } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { exportarGradeTurnoPDF, exportarGradeTurnoExcel } from '../../utils/agendaExport';

// Tipos
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
  isVirtualizada?: boolean;
  turmaOriginalId?: string;
}

interface Materia {
  id: string;
  nome: string;
}

interface Professor {
  id: string;
  nome: string;
}

interface Vinculo {
  id: string;
  professorId: string;
  materiaId: string;
  turmaId: string;
}

interface AgendaGradeViewProps {
  // Dados
  turmas: Turma[];
  materias: Materia[];
  professores: Professor[];
  vinculos: Vinculo[];
  agendaPorTurma: Record<string, AgendaItem[]>;
  diasSemana: string[];
  
  // Filtros
  filtroVisualizacaoTurma: string;
  setFiltroVisualizacaoTurma: (value: string) => void;
  filtroProfessorVisualizacao: string;
  setFiltroProfessorVisualizacao: (value: string) => void;
  filtroTurnoVisualizacao: string;
  setFiltroTurnoVisualizacao: (value: string) => void;
  
  // Funções de filtro
  filtrarAulasPorProfessor: (aulas: AgendaItem[]) => AgendaItem[];
  filtrarAulasPorTurno: (aulas: AgendaItem[]) => AgendaItem[];
  obterDadosFiltradosParaGrade: () => AgendaItem[];
  
  // Funções de formatação
  getTurnoFromHorario: (horario: string) => string;
  getTurnoNome: (turno: string) => string;
  getDayColor: (dia: string) => { bg: string; text: string; border: string };
  formatarNomeProfessor: (nome: string | undefined) => string;
  
  // Funções de expansão de dias
  toggleDayExpansion: (turmaId: string, day: string) => void;
  isDayExpanded: (turmaId: string, day: string) => boolean;
  
  // Handlers
  handleEditar: (item: AgendaItem) => void;
  setItemToDelete: (item: AgendaItem | null) => void;
  setShowDeleteModal: (show: boolean) => void;
  setDiaSemana: (dia: string) => void;
  setTurmaId: (turmaId: string) => void;
  handleShow: () => void;
  
  // Permissões
  isAdmin: boolean;
}

export default function AgendaGradeView({
  turmas,
  materias,
  professores,
  vinculos,
  agendaPorTurma,
  diasSemana,
  filtroVisualizacaoTurma,
  setFiltroVisualizacaoTurma,
  filtroProfessorVisualizacao,
  setFiltroProfessorVisualizacao,
  filtroTurnoVisualizacao,
  setFiltroTurnoVisualizacao,
  filtrarAulasPorProfessor,
  filtrarAulasPorTurno,
  obterDadosFiltradosParaGrade,
  getTurnoFromHorario,
  getTurnoNome,
  getDayColor,
  formatarNomeProfessor,
  toggleDayExpansion,
  isDayExpanded,
  handleEditar,
  setItemToDelete,
  setShowDeleteModal,
  setDiaSemana,
  setTurmaId,
  handleShow,
  isAdmin
}: AgendaGradeViewProps) {
  return (
    <div>
      {/* Filtros da visualização por turnos */}
      <Card className="mb-3">
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Select value={filtroVisualizacaoTurma} onChange={e => setFiltroVisualizacaoTurma(e.target.value)}>
                <option value="">Todas as Turmas</option>
                {[...turmas].sort((a, b) => a.nome.localeCompare(b.nome)).map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={6}>
              <Form.Select value={filtroProfessorVisualizacao} onChange={e => setFiltroProfessorVisualizacao(e.target.value)}>
                <option value="">Todos os Professores</option>
                {[...professores].sort((a, b) => a.nome.localeCompare(b.nome)).map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Seleção de Turno */}
      <Row className='mb-3'>
        <Col md={12}>
          <div className="custom-tabs-container w-100">
            <button
              className={`custom-tab ${filtroTurnoVisualizacao === 'manha' ? 'active' : ''}`}
              onClick={() => setFiltroTurnoVisualizacao(filtroTurnoVisualizacao === 'manha' ? '' : 'manha')}
              type="button"
              style={{ flex: 1 }}
            >
              <Sun size={18} />
              Manhã
            </button>
            <button
              className={`custom-tab ${filtroTurnoVisualizacao === 'tarde' ? 'active' : ''}`}
              onClick={() => setFiltroTurnoVisualizacao(filtroTurnoVisualizacao === 'tarde' ? '' : 'tarde')}
              type="button"
              style={{ flex: 1 }}
            >
              <Sunset size={18} />
              Tarde
            </button>
            <button
              className={`custom-tab ${filtroTurnoVisualizacao === 'noite' ? 'active' : ''}`}
              onClick={() => setFiltroTurnoVisualizacao(filtroTurnoVisualizacao === 'noite' ? '' : 'noite')}
              type="button"
              style={{ flex: 1 }}
            >
              <Moon size={18} />
              Noite
            </button>
          </div>
        </Col>
      </Row>

      {/* Dropdown de Exportação */}
      {filtroTurnoVisualizacao && (
        <Col md={6} className="mb-3">
          <Dropdown className="w-100">
            <Dropdown.Toggle
              className="w-100 d-flex align-items-center justify-content-center gap-2"
              style={{ border: '1px solid #e1e7ef', backgroundColor: 'white', color: 'black', fontWeight: 500 }}
              variant="light"
            >
              <Download size={18} />
              Exportar Grade(s)
            </Dropdown.Toggle>
            <Dropdown.Menu className="w-100">
              <Dropdown.Item onClick={() => {
                exportarGradeTurnoPDF({
                  dadosFiltrados: obterDadosFiltradosParaGrade(),
                  turmas,
                  materias,
                  professores,
                  vinculos,
                  diasSemana,
                  turnoFiltro: filtroTurnoVisualizacao
                });
              }}>
                Exportar PDF
              </Dropdown.Item>
              <Dropdown.Item onClick={() => {
                exportarGradeTurnoExcel({
                  dadosFiltrados: obterDadosFiltradosParaGrade(),
                  turmas,
                  materias,
                  professores,
                  vinculos,
                  turnoNome: getTurnoNome(filtroTurnoVisualizacao)
                });
              }}>
                Exportar Excel
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </Col>
      )}

      {/* Mensagem quando nenhum turno for selecionado */}
      {!filtroTurnoVisualizacao && (
        <Card className="shadow-sm mb-4">
          <Card.Body>
            <div className="text-center text-muted py-5">
              <FontAwesomeIcon icon={faCircleExclamation} size="2x" className="mb-3" />
              <div>Selecione um turno para visualizar as aulas organizadas por grade de horários.</div>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Renderiza as tabelas de turmas */}
      {filtroTurnoVisualizacao && (() => {
        const turmasComAulas = turmas
          .filter(t => !filtroVisualizacaoTurma || t.id === filtroVisualizacaoTurma)
          .filter(t => {
            let aulasDaTurma = agendaPorTurma[t.id] || [];
            aulasDaTurma = filtrarAulasPorProfessor(aulasDaTurma);
            aulasDaTurma = filtrarAulasPorTurno(aulasDaTurma);
            return aulasDaTurma.length > 0;
          })
          .sort((a, b) => a.nome.localeCompare(b.nome));

        if (turmasComAulas.length === 0) {
          return (
            <Card className="shadow-sm mb-4">
              <Card.Body>
                <div className="text-center text-muted py-5">
                  <FontAwesomeIcon icon={faCircleExclamation} size="2x" className="mb-3" />
                  <div>Não há aulas cadastradas para o turno selecionado.</div>
                </div>
              </Card.Body>
            </Card>
          );
        }

        return turmasComAulas.map(t => {
          let aulasDaTurma = agendaPorTurma[t.id] || [];
          aulasDaTurma = filtrarAulasPorProfessor(aulasDaTurma);
          aulasDaTurma = filtrarAulasPorTurno(aulasDaTurma);

          return (
            <Card key={t.id} className="mb-4 shadow-sm">
              <Card.Body className="p-4">
                {/* Versão Desktop - Grade Horizontal */}
                <div className="d-none d-lg-block">
                  <h4 className="mb-2 fw-bold text-dark pb-2 px-3">{t.nome}</h4>
                  <Row>
                    {diasSemana.map(dia => (
                      <Col key={dia} style={{ flex: `0 0 ${100 / diasSemana.length}%`, maxWidth: `${100 / diasSemana.length}%` }} className="mb-3">
                        <div className="text-center mb-2">
                          <Button
                            variant="ghost"
                            onClick={() => toggleDayExpansion(t.id, dia)}
                            className="d-flex align-items-center gap-1 w-100 justify-content-center fw-semibold text-muted border-0 bg-transparent p-1"
                            style={{ fontSize: '0.75rem' }}
                          >
                            {isDayExpanded(t.id, dia) ? (
                              <ChevronDown size={12} />
                            ) : (
                              <ChevronRight size={12} />
                            )}
                            <span className="d-none d-lg-inline">{dia}</span>
                            <span className="d-lg-none">{dia.slice(0, 3)}</span>
                          </Button>
                        </div>
                        {isDayExpanded(t.id, dia) && (
                          <div className="d-flex flex-column gap-2" style={{ minHeight: '140px' }}>
                            {aulasDaTurma
                              .filter(a => a.diaSemana === dia)
                              .sort((a, b) => a.horario.localeCompare(b.horario))
                              .map((a, idx) => {
                                const turnoAula = getTurnoFromHorario(a.horario);
                                const dayColor = getDayColor(dia);

                                return (
                                  <Card
                                    key={idx}
                                    className="position-relative h-100"
                                    style={{
                                      backgroundColor: dayColor.bg,
                                      borderColor: dayColor.border,
                                      borderWidth: '1px',
                                      borderStyle: 'solid',
                                      transition: 'all 0.2s ease',
                                      cursor: 'pointer',
                                      minHeight: '160px',
                                      minWidth: '140px',
                                      maxWidth: '100%',
                                      color: dayColor.text
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'translateY(-2px)';
                                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                  >
                                    <Card.Body className="p-3 h-100 d-flex flex-column justify-content-between">
                                      <div className="space-y-1">
                                        <div className="fw-bold mb-1" style={{ color: 'black', fontSize: '0.8rem' }}>
                                          {a.horario}
                                        </div>
                                        <div className="fw-medium mb-1" style={{ fontSize: '0.8rem', color: dayColor.text }}>
                                          {materias.find(m => m.id === a.materiaId)?.nome || '-'}
                                        </div>
                                        <div className="mb-2" style={{ color: 'black', fontSize: '0.7rem', opacity: 0.8 }}>
                                          {(() => {
                                            const professor = professores.find(p => p.id === vinculos.find(v => v.materiaId === a.materiaId && v.turmaId === a.turmaId)?.professorId);
                                            return formatarNomeProfessor(professor?.nome);
                                          })()}
                                        </div>
                                      </div>
                                      <div className="d-flex justify-content-between align-items-center mt-2">
                                        <span
                                          className="badge badge-turno px-2 py-1"
                                          style={{
                                            backgroundColor: 'white',
                                            color: 'black',
                                            borderRadius: '20px',
                                            fontWeight: '600',
                                            fontSize: '0.65rem',
                                            border: 'none'
                                          }}
                                        >
                                          {getTurnoNome(turnoAula)}
                                        </span>
                                        <div className="d-flex gap-1">
                                          {isAdmin && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setItemToDelete(a);
                                                setShowDeleteModal(true);
                                              }}
                                              className="p-1 border-0 bg-transparent"
                                              style={{
                                                minWidth: 'auto',
                                                fontSize: '0.7rem',
                                                lineHeight: '1',
                                                color: '#dc3545'
                                              }}
                                              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                                              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                            >
                                              <Trash2 size={14} />
                                            </Button>
                                          )}
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEditar(a);
                                            }}
                                            className="p-1 border-0 bg-transparent"
                                            style={{
                                              minWidth: 'auto',
                                              fontSize: '0.7rem',
                                              lineHeight: '1',
                                              color: dayColor.text
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                          >
                                            <Edit size={14} />
                                          </Button>
                                        </div>
                                      </div>
                                    </Card.Body>
                                  </Card>
                                )
                              })}
                            {/* Card para adicionar nova aula */}
                            <Card
                              className="border-2"
                              style={{
                                borderStyle: 'dashed',
                                borderColor: '#d1d5db',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                height: '120px',
                                minWidth: '140px',
                                maxWidth: '100%'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#60a5fa';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#d1d5db';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                              onClick={() => {
                                setDiaSemana(dia);
                                setTurmaId(t.id);
                                handleShow();
                              }}
                            >
                              <Card.Body className="p-2 d-flex flex-column justify-content-center align-items-center" style={{ height: '100%' }}>
                                <div className="text-muted small text-center mb-1" style={{ fontSize: '0.65rem' }}>
                                  Adicionar Aula
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted d-flex align-items-center justify-content-center border-0 bg-transparent p-0"
                                  style={{
                                    transition: 'color 0.2s',
                                    fontSize: '0.8rem'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = '#2563eb'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
                                >
                                  <Plus size={14} />
                                </Button>
                              </Card.Body>
                            </Card>
                          </div>
                        )}
                      </Col>
                    ))}
                  </Row>
                </div>

                {/* Versão Mobile - Lista Vertical */}
                <div className="d-lg-none turno-cards-container">
                  <div className="turno-card-header">
                    <h4 className="fw-bold text-dark">{t.nome}</h4>
                  </div>

                  <div className="turno-dias-container">
                    {diasSemana.map(dia => {
                      const aulasDoDia = aulasDaTurma
                        .filter(a => a.diaSemana === dia)
                        .sort((a, b) => a.horario.localeCompare(b.horario));

                      const hasClasses = aulasDoDia.length > 0;

                      return (
                        <div
                          key={dia}
                          className={`turno-dia-card ${isDayExpanded(t.id, dia) ? 'expanded' : ''} ${!hasClasses ? 'no-classes' : ''}`}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (window.innerWidth <= 768 && !target.closest('.turno-aula-actions, .turno-add-card, .turno-dia-toggle')) {
                              toggleDayExpansion(t.id, dia);
                            }
                          }}
                        >
                          <div className="turno-dia-header">
                            <span
                              className="turno-dia-titulo"
                              onClick={() => toggleDayExpansion(t.id, dia)}
                            >
                              {dia}
                            </span>
                            <Button
                              variant="ghost"
                              onClick={() => toggleDayExpansion(t.id, dia)}
                              className="turno-dia-toggle"
                            >
                              {isDayExpanded(t.id, dia) ? (
                                <ChevronDown size={16} />
                              ) : (
                                <ChevronRight size={16} />
                              )}
                            </Button>
                          </div>

                          <div className="turno-aulas-lista">
                            {aulasDoDia.length === 0 ? (
                              <div className="turno-empty-state">
                                <div className="turno-empty-icon">📚</div>
                                <div className="turno-empty-title">Nenhuma aula</div>
                                <div className="turno-empty-text">Adicione uma aula para este dia</div>
                              </div>
                            ) : (
                              aulasDoDia.map((a, idx) => {
                                const turnoAula = getTurnoFromHorario(a.horario);
                                let turnoClass = '';

                                if (turnoAula === 'manha') turnoClass = 'manha';
                                else if (turnoAula === 'tarde') turnoClass = 'tarde';
                                else turnoClass = 'noite';

                                const materia = materias.find(m => m.id === a.materiaId);
                                const vinculo = vinculos.find(v => v.materiaId === a.materiaId && v.turmaId === a.turmaId);
                                const professor = professores.find(p => p.id === vinculo?.professorId);

                                return (
                                  <div key={idx} className="turno-aula-card">
                                    <div className="turno-aula-header">
                                      <span className="turno-aula-horario">{a.horario}</span>
                                      <div className="turno-aula-actions">
                                        <Button
                                          variant="ghost"
                                          onClick={() => handleEditar(a)}
                                          className="turno-aula-btn edit"
                                        >
                                          <Edit size={16} />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          onClick={() => {
                                            setItemToDelete(a);
                                            setShowDeleteModal(true);
                                          }}
                                          className="turno-aula-btn delete"
                                        >
                                          <Trash2 size={16} />
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="turno-aula-body">
                                      <div className="turno-aula-info">
                                        <div className="turno-aula-materia">
                                          {materia?.nome || '-'}
                                        </div>
                                        <div className="turno-aula-professor">
                                          {formatarNomeProfessor(professor?.nome)}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="turno-aula-footer">
                                      <span className={`turno-aula-badge ${turnoClass}`}>
                                        {getTurnoNome(turnoAula)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}

                            {/* Card de adicionar aula em mobile */}
                            <div
                              className="turno-add-card"
                              onClick={() => {
                                setDiaSemana(dia);
                                setTurmaId(t.id);
                                handleShow();
                              }}
                            >
                              <div className="turno-add-text">Adicionar Aula</div>
                              <div className="turno-add-icon">
                                <Plus size={20} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card.Body>
            </Card>
          )
        });
      })()}
    </div>
  );
}
