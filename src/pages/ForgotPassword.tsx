// src/pages/ForgotPassword.tsx
import React, { useState, useEffect } from 'react';
import { Form, Button, Alert, Spinner, Container, Card } from 'react-bootstrap';
import { UserService } from '../services/usuario/UserService';
import { FirebaseUserRepository } from '../repositories/user/FirebaseUserRepository';

const userService = new UserService(new FirebaseUserRepository());

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Remove padding-left do portal para centralizar como na login-page
  useEffect(() => {
    document.body.classList.add('login-page');
    return () => {
      document.body.classList.remove('login-page');
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('idle');
    setErrorMsg('');

    const emailTrimmed = email.trim();
    // Verifica se o e-mail existe na coleção de usuários via service
    try {
      const usuario = await userService.buscarPorEmailCaseInsensitive(emailTrimmed.toLowerCase());
      if (!usuario) {
        setStatus('error');
        setErrorMsg('E-mail não cadastrado.');
        return;
      }
    } catch (err) {
      // Erro ao consultar repositório de usuários
      setStatus('error');
      setErrorMsg('Erro interno. Tente novamente mais tarde.');
      return;
    }

    setStatus('sending');
    try {
      await userService.enviarEmailEsqueceuSenha(emailTrimmed);
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'Erro ao enviar e-mail. Tente novamente mais tarde.');
    }
  };

  return (
    <Container
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}
    >
      <Card
        className="p-4 shadow-sm"
        style={{ width: '100%', maxWidth: '400px', borderRadius: '12px' }}
      >
        <div className="text-center mb-4">
          <h4 className="fw-bold text-primary">Recuperar Senha</h4>
          <p className="text-muted mb-0">
            Digite seu e-mail para receber o link de redefinição
          </p>
        </div>

        {status === 'success' && (
          <Alert variant="success" className="text-center">
            E-mail de redefinição enviado para <strong>{email}</strong>.
          </Alert>
        )}
        {status === 'error' && (
          <Alert variant="danger" className="text-center">
            {errorMsg}
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="formEmail">
            <Form.Label>E-mail cadastrado</Form.Label>
            <Form.Control
              type="email"
              placeholder="seu@exemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={status === 'sending' || status === 'success'}
              autoComplete="username"
            />
          </Form.Group>

          <Button
            variant="primary"
            type="submit"
            className="w-100"
            disabled={status === 'sending' || status === 'success'}
          >
            {status === 'sending' ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Enviando...
              </>
            ) : (
              'Enviar link'
            )}
          </Button>
        </Form>

        <div className="text-center mt-3">
          <a
            href="/login"
            className="text-primary"
            style={{ textDecoration: 'none', fontSize: '0.9rem' }}
          >
            Voltar ao login
          </a>
        </div>
      </Card>
    </Container>
  );
}

