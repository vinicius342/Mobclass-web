import { Card, Dropdown, Table } from 'react-bootstrap';
import { CheckCircle2, Eye, Edit, Trash2, Users } from 'lucide-react';

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
  openModal: (turma?: Turma) => void;
  handleExcluirTurma: (id: string) => void;
}

export default function TurmasListDesktop({
  turmasPaginadas,
  totalAlunos,
  getTurnoStyle,
  handleVerDetalhes,
  openModal,
  handleExcluirTurma,
}: Props) {
  return (
    <div className="turmas-list-desktop d-none d-md-block">
      <Card className="mb-1">
        <Card.Body>
          <div className="agenda-table-desktop w-100">
            <Table hover className="w-100">
              <thead className="thead-sticky">
                <tr style={{ textAlign: 'center' }}>
                  <th className='text-muted'>Turma</th>
                  <th className='text-muted'>Status</th>
                  <th className='text-muted'>Turno</th>
                  <th className='text-muted'>Total de Alunos</th>
                  <th className='text-muted'>Ações</th>
                </tr>
              </thead>
              <tbody>
                {turmasPaginadas.length > 0 ? turmasPaginadas.map(t => {
                  const turnoStyle = getTurnoStyle(t.turno);

                  return (
                    <tr key={t.id} className='align-middle linha-agenda' style={{ textAlign: 'center' }}>
                      <td>
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          <strong>{t.nome}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-success text-white px-2 py-1">
                          <CheckCircle2 size={14} className="me-1" />
                          Ativa
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge badge-turno px-2 py-1"
                          style={{
                            backgroundColor: turnoStyle.bg,
                            color: turnoStyle.color
                          }}
                        >
                          {t.turno}
                        </span>
                      </td>
                      <td>
                        <span className="fw-semibold" style={{ fontWeight: 600, fontSize: '1rem', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <Users size={18} style={{ marginRight: 4, verticalAlign: 'middle', color: '#6c757d' }} />
                          {t.isVirtualizada ? '-' : totalAlunos(t.id)}
                        </span>
                      </td>
                      <td>
                        <Dropdown align="end">
                          <Dropdown.Toggle
                            variant="light"
                            size="sm"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              boxShadow: 'none'
                            }}
                            className="dropdown-toggle-no-caret"
                          >
                            ⋯
                          </Dropdown.Toggle>
                          <Dropdown.Menu>
                            <Dropdown.Item onClick={() => handleVerDetalhes(t)} className="d-flex align-items-center gap-2">
                              <Eye size={16} /> Detalhes
                            </Dropdown.Item>
                            {t.isVirtualizada ? (
                              <>
                                {/* Materializar comentado na versão original */}
                                <Dropdown.Item onClick={() => handleExcluirTurma(t.id)} className="d-flex align-items-center gap-2 text-danger">
                                  <Trash2 size={16} /> Excluir
                                </Dropdown.Item>
                              </>
                            ) : (
                              <>
                                <Dropdown.Item onClick={() => openModal(t)} className="d-flex align-items-center gap-2 text-primary">
                                  <Edit size={16} className="text-primary" /> Editar
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => handleExcluirTurma(t.id)} className="d-flex align-items-center gap-2 text-danger">
                                  <Trash2 size={16} /> Excluir
                                </Dropdown.Item>
                              </>
                            )}
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="text-center py-4">
                      <div className="agenda-empty-state">
                        <div className="empty-icon">🏫</div>
                        <h5>Nenhuma turma encontrada</h5>
                        <p className="text-muted">Tente ajustar os filtros ou adicione uma nova turma.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
