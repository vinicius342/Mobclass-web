// src/routes/AppRoutes.tsx
import { JSX } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import AdminRoute from './AdminRoute';

// Páginas principais
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import DashboardProfessor from '../pages/DashboardProfessor';
import Agenda from '../pages/Agenda';
import Frequencia from '../pages/Frequencia';
import Tarefas from '../pages/Tarefas';
import Notas from '../pages/Notas';
import Comunicados from '../pages/Comunicados';
import Turmas from '../pages/Turmas';
import Usuarios from '../pages/Usuarios';
import Materias from '../pages/Materias';
import ForgotPassword from '../pages/ForgotPassword';
import FirstChangePassword from '../pages/FirstChangePassword';
import ResetPassword from '../pages/ResetPassword';
import Vinculos from '../pages/Vinculos';

export default function AppRoutes(): JSX.Element {
  return (
    <Routes>
      {/* Rotas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Rotas protegidas */}
      <Route element={<PrivateRoute />}>
        {/* Redireciona raiz para dashboard */}
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Dashboards por tipo */}
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="dashboard-professor" element={<DashboardProfessor />} />

        {/* Funcionalidades comuns */}
        <Route path="agenda" element={<Agenda />} />
        <Route path="frequencia" element={<Frequencia />} />
        <Route path="tarefas" element={<Tarefas />} />
        <Route path="notas" element={<Notas />} />
        <Route path="comunicados" element={<Comunicados />} />
        <Route path="first-change-password" element={<FirstChangePassword />} />


        {/* Funcionalidades restritas a administradores */}
        <Route element={<AdminRoute />}>
          <Route path="turmas" element={<Turmas />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="materias" element={<Materias />} />
          <Route path="vinculos" element={<Vinculos />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}














