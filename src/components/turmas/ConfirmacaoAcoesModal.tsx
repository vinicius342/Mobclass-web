import React from 'react';
import { Modal, Card, Button } from 'react-bootstrap';
import { CheckSquare, XSquare, ArrowRight } from 'lucide-react';

interface ResumoDestinos {
  promovidos: { alunoId: string; turmaDestino: string }[];
  reprovados: { alunoId: string; turmaDestino: string }[];
  transferidos: { alunoId: string; turmaDestino: string }[];
}

interface Props {
  show: boolean;
  onHide: () => void;
  turmaNomeAtual?: string;
  resumoDestinos: ResumoDestinos;
  onConfirm: () => void;
}

const ConfirmacaoAcoesModal: React.FC<Props> = ({ show, onHide, turmaNomeAtual, resumoDestinos, onConfirm }) => (
  <Modal show={show} onHide={onHide} centered>
    <Modal.Header closeButton>
      <Modal.Title>
        <CheckSquare size={24} className="me-2" />
        Confirmar Promoção
      </Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <p className="text-muted mb-3">
        Você está prestes a realizar a promoção da turma <strong>{turmaNomeAtual}</strong>.
      </p>
      <Card className="border-0 shadow-sm">
        <Card.Body>
          <h6 className="mb-3">Resumo:</h6>
          <div className="d-flex flex-column gap-2">
            {resumoDestinos.promovidos.length > 0 && (
              <div className="d-flex align-items-start gap-2">
                <CheckSquare size={18} className="text-success mt-1" />
                <span>
                  <strong>{resumoDestinos.promovidos.length}</strong> aluno{resumoDestinos.promovidos.length > 1 ? 's' : ''} será{resumoDestinos.promovidos.length > 1 ? 'ão' : ''} promovido{resumoDestinos.promovidos.length > 1 ? 's' : ''} para <strong>{resumoDestinos.promovidos[0]?.turmaDestino}</strong>
                </span>
              </div>
            )}
            {resumoDestinos.reprovados.length > 0 && (
              <div className="d-flex align-items-start gap-2">
                <XSquare size={18} className="text-danger mt-1" />
                <span>
                  <strong>{resumoDestinos.reprovados.length}</strong> aluno{resumoDestinos.reprovados.length > 1 ? 's' : ''} será{resumoDestinos.reprovados.length > 1 ? 'ão' : ''} reprovado{resumoDestinos.reprovados.length > 1 ? 's' : ''}
                  {resumoDestinos.reprovados.length > 0 && (
                    <>
                      {' '}para{' '}
                      {Array.from(new Set(resumoDestinos.reprovados.map(r => r.turmaDestino))).map((turma, idx, arr) => (
                        <span key={idx}>
                          <strong>{turma}</strong>{idx < arr.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </>
                  )}
                </span>
              </div>
            )}
            {resumoDestinos.transferidos.length > 0 && (
              <div className="d-flex align-items-start gap-2">
                <ArrowRight size={18} className="text-primary mt-1" />
                <span>
                  <strong>{resumoDestinos.transferidos.length}</strong> aluno{resumoDestinos.transferidos.length > 1 ? 's' : ''} será{resumoDestinos.transferidos.length > 1 ? 'ão' : ''} transferido{resumoDestinos.transferidos.length > 1 ? 's' : ''}
                  {resumoDestinos.transferidos.length > 0 && (
                    <>
                      {' '}para{' '}
                      {Array.from(new Set(resumoDestinos.transferidos.map(t => t.turmaDestino))).map((turma, idx, arr) => (
                        <span key={idx}>
                          <strong>{turma}</strong>{idx < arr.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>
      <p className="text-muted small mt-3 mb-0">
        Esta ação não poderá ser desfeita facilmente. Deseja continuar?
      </p>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="secondary" onClick={onHide}>Cancelar</Button>
      <Button variant="primary" onClick={onConfirm}>Confirmar Promoção</Button>
    </Modal.Footer>
  </Modal>
);

export default ConfirmacaoAcoesModal;
