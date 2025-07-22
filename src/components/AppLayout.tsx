// src/components/AppLayout.tsx
import React from 'react';
import AppNavbar from './AppNavbar';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, Container } from 'react-bootstrap';

interface Props {
  children: React.ReactNode;
}

export default function AppLayout({ children }: Props) {
  const { loading, userData: user } = useAuth() ?? { loading: true, userData: null };

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
            <div className="mb-3 text-end text-muted small">
              Olá, <strong>{user.nome}</strong> ({user.tipo})
            </div>
          )}
          {children}
        </Container>
      </main>
    </>
  );
}












