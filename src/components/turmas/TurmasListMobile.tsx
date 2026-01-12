import { Card } from 'react-bootstrap';
import { Users, Eye, CheckCircle2, Ghost, Edit, Trash2 } from 'lucide-react';

interface Turma {
  id: string;
  nome: string;
  anoLetivo: string;
  turno: string;
  isVirtualizada?: boolean;
}

interface Props {
  turmasPaginadas: Turma[];
  totalAlunos: (turmaId: string) => number;
  getTurnoStyle: (turno: string) => { bg: string; color: string };
  handleVerDetalhes: (turma: Turma) => void;
  handleMaterializarTurma: (turma: Turma) => void;
  openModal: (turma?: Turma) => void;
  handleExcluirTurma: (id: string) => void;
}

export default function TurmasListMobile({
  turmasPaginadas,
  totalAlunos,
  getTurnoStyle,
  handleVerDetalhes,
  handleMaterializarTurma,
  openModal,
  handleExcluirTurma,
}: Props) {
  return (
    <div className="turmas-mobile-cards d-block d-md-none">
      <Card className="shadow-sm">
        <Card.Body>
          <div className="turmas-header-mobile mb-3">
            <h3 className="mb-0">Turmas</h3>
          </div>

          {turmasPaginadas.length > 0 ? (
            <div className="turmas-grid-mobile px-0">
              {turmasPaginadas.map(t => {
                const turnoStyle = getTurnoStyle(t.turno);
                return (
                  <div key={t.id} className="turmas-card-mobile">
                    <div className="turmas-card-header">
                      <div className="turmas-card-info">
                        <div className="turmas-card-title d-flex align-items-center gap-2">
                          {t.nome}
                          {t.isVirtualizada && (
                            <Ghost size={14} className="text-info" />
                          )}
                        </div>
                        <div className="turmas-card-ano d-flex align-items-center gap-2">
                          Ano: {t.anoLetivo}
                          {t.isVirtualizada ? (
                            <span className="badge bg-info text-white" style={{ fontSize: '0.7rem' }}>Virtual</span>
                          ) : (
                            <span className="badge bg-success text-white" style={{ fontSize: '0.7rem' }}>Ativa</span>
                          )}
                        </div>
                      </div>
                      <span
                        className="badge px-2 py-1"
                        style={{
                          backgroundColor: turnoStyle.bg,
                          color: turnoStyle.color,
                          fontSize: '0.8rem'
                        }}
                      >
                        {t.turno}
                      </span>
                    </div>

                    <div className="turmas-card-body">
                      <div className="turmas-alunos-info">
                        <Users size={18} className="text-muted me-2" />
                        <span className="fw-semibold">
                          {t.isVirtualizada ? 'Sem alunos (virtual)' : `${totalAlunos(t.id)} alunos`}
                        </span>
                      </div>
                    </div>

                    <div className="turmas-card-actions">
                      <button
                        className="turmas-action-btn turmas-detalhes-btn"
                        onClick={() => handleVerDetalhes(t)}
                      >
                        <Eye size={16} />
                        Detalhes
                      </button>
                      {t.isVirtualizada ? (
                        <button
                          className="turmas-action-btn turmas-edit-btn"
                          onClick={() => handleMaterializarTurma(t)}
                          style={{ backgroundColor: '#22c55e', borderColor: '#22c55e' }}
                        >
                          <CheckCircle2 size={16} />
                          Materializar
                        </button>
                      ) : (
                        <>
                          <button
                            className="turmas-action-btn turmas-edit-btn"
                            onClick={() => openModal(t)}
                          >
                            <Edit size={16} />
                            Editar
                          </button>
                          <button
                            className="turmas-action-btn turmas-delete-btn"
                            onClick={() => handleExcluirTurma(t.id)}
                          >
                            <Trash2 size={16} />
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="turmas-empty-state">
              <div className="turmas-empty-icon">
                <Users size={48} />
              </div>
              <h5 className="turmas-empty-title">Nenhuma turma encontrada</h5>
              <p className="turmas-empty-text">
                Tente ajustar os filtros de busca ou adicione uma nova turma.
              </p>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
