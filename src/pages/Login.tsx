import { JSX, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { auth, db, messaging } from '../services/firebase';
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
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  // Função para verificar o status do usuário nas coleções
  const verificarStatusUsuario = async (email: string) => {
    console.log('🔍 Verificando status do usuário:', email);
    const colecoes = ['professores', 'alunos', 'responsaveis', 'administradores'];
    
    for (const colecao of colecoes) {
      console.log(`🔍 Buscando na coleção: ${colecao}`);
      try {
        const q = query(collection(db, colecao), where('email', '==', email.trim()));
        const querySnapshot = await getDocs(q);
        
        console.log(`📊 Documentos encontrados na coleção ${colecao}:`, querySnapshot.size);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          console.log(`✅ Usuário encontrado na coleção ${colecao}:`, userData);
          console.log(`📋 Status do usuário:`, userData.status || 'Não definido (assumindo Ativo)');
          
          return {
            exists: true,
            status: userData.status || 'Ativo', // Default para "Ativo" se não tiver status
            tipo: colecao,
            userData: userData
          };
        }
      } catch (error) {
        console.error(`❌ Erro ao buscar na coleção ${colecao}:`, error);
      }
    }
    
    console.log('❌ Usuário não encontrado em nenhuma coleção');
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
    setCarregando(true);

    try {
      console.log('🔐 Iniciando autenticação Firebase...');
      console.log('📧 Email para autenticação:', email.trim());
      console.log('🔑 Senha possui caracteres:', senha.length > 0 ? 'Sim' : 'Não');
      
      const cred = await signInWithEmailAndPassword(auth, email.trim(), senha);
      console.log('✅ Autenticação Firebase realizada com sucesso:', cred.user.email);
      
      // Verificar status do usuário após autenticação
      console.log('📝 Verificando status do usuário...');
      const statusInfo = await verificarStatusUsuario(email.trim());
      
      if (statusInfo.exists && statusInfo.status === 'Inativo') {
        console.log('🚫 Login negado: usuário inativo');
        await auth.signOut(); // Fazer logout já que o usuário está inativo
        setErro('Usuário inativo. Entre em contato com o administrador.');
        return;
      }
      
      console.log('✅ Status válido, prosseguindo com login...');
      
      const userRef = doc(db, 'users', cred.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setErro('Usuário não encontrado no sistema.');
        return;
      }

      const userData = userSnap.data();
      console.log('Dados do usuário logado:', userData);

      // ✅ Salva o token FCM após login
      try {
        const fcmToken = await getToken(messaging, {
          vapidKey: 'BJDSxPQbrxJdHFfoe2J2fBTHOI2_GazsntSbQktyulx6Ct95d83KNYNL7GBfccYurEBZHNDYssqq8Fks6tbyxw',
        });

        if (fcmToken) {
          await updateDoc(userRef, { fcmToken });
          console.log('✅ Token FCM salvo:', fcmToken);
        } else {
          console.warn('⚠️ Token FCM retornado como null');
        }
      } catch (err) {
        console.warn('⚠️ Erro ao salvar token FCM:', err);
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
      console.error('❌ Erro completo no login:', error);
      console.error('❌ Código do erro:', error.code);
      console.error('❌ Mensagem do erro:', error.message);
      
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
            {erro}
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















  