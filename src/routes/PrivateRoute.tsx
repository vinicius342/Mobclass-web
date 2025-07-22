// src/routes/PrivateRoute.tsx
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, Container } from 'react-bootstrap';

export default function PrivateRoute() {
  const authContext = useAuth();
  const { userData, loading } = authContext ?? {};
  const location = useLocation();

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </Spinner>
      </Container>
    );
  }

  if (!userData) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}



