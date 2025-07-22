// src/routes/AdminRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, Container } from 'react-bootstrap';

export default function AdminRoute() {
  const auth = useAuth();

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  const { userData, loading } = auth;

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (userData?.tipo !== 'administradores') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

