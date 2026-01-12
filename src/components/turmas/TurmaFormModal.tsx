import React from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

interface Props {
  show: boolean;
  onHide: () => void;
  editId?: string | null;
  novaTurma: string;
  setNovaTurma: (v: string) => void;
  anoLetivo: number;
  turnoModal: string;
  setTurnoModal: (v: string) => void;
  erro?: string | null;
  onSave: () => void;
}

const TurmaFormModal: React.FC<Props> = ({ show, onHide, editId, novaTurma, setNovaTurma, anoLetivo, turnoModal, setTurnoModal, erro, onSave }) => (
  <Modal show={show} onHide={onHide} centered>
    <Modal.Header closeButton>
      <Modal.Title>{editId ? 'Editar Turma' : 'Nova Turma'}</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <Form>
        <Form.Group className="mb-3">
          <Form.Label>Nome da Turma</Form.Label>
          <Form.Control id="input-nome-turma" type="text" value={novaTurma} onChange={e => setNovaTurma(e.target.value)} />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Ano Letivo</Form.Label>
          <Form.Control type="number" value={anoLetivo} readOnly disabled />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Turno</Form.Label>
          <Form.Select value={turnoModal} onChange={e => setTurnoModal(e.target.value)}>
            <option>Manhã</option>
            <option>Tarde</option>
          </Form.Select>
        </Form.Group>
        {erro && <div className="text-danger mt-2">{erro}</div>}
      </Form>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="secondary" onClick={onHide}>Cancelar</Button>
      <Button variant="primary" onClick={onSave}>Salvar</Button>
    </Modal.Footer>
  </Modal>
);

export default TurmaFormModal;
