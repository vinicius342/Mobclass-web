import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { doc, updateDoc } from "firebase/firestore";
import {
  Container,
  Card,
  Form,
  Button,
  Alert,
  Spinner,
} from "react-bootstrap";
import logo from "../assets/logo.png";

export default function FirstChangePassword() {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add("login-page");
    return () => document.body.classList.remove("login-page");
  }, []);

  const handleTrocarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setSucesso("");
    setCarregando(true);

    const user = auth.currentUser;

    if (!user || !user.email) {
      setErro("Usuário não autenticado.");
      setCarregando(false);
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro("As novas senhas não coincidem.");
      setCarregando(false);
      return;
    }

    try {
      const cred = EmailAuthProvider.credential(user.email, senhaAtual);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, novaSenha);

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { firstAcesso: false });

      setSucesso("Senha alterada com sucesso!");
      navigate("/dashboard");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/invalid-credential") {
        setErro("Senha atual incorreta. Tente novamente.");
      } else {
        setErro("Erro ao trocar a senha. Verifique os dados e tente novamente.");
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Container
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: "100vh", backgroundColor: "#f0f2f5" }}
    >
      <Card className="p-4 shadow-sm" style={{ width: "100%", maxWidth: "400px", borderRadius: "12px" }}>
        <div className="text-center mb-4">
          <img src={logo} alt="Logo do Portal da Escola" height="100" className="mb-3" />
          <h4 className="fw-bold text-primary">Trocar Senha</h4>
          <p className="text-muted mb-0">Informe sua nova senha de acesso</p>
        </div>

        {erro && <Alert variant="danger">{erro}</Alert>}
        {sucesso && <Alert variant="success">{sucesso}</Alert>}

        <Form onSubmit={handleTrocarSenha}>
          <Form.Group className="mb-3">
            <Form.Label>Senha Atual</Form.Label>
            <Form.Control
              type="password"
              placeholder="Digite sua senha atual"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Nova Senha</Form.Label>
            <Form.Control
              type="password"
              placeholder="Digite sua nova senha"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Confirmar Nova Senha</Form.Label>
            <Form.Control
              type="password"
              placeholder="Confirme sua nova senha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
            />
          </Form.Group>

          <Button type="submit" variant="primary" className="w-100" disabled={carregando}>
            {carregando ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                Trocando senha...
              </>
            ) : (
              "Alterar Senha"
            )}
          </Button>
        </Form>
      </Card>
    </Container>
  );
}


