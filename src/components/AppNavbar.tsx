// src/components/AppNavbar.tsx
import { useState } from 'react';
import { Navbar, Nav, Offcanvas, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';
import { FaLink } from 'react-icons/fa';


import {
  FaHome, FaTasks, FaCalendarAlt, FaClipboardList, FaBook,
  FaBullhorn, FaUserGraduate, FaUsers, FaSignOutAlt
} from 'react-icons/fa';

export default function AppNavbar() {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const authContext = useAuth();
  const userData = authContext?.userData;

  const isAdmin = userData?.tipo === 'administradores';
  const dashboardLink = userData?.tipo === 'professores' ? '/dashboard-professor' : '/dashboard';

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleClose = () => setShowMenu(false);
  const handleShow = () => setShowMenu(true);

  const renderLinks = (isMobile = false) => (
    <Nav className="flex-column">
      <Nav.Link as={Link} to={dashboardLink} className="text-white d-flex align-items-center gap-2" onClick={isMobile ? handleClose : undefined}>
        <FaHome /> Dashboard
      </Nav.Link>
      <Nav.Link as={Link} to="/tarefas" className="text-white d-flex align-items-center gap-2" onClick={isMobile ? handleClose : undefined}>
        <FaTasks /> Tarefas
      </Nav.Link>
      <Nav.Link as={Link} to="/agenda" className="text-white d-flex align-items-center gap-2" onClick={isMobile ? handleClose : undefined}>
        <FaCalendarAlt /> Agenda
      </Nav.Link>
      <Nav.Link as={Link} to="/frequencia" className="text-white d-flex align-items-center gap-2" onClick={isMobile ? handleClose : undefined}>
        <FaClipboardList /> Frequência
      </Nav.Link>
      <Nav.Link as={Link} to="/notas" className="text-white d-flex align-items-center gap-2" onClick={isMobile ? handleClose : undefined}>
        <FaBook /> Notas
      </Nav.Link>
      <Nav.Link as={Link} to="/comunicados" className="text-white d-flex align-items-center gap-2" onClick={isMobile ? handleClose : undefined}>
        <FaBullhorn /> Comunicados
      </Nav.Link>

      {isAdmin && (
        <>
          <Nav.Link as={Link} to="/materias" className="text-white d-flex align-items-center gap-2" onClick={isMobile ? handleClose : undefined}>
            <FaBook /> Matérias
          </Nav.Link>
          <Nav.Link as={Link} to="/turmas" className="text-white d-flex align-items-center gap-2" onClick={isMobile ? handleClose : undefined}>
            <FaUserGraduate /> Turmas
          </Nav.Link>
          <Nav.Link as={Link} to="/vinculos" className="text-white d-flex align-items-center gap-2" onClick={isMobile ? handleClose : undefined}>
            <FaLink /> Vínculos
          </Nav.Link>
          <Nav.Link as={Link} to="/usuarios" className="text-white d-flex align-items-center gap-2" onClick={isMobile ? handleClose : undefined}>
            <FaUsers /> Usuários
          </Nav.Link>
        </>
      )}

      <Nav.Link onClick={() => { if (isMobile) handleClose(); handleLogout(); }} className="text-white mt-3 d-flex align-items-center gap-2">
        <FaSignOutAlt /> Logout
      </Nav.Link>
    </Nav>
  );

  return (
    <>
      {/* Navbar Mobile */}
      <Navbar fixed="top" expand="lg" variant="dark" className="px-3 d-flex d-lg-none w-100" style={{ backgroundColor: '#021E4C', zIndex: 1040 }}>
        <Button variant="outline-light" onClick={handleShow} className="me-2">☰</Button>
        <Navbar.Brand as={Link} to={dashboardLink} className="d-flex align-items-center gap-2">
          <img src={logo} alt="Logo" height={50} />
          <span>MobClassApp</span>
        </Navbar.Brand>
      </Navbar>

      {/* Sidebar Desktop */}
      <div className="sidebar d-none d-lg-flex flex-column p-3 text-white position-fixed" style={{
        width: '240px',
        height: '100vh',
        top: 0,
        left: 0,
        backgroundColor: '#021E4C',
        zIndex: 1030
      }}>
        <div className="mb-4 text-center">
          <img src={logo} alt="Logo" height={60} />
          <h5 className="mt-2">MobClassApp</h5>
        </div>
        {renderLinks(false)}
      </div>

      {/* Offcanvas Mobile Menu */}
      <Offcanvas show={showMenu} onHide={handleClose} backdrop scroll className="bg-primary text-white">
        <Offcanvas.Header closeButton closeVariant="white">
          <Offcanvas.Title className="d-flex align-items-center gap-2">
            <img src={logo} alt="Logo" height={50} /> MobClassApp
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {renderLinks(true)}
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}








