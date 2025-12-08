import React from 'react';
import { Modal, Card, Button, Form } from 'react-bootstrap';
import { ArrowRight } from 'lucide-react';

export interface Turma { id: string; nome: string; anoLetivo: string; isVirtualizada?: boolean }
export interface Aluno { id: string; nome: string; uid?: string }

interface Props {
  show: boolean;
  onHide: () => void;
  alunoTransferencia: Aluno | null;
  turmas: Turma[];
  anoLetivoRematricula: number;
  mediasAlunos: Record<string, number | null>;
  getStatusBadge: (alunoId: string) => React.ReactNode;
  turmaDestinoTransferencia: string;
  setTurmaDestinoTransferencia: (v: string) => void;
  onConfirm: () => void;
  processandoTransferencia: boolean;
}

const TransferenciaModal: React.FC<Props> = ({ show, onHide, alunoTransferencia, turmas, anoLetivoRematricula, mediasAlunos, getStatusBadge, turmaDestinoTransferencia, setTurmaDestinoTransferencia, onConfirm, processandoTransferencia }) => (
  <Modal show={show} onHide={onHide} centered>
    <Modal.Header closeButton>
      <Modal.Title>
        <ArrowRight size={24} className="me-2" />
        Transferir Aluno
      </Modal.Title>
    </Modal.Header>
    <Modal.Body>
      {alunoTransferencia && (
        <>
          <Card className="border-0 shadow-sm mb-3">
            <Card.Body>
              <h5 className="mb-3">Informações do Aluno</h5>
              <div className="mb-3">
                <label className="form-label fw-semibold text-muted">Nome</label>
                <div className="p-2 bg-light rounded">
                  <strong>{alunoTransferencia.nome}</strong>
                </div>
              </div>
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-muted">Média Final</label>
                    <div className="p-2 bg-light rounded">
                      <span className={`fw-bold ${mediasAlunos[alunoTransferencia.id] !== null && mediasAlunos[alunoTransferencia.id] !== undefined
                        ? mediasAlunos[alunoTransferencia.id]! >= 7 ? 'text-success'
                          : mediasAlunos[alunoTransferencia.id]! >= 5 ? 'text-warning'
                            : 'text-danger'
                        : 'text-muted'
                        }`}>
                        {mediasAlunos[alunoTransferencia.id] !== null && mediasAlunos[alunoTransferencia.id] !== undefined
                          ? mediasAlunos[alunoTransferencia.id]!.toFixed(1)
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-muted">Situação Atual</label>
                    <div className="p-2 bg-light rounded">
                      {getStatusBadge(alunoTransferencia.id)}
                    </div>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
          <div className="mb-3">
            <label className="form-label fw-semibold">Selecione a Turma de Destino</label>
            <Form.Select value={turmaDestinoTransferencia} onChange={(e) => setTurmaDestinoTransferencia(e.target.value)}>
              <option value="">Selecione uma turma...</option>
              {turmas.filter(t => t.anoLetivo === anoLetivoRematricula.toString() && t.isVirtualizada !== true).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })).map(turma => (
                <option key={turma.id} value={turma.id}>{turma.nome}</option>
              ))}
            </Form.Select>
            <Form.Text className="text-muted">Transferir para outra turma do mesmo ano letivo ({anoLetivoRematricula})</Form.Text>
          </div>
        </>
      )}
    </Modal.Body>
    <Modal.Footer>
      <Button variant="secondary" onClick={onHide} disabled={processandoTransferencia}>Cancelar</Button>
      <Button variant="primary" onClick={onConfirm} disabled={!turmaDestinoTransferencia || processandoTransferencia}>
        {processandoTransferencia ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Transferindo...
          </>
        ) : (
          <>
            <ArrowRight size={18} className="me-1" />
            Confirmar Transferência
          </>
        )}
      </Button>
    </Modal.Footer>
  </Modal>
);

export default TransferenciaModal;
