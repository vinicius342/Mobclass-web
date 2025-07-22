// src/pages/ResetPassword.tsx
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  getAuth,
} from 'firebase/auth';
import {
  Container,
  Card,
  Form,
  Button,
  Alert,
  Spinner,
} from 'react-bootstrap';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'invalid' | 'ready' | 'success' | 'error'>('loading');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.body.classList.add('login-page');
    return () => {
      document.body.classList.remove('login-page');
    };
  }, []);

  const oobCode = searchParams.get('oobCode');

  useEffect(() => {
    if (!oobCode) {
      setStatus('invalid');
      return;
    }

    const auth = getAuth();
    verifyPasswordResetCode(auth, oobCode)
      .then(email => {
        setEmail(email);
        setStatus('ready');
      })
      .catch(() => {
        setStatus('invalid');
      });
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (newPassword !== confirmPassword) {
      return setErrorMsg('As senhas não coincidem.');
    }

    try {
      const auth = getAuth();
      await confirmPasswordReset(auth, oobCode!, newPassword);
      setStatus('success');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.code || 'Erro ao redefinir senha.');
    }
  };

  return (
    <Container
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}
    >
      <Card className="p-4 shadow-sm" style={{ width: '100%', maxWidth: '400px', borderRadius: '12px' }}>
        <h4 className="text-center fw-bold text-primary mb-3">Redefinir Senha</h4>

        {status === 'loading' && <Spinner animation="border" className="mx-auto d-block my-4" />}

        {status === 'invalid' && (
          <Alert variant="danger" className="text-center">
            Link inválido ou expirado.
          </Alert>
        )}

        {status === 'ready' && (
          <>
            <p className="text-muted text-center">Redefinindo senha para <strong>{email}</strong></p>
            {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Nova senha</Form.Label>
                <Form.Control
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Confirmar nova senha</Form.Label>
                <Form.Control
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </Form.Group>
              <Button type="submit" variant="primary" className="w-100">
                Redefinir senha
              </Button>
            </Form>
          </>
        )}

        {status === 'success' && (
          <Alert variant="success" className="text-center">
            Senha redefinida com sucesso! Redirecionando...
          </Alert>
        )}

        {status === 'error' && errorMsg && (
          <Alert variant="danger" className="text-center">
            {errorMsg}
          </Alert>
        )}
      </Card>
    </Container>
  );
}
