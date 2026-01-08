import { JSX, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase/firebase';
import logo from '../assets/logo.png';
import {
  Container,
  Card,
  Form,
  Button,
  Alert,
  Spinner,
  Row,
  Col
} from 'react-bootstrap';

export default function Register(): JSX.Element {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('administradores');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setCarregando(true);

    // Validações
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      setCarregando(false);
      return;
    }

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      setCarregando(false);
      return;
    }

    if (!nome.trim()) {
      setErro('Nome é obrigatório.');
      setCarregando(false);
      return;
    }

    try {
      // Criar usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), senha);
      const user = userCredential.user;

      // Criar documento na coleção users
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: email.trim(),
        nome: nome.trim(),
        tipo: tipo,
        firstAcesso: true,
        criadoEm: new Date(),
        status: 'Ativo'
      });

      // Criar documento na coleção específica do tipo (mesmos campos da Cloud Function)
      await addDoc(collection(db, tipo), {
        nome: nome.trim(),
        email: email.trim(),
        status: 'Ativo',
        dataCriacao: new Date(),
        // Campos específicos por tipo
        ...(tipo === 'alunos' && { turmaId: '' }),
        ...(tipo === 'professores' && { turmas: [] }),
        ...(tipo === 'responsaveis' && { filhos: [] })
      });

      setSucesso('Usuário criado com sucesso! Redirecionando para login...');
      
      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          setErro('Este email já está em uso.');
          break;
        case 'auth/invalid-email':
          setErro('Email inválido.');
          break;
        case 'auth/weak-password':
          setErro('Senha muito fraca.');
          break;
        default:
          setErro('Erro ao criar usuário. Tente novamente.');
      }
    }
    
    setCarregando(false);
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <Card style={{ width: '100%', maxWidth: '400px' }} className="shadow">
        <Card.Body className="p-4">
          <div className="text-center mb-4">
            <img src={logo} alt="Logo" style={{ height: '60px', marginBottom: '1rem' }} />
            <h2 className="fw-bold text-primary">Cadastro - DEV</h2>
            <p className="text-muted small">Página temporária para desenvolvimento</p>
          </div>

          {erro && <Alert variant="danger" className="py-2">{erro}</Alert>}
          {sucesso && <Alert variant="success" className="py-2">{sucesso}</Alert>}

          <Form onSubmit={handleRegister}>
            <Form.Group className="mb-3">
              <Form.Label>Nome Completo</Form.Label>
              <Form.Control
                type="text"
                placeholder="Digite seu nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoComplete="name"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="Digite seu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Tipo de Usuário</Form.Label>
              <Form.Select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                required
              >
                <option value="administradores">Administrador</option>
                <option value="professores">Professor</option>
                <option value="alunos">Aluno</option>
                <option value="responsaveis">Responsável</option>
              </Form.Select>
            </Form.Group>

            <Row>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Senha</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Digite sua senha"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    autoComplete="new-password"
                    minLength={6}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Confirmar Senha</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Confirme sua senha"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    required
                    autoComplete="new-password"
                    minLength={6}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Button type="submit" variant="primary" className="w-100 mb-3" disabled={carregando}>
              {carregando ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                  Criando usuário...
                </>
              ) : (
                'Criar Conta'
              )}
            </Button>
          </Form>

          <div className="text-center">
            <Link to="/login" className="text-primary" style={{ fontSize: '0.9rem', textDecoration: 'none' }}>
              ← Voltar para Login
            </Link>
          </div>

          <hr className="my-3" />
          
          <div className="text-center">
            <small className="text-muted">
              <strong>⚠️ AMBIENTE DE DESENVOLVIMENTO</strong><br />
              Esta página é apenas para testes.<br />
              Remover antes da produção.
            </small>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}