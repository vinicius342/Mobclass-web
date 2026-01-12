import { JSX, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { auth, db, messaging } from '../services/firebase/firebase';
import logo from '../assets/logo.png';
import {
  Container,
  Card,
  Form,
  Button,
  Alert,
  Spinner,
} from 'react-bootstrap';

export default function Login(): JSX.Element {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [isUsuarioInativo, setIsUsuarioInativo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  // Função para verificar o status do usuário nas coleções
  const verificarStatusUsuario = async (email: string) => {
    const colecoes = ['professores', 'alunos', 'responsaveis', 'administradores'];
    
    for (const colecao of colecoes) {
      try {
        const q = query(collection(db, colecao), where('email', '==', email.trim()));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          
          return {
            exists: true,
            status: userData.status || 'Ativo', // Default para "Ativo" se não tiver status
            tipo: colecao,
            userData: userData
          };
        }
      } catch (error) {
        console.error(`Erro ao buscar na coleção ${colecao}:`, error);
      }
    }
    
    return { exists: false, status: null, tipo: null, userData: null };
  };

  useEffect(() => {
    document.body.classList.add('login-page');
    return () => {
      document.body.classList.remove('login-page');
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setIsUsuarioInativo(false);
    setCarregando(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), senha);
      
      // Verificar status do usuário após autenticação
      const statusInfo = await verificarStatusUsuario(email.trim());
      
      if (statusInfo.exists && statusInfo.status === 'Inativo') {
        await auth.signOut(); // Fazer logout já que o usuário está inativo
        setErro('Entre em contato com o administrador.');
        setIsUsuarioInativo(true);
        return;
      }
      
      const userRef = doc(db, 'users', cred.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setErro('Usuário não encontrado no sistema.');
        return;
      }

      const userData = userSnap.data();

      // ✅ Salva o token FCM após login
      try {
        const fcmToken = await getToken(messaging, {
          vapidKey: 'BJDSxPQbrxJdHFfoe2J2fBTHOI2_GazsntSbQktyulx6Ct95d83KNYNL7GBfccYurEBZHNDYssqq8Fks6tbyxw',
        });

        if (fcmToken) {
          await updateDoc(userRef, { fcmToken });
        }
      } catch (err) {
        console.warn('Erro ao salvar token FCM:', err);
      }

      if (userData.firstAcesso) {
        navigate('/first-change-password');
      } else {
        const tipo = String(userData.tipo).toLowerCase();
        if (tipo === 'professores' || tipo === 'professor') {
          navigate('/dashboard-professor');
        } else if (tipo === 'administradores' || tipo === 'administrador' || tipo === 'admin') {
          navigate('/dashboard');
        } else if (tipo === 'alunos' || tipo === 'aluno') {
          navigate('/dashboard-aluno');
        } else if (tipo === 'responsaveis' || tipo === 'responsavel') {
          navigate('/dashboard-responsavel');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      console.error('Erro no login:', error);
      
      let errorMessage = 'Erro ao fazer login. Tente novamente.';
      
      if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Email ou senha incorretos. Verifique suas credenciais.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'Usuário não encontrado.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Senha incorreta.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Muitas tentativas de login. Tente novamente mais tarde.';
      }
      
      setErro(errorMessage);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Container
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}
    >
      <Card className="p-4 shadow-sm" style={{ width: '100%', maxWidth: '400px', borderRadius: '12px' }}>
        <div className="text-center mb-4">
          <img src={logo} alt="Logo do Portal da Escola" height="100" className="mb-3" />
          <h4 className="fw-bold text-primary">Portal da Escola</h4>
          <p className="text-muted mb-0">Acesse sua conta institucional</p>
        </div>

        {erro && (
          <Alert variant="danger" className="text-center">
            {isUsuarioInativo ? (
              <>
                <strong>Usuário inativo.</strong> {erro}
              </>
            ) : (
              erro
            )}
          </Alert>
        )}

        <Form onSubmit={handleLogin}>
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>E-mail</Form.Label>
            <Form.Control
              type="email"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="senha">
            <Form.Label>Senha</Form.Label>
            <Form.Control
              type="password"
              placeholder="Digite sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Form.Group>

          <Button type="submit" variant="primary" className="w-100" disabled={carregando}>
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
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </Form>

        <div className="text-center mt-3">
          <Link to="/forgot-password" className="text-primary" style={{ fontSize: '0.9rem', textDecoration: 'none' }}>
            Esqueceu sua senha?
          </Link>
        </div>
      </Card>
    </Container>
  );
}















  