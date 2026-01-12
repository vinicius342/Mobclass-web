import React from 'react';
import { Modal, Card } from 'react-bootstrap';
import { Users, BookOpen, CheckCircle2, User } from 'lucide-react';

export interface Turma {
  id: string;
  nome: string;
  anoLetivo: string;
  turno: string;
  isVirtualizada?: boolean;
}
export interface Aluno { id: string; nome: string; email?: string }

interface Props {
  show: boolean;
  onHide: () => void;
  turmaDetalhes: Turma | null;
  anoLetivo: number;
  getTurnoStyle: (turno: string) => { bg: string; color: string };
  getProfessoresDaTurma: (turmaId: string, turma: Turma) => { professor: string; materia: string }[];
  getAlunosDaTurma: (turmaId: string) => Aluno[];
}

const TurmaDetailsModal: React.FC<Props> = ({ show, onHide, turmaDetalhes, anoLetivo, getTurnoStyle, getProfessoresDaTurma, getAlunosDaTurma }) => (
  <Modal show={show} onHide={onHide} centered size="lg">
    <Modal.Header closeButton>
      <Modal.Title className="d-flex align-items-center gap-2">
        <Users size={24} color="#2563eb" />
        Detalhes da Turma - {turmaDetalhes?.nome}
      </Modal.Title>
    </Modal.Header>
    <Modal.Body>
      {turmaDetalhes && (
        <div className="row g-4">
          <div className="col-12">
            <Card className="shadow-sm">
              <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                <BookOpen size={20} className="me-2 text-primary" />
                <span className="fw-bold" style={{ fontSize: '1.1rem', color: '#1e293b' }}>Informações Gerais</span>
              </div>
              <Card.Body>
                <div className="row">
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label fw-semibold text-muted">Ano Letivo</label>
                      <p className="mb-0">{turmaDetalhes.anoLetivo}</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label fw-semibold text-muted">Turno</label>
                      <div>
                        <span className="badge px-2 py-1" style={{ backgroundColor: getTurnoStyle(turmaDetalhes.turno).bg, color: getTurnoStyle(turmaDetalhes.turno).color }}>
                          {turmaDetalhes.turno}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label fw-semibold text-muted">Status</label>
                      <div>
                        <span className="badge bg-success px-2 py-1">
                          <CheckCircle2 size={12} className="me-1" />
                          Ativa
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </div>

          <div className="col-md-12">
            <Card className="shadow-sm">
              <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                <User size={20} className="me-2 text-primary" />
                <span className="fw-bold" style={{ fontSize: '1.1rem', color: '#1e293b' }}>
                  Professores
                  {turmaDetalhes.isVirtualizada && (
                    <span className="text-muted ms-2" style={{ fontSize: '0.9rem', fontWeight: 'normal' }}>
                      (do ano anterior)
                    </span>
                  )}
                </span>
                <span className="badge bg-primary ms-2" style={{ fontSize: '0.95rem' }}>{getProfessoresDaTurma(turmaDetalhes.id, turmaDetalhes).length}</span>
              </div>
              <Card.Body className="p-2">
                {getProfessoresDaTurma(turmaDetalhes.id, turmaDetalhes).length > 0 ? (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <div className="row g-2">
                      {getProfessoresDaTurma(turmaDetalhes.id, turmaDetalhes).map((item, index) => (
                        <div key={index} className="col-12 col-md-6">
                          <Card className={`mb-2 card-sm ${turmaDetalhes.isVirtualizada ? 'border-left-info' : 'border-left-primary'}`}>
                            <Card.Body className="py-2 px-3">
                              <div className="d-flex align-items-center">
                                <User size={16} className={`me-2 ${turmaDetalhes.isVirtualizada ? 'text-info' : 'text-primary'}`} />
                                <div className="flex-grow-1">
                                  <h6 className="mb-1 fw-semibold text-dark">
                                    {item.professor}
                                    {turmaDetalhes.isVirtualizada && (
                                      <span className="ms-2" style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                        📅 {anoLetivo - 1}
                                      </span>
                                    )}
                                  </h6>
                                  <p className="mb-0 text-muted small">{item.materia}</p>
                                </div>
                              </div>
                            </Card.Body>
                          </Card>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted py-3">
                    <User size={32} className="mb-2 opacity-50" />
                    <p className="mb-0">Nenhum professor vinculado</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </div>

          <div className="col-md-12">
            <Card className="shadow-sm h-100">
              <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                <Users size={20} className="me-2 text-success" />
                <span className="fw-bold" style={{ fontSize: '1.1rem', color: '#1e293b' }}>Alunos Matriculados</span>
                <span className="badge bg-success ms-2" style={{ fontSize: '0.95rem' }}>{getAlunosDaTurma(turmaDetalhes.id).length}</span>
              </div>
              <Card.Body className="p-2">
                {getAlunosDaTurma(turmaDetalhes.id).length > 0 ? (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <div className="row g-2">
                      {getAlunosDaTurma(turmaDetalhes.id).map((aluno) => (
                        <div key={aluno.id} className="col-12 col-md-6">
                          <Card className="mb-2 card-sm border-left-success">
                            <Card.Body className="py-2 px-3">
                              <div className="d-flex align-items-center">
                                <Users size={16} className="me-2 text-success" />
                                <div className="flex-grow-1">
                                  <h6 className="mb-1 fw-semibold text-dark">{aluno.nome}</h6>
                                  <p className="mb-0 text-muted small">
                                    {aluno.email || 'Email não cadastrado'}
                                  </p>
                                </div>
                              </div>
                            </Card.Body>
                          </Card>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted py-3">
                    <Users size={32} className="mb-2 opacity-50" />
                    <p className="mb-0">Nenhum aluno matriculado</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </div>
        </div>
      )}
    </Modal.Body>
  </Modal>
);

export default TurmaDetailsModal;
