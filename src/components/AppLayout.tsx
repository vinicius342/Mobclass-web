// src/components/AppLayout.tsx
import React, { useState } from 'react';
import AppNavbar from './AppNavbar';
import { useAuth } from '../contexts/AuthContext';
import { useAnoLetivo } from '../contexts/AnoLetivoContext';
import { Spinner, Container, Modal, Form, Button } from 'react-bootstrap';
import { Settings } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export default function AppLayout({ children }: Props) {
  const { loading, userData: user } = useAuth() ?? { loading: true, userData: null };
  const { anoLetivo, setAnoLetivo, anosDisponiveis, carregandoAnos } = useAnoLetivo();
  const [showModal, setShowModal] = useState(false);
  const [anoSelecionado, setAnoSelecionado] = useState(anoLetivo);

  const handleOpenModal = () => {
    setAnoSelecionado(anoLetivo);
    setShowModal(true);
  };

  const handleSalvarAno = () => {
    setAnoLetivo(anoSelecionado);
    setShowModal(false);
  };

  const handleCancelar = () => {
    setAnoSelecionado(anoLetivo);
    setShowModal(false);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <>
      <AppNavbar />
      <main className="content-area">
        <Container>
          {user && (
            <div
              className="mb-3 d-flex flex-wrap gap-2 justify-content-between align-items-center"
              style={{
                rowGap: '0.5rem',
                columnGap: '1rem',
                paddingTop: '0.5rem',
                paddingBottom: '0.5rem',
                flexDirection: 'row',
              }}
            >
              <div className="d-flex align-items-center flex-wrap gap-2" style={{ minWidth: 0 }}>
                <Button
                  variant="link"
                  className="p-0 me-2 text-muted"
                  onClick={handleOpenModal}
                  style={{ 
                    border: 'none', 
                    background: 'transparent',
                    color: '#6c757d' 
                  }}
                  title="Configurações do ano letivo"
                >
                  <Settings size={18} />
                </Button>
                <small className="text-muted" style={{ wordBreak: 'keep-all' }}>
                  Ano letivo: <strong>{anoLetivo}</strong>
                </small>
              </div>
              <div className="text-muted small" style={{ wordBreak: 'break-word', minWidth: 0 }}>
                Olá, <strong>{user.nome}</strong>
                <br />
                <span className="text-secondary">({user.tipo})</span>
              </div>
            </div>
          )}
          {children}
        </Container>
      </main>

      {/* Modal de configuração do ano letivo */}
      <Modal show={showModal} onHide={handleCancelar} centered>
        <Modal.Header closeButton>
          <Modal.Title>Configuração do Ano Letivo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Selecione o ano letivo:</Form.Label>
              {carregandoAnos ? (
                <div className="text-center py-3">
                  <Spinner animation="border" size="sm" className="me-2" />
                  Carregando anos disponíveis...
                </div>
              ) : (
                <Form.Select
                  value={anoSelecionado}
                  onChange={(e) => setAnoSelecionado(parseInt(e.target.value))}
                >
                  {anosDisponiveis.map(ano => (
                    <option key={ano} value={ano}>
                      {ano} {ano === new Date().getFullYear() && '(Atual)'} {ano === new Date().getFullYear() + 1 && '(Próximo)'}
                    </option>
                  ))}
                </Form.Select>
              )}
              <Form.Text className="text-muted">
                Anos baseados nas turmas cadastradas. O próximo ano é adicionado automaticamente.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCancelar}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSalvarAno}
            disabled={carregandoAnos}
          >
            Salvar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}












