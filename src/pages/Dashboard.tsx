import { useEffect, useState, JSX } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Row, Col, Card, Spinner, Form
} from 'react-bootstrap';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell
} from 'recharts';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FaUserGraduate, FaChalkboardTeacher, FaUsers, FaClipboardList } from 'react-icons/fa';

interface Counts {
  alunos: number;
  professores: number;
  turmas: number;
  atividades: number;
}
interface FreqPorTurma {
  turma: string;
  taxa: number;
}
interface NotaMediaPorDisciplina {
  disciplina: string;
  media: number;
}

export default function Dashboard(): JSX.Element {
  const { userData } = useAuth()!;
  const isAdmin = userData?.tipo === 'administradores';

  const [counts, setCounts] = useState<Counts | null>(null);
  const [freqData, setFreqData] = useState<FreqPorTurma[]>([]);
  const [notaData, setNotaData] = useState<NotaMediaPorDisciplina[]>([]);
  const [turmasLista, setTurmasLista] = useState<{ id: string; nome: string }[]>([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState<string>('todas');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return setLoading(false);

    async function fetchData() {
      try {
        const [alunosSnap, profSnap, turmasSnap, tarefasSnap, freqSnap, notasSnap, materiasSnap] = await Promise.all([
          getDocs(collection(db, 'alunos')),
          getDocs(collection(db, 'professores')),
          getDocs(collection(db, 'turmas')),
          getDocs(collection(db, 'tarefas')),
          getDocs(collection(db, 'frequencias')),
          getDocs(collection(db, 'notas')),
          getDocs(collection(db, 'materias')),
        ]);

        const turmas = turmasSnap.docs
          .map(doc => ({ id: doc.id, nome: (doc.data() as any).nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome));
        setTurmasLista(turmas);

        setCounts({
          alunos: alunosSnap.size,
          professores: profSnap.size,
          turmas: turmas.length,
          atividades: tarefasSnap.size,
        });

        const freqDocs = freqSnap.docs.map(d => d.data());
        const freqResults: FreqPorTurma[] = turmas.map(turma => {
          const turmaFreq = freqDocs.filter((f: any) => f.turmaId === turma.id);
          const total = turmaFreq.length;
          const presentes = turmaFreq.filter((f: any) => f.presenca).length;
          const taxa = total ? (presentes / total) * 100 : 0;
          return { turma: turma.nome, taxa: parseFloat(taxa.toFixed(2)) };
        });
        setFreqData(freqResults);

        const notaDocs = notasSnap.docs.map(d => d.data());
        const materiasMap = new Map(materiasSnap.docs.map(doc => [doc.id, (doc.data() as any).nome]));

        const materiasFiltradas = Array.from(new Set(notaDocs.map(n => n.materiaId)));

        const notaResults: NotaMediaPorDisciplina[] = materiasFiltradas.map(materiaId => {
          const notasMateria = notaDocs.filter(n =>
            n.materiaId === materiaId &&
            (turmaSelecionada === 'todas' || n.turmaId === turmaSelecionada)
          );

          const somaMedias = notasMateria.reduce((acc, cur) => {
            const parcial = typeof cur.notaParcial === 'number' ? cur.notaParcial : 0;
            const global = typeof cur.notaGlobal === 'number' ? cur.notaGlobal : 0;
            const participacao = typeof cur.notaParticipacao === 'number' ? cur.notaParticipacao : 0;
            const mediaFinal = ((parcial + global) / 2) + participacao;
            return acc + mediaFinal;
          }, 0);

          const media = notasMateria.length ? somaMedias / notasMateria.length : 0;
          return {
            disciplina: materiasMap.get(materiaId) || 'Matéria Desconhecida',
            media: parseFloat(media.toFixed(2))
          };
        });

        setNotaData(notaResults);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isAdmin, turmaSelecionada]);

  if (loading) {
    return (
      <AppLayout>
        <Container className="d-flex justify-content-center align-items-center vh-75">
          <Spinner animation="border" />
        </Container>
      </AppLayout>
    );
  }

  const dadosFreqFiltrados = turmaSelecionada === 'todas'
    ? freqData
    : freqData.filter(f => f.turma === turmasLista.find(t => t.id === turmaSelecionada)?.nome);

  const dadosNotaFiltrados = notaData.filter(n => n.media > 0);

  return (
    <AppLayout>
      <Container className="my-4">
        <h4 className="mb-3">Bem-vindo(a), {userData?.nome || 'usuário'}!</h4>

        {isAdmin ? (
          <>
            <Row xs={1} sm={2} md={4} className="g-3">
              <DashboardCard icon={<FaUserGraduate size={30} />} title="Alunos" value={counts?.alunos} />
              <DashboardCard icon={<FaChalkboardTeacher size={30} />} title="Professores" value={counts?.professores} />
              <DashboardCard icon={<FaUsers size={30} />} title="Turmas" value={counts?.turmas} />
              <DashboardCard icon={<FaClipboardList size={30} />} title="Atividades" value={counts?.atividades} />
            </Row>

            <Form.Select
              className="w-auto mt-4 mb-3"
              value={turmaSelecionada}
              onChange={(e) => setTurmaSelecionada(e.target.value)}
            >
              <option value="todas">Todas as Turmas</option>
              {turmasLista.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </Form.Select>

            <Row xs={1} lg={2} className="g-4">
              <Col>
                <Card className="shadow-sm h-100">
                  <Card.Header className="fw-bold">Taxa de Frequência por Turma</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dadosFreqFiltrados}>
                        <XAxis dataKey="turma" />
                        <YAxis domain={[0, 100]} unit="%" />
                        <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                        <Bar
                          dataKey="taxa"
                          label={{ position: 'top', formatter: (v: number) => `${v}%` }}
                          fill="#8884d8"
                        >
                          {dadosFreqFiltrados.map((entry, index) => {
                            const color =
                              entry.taxa >= 85 ? '#28a745' : entry.taxa >= 60 ? '#ffc107' : '#dc3545';
                            return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>

              <Col>
                <Card className="shadow-sm h-100">
                  <Card.Header className="fw-bold">Nota Média por Matéria</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={dadosNotaFiltrados}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="disciplina" />
                        <YAxis domain={[0, 10]} />
                        <Tooltip formatter={(value: number) => `${value.toFixed(2)} pts`} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="media"
                          stroke="#007bff"
                          dot={{ stroke: '#007bff', strokeWidth: 2, fill: '#fff', r: 5 }}
                          activeDot={{ r: 8 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        ) : (
          <p className="mt-4">Você está logado como <strong>{userData?.tipo}</strong>.</p>
        )}
      </Container>
    </AppLayout>
  );
}

function DashboardCard({ icon, title, value }: { icon: JSX.Element; title: string; value?: number }) {
  return (
    <Col>
      <Card className="text-center shadow-sm h-100">
        <Card.Body>
          <div className="mb-2">{icon}</div>
          <Card.Title>{title}</Card.Title>
          <Card.Text className="fs-2 fw-bold">{value ?? 0}</Card.Text>
        </Card.Body>
      </Card>
    </Col>
  );
}












