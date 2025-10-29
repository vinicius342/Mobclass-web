import { useEffect, useState, JSX, useMemo } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Row, Col, Card, Spinner, Form
} from 'react-bootstrap';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell
} from 'recharts';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useAnoLetivoAtual } from '../hooks/useAnoLetivoAtual';
import { FaUserGraduate, FaChalkboardTeacher, FaUsers, FaClipboardList } from 'react-icons/fa';
import { BarChart3, Filter } from 'lucide-react';

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
interface NotaMediaPorTurma {
  turma: string;
  media: number;
}

export default function Dashboard(): JSX.Element {
  const { anoLetivo } = useAnoLetivoAtual();
  const { userData } = useAuth()!;
  const isAdmin = userData?.tipo === 'administradores';

  const [counts, setCounts] = useState<Counts | null>(null);
  const [freqData, setFreqData] = useState<FreqPorTurma[]>([]);
  const [freqDataOriginal, setFreqDataOriginal] = useState<any[]>([]);
  const [notaData, setNotaData] = useState<NotaMediaPorTurma[]>([]);
  const [notaDataOriginal, setNotaDataOriginal] = useState<any[]>([]);
  const [turmasLista, setTurmasLista] = useState<{ id: string; nome: string }[]>([]);
  const [materiasLista, setMateriasLista] = useState<{ id: string; nome: string }[]>([]);
  const [grupoTurmasSelecionado, setGrupoTurmasSelecionado] = useState<number>(-1); // -1 = todas
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState<string>('todas');
  const [tipoPeriodo, setTipoPeriodo] = useState<string>("");
  const [dataPersonalizada, setDataPersonalizada] = useState<string>("");
  const [mesSelecionado, setMesSelecionado] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [grupoTurmasAutoSelecionado, setGrupoTurmasAutoSelecionado] = useState<boolean>(false);

  // Divide as turmas em grupos de 5 - agora memoizado para evitar loop
  const gruposTurmas = useMemo(() => {
    const grupos: { id: string; nome: string }[][] = [];
    for (let i = 0; i < turmasLista.length; i += 5) {
      grupos.push(turmasLista.slice(i, i + 5));
    }
    return grupos;
  }, [turmasLista]);

  useEffect(() => {
    if (!isAdmin) return setLoading(false);

    async function fetchData() {
      try {
        const [alunosSnap, profSnap, turmasSnap, tarefasSnap, freqSnap, notasSnap, materiasSnap] = await Promise.all([
          getDocs(collection(db, 'alunos')),
          getDocs(collection(db, 'professores')),
          getDocs(query(collection(db, 'turmas'), where('anoLetivo', '==', anoLetivo.toString()))),
          getDocs(query(collection(db, 'tarefas'), where('anoLetivo', '==', anoLetivo.toString()))),
          getDocs(collection(db, 'frequencias')),
          getDocs(collection(db, 'notas')),
          getDocs(collection(db, 'materias')),
        ]);

        const turmas = turmasSnap.docs
          .map(doc => ({ id: doc.id, nome: (doc.data() as any).nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome));
        setTurmasLista(turmas);

        const materias = materiasSnap.docs
          .map(doc => ({ id: doc.id, nome: (doc.data() as any).nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome));
        setMateriasLista(materias);

        setCounts({
          alunos: alunosSnap.size,
          professores: profSnap.size,
          turmas: turmas.length,
          atividades: tarefasSnap.docs.filter(doc => doc.data()?.anoLetivo?.toString() === anoLetivo.toString()).length,
        });

        const freqDocs = freqSnap.docs.map(d => d.data()).filter((f: any) => turmas.some(t => t.id === f.turmaId));
        setFreqDataOriginal(freqDocs);

        const freqResults: FreqPorTurma[] = turmas.map(turma => {
          const turmaFreq = freqDocs.filter((f: any) => f.turmaId === turma.id);
          const total = turmaFreq.length;
          const presentes = turmaFreq.filter((f: any) => f.presenca).length;
          const taxa = total ? (presentes / total) * 100 : 0;
          return { turma: turma.nome, taxa: parseFloat(taxa.toFixed(2)) };
        });
        setFreqData(freqResults);

        const notaDocs = notasSnap.docs.map(d => d.data()).filter((n: any) => turmas.some(t => t.id === n.turmaId));

        // Salvar dados originais das notas para filtragem posterior
        setNotaDataOriginal(notaDocs);

        // Calcular nota média por turma
        const notaResults: NotaMediaPorTurma[] = turmas.map(turma => {
          let notasTurma = notaDocs.filter(n => n.turmaId === turma.id);

          // Filtrar por disciplina se houver uma selecionada
          if (disciplinaSelecionada !== 'todas') {
            notasTurma = notasTurma.filter(n => n.materiaId === disciplinaSelecionada);
          }

          const somaMedias = notasTurma.reduce((acc, cur) => {
            const parcial = typeof cur.notaParcial === 'number' ? cur.notaParcial : 0;
            const global = typeof cur.notaGlobal === 'number' ? cur.notaGlobal : 0;
            const participacao = typeof cur.notaParticipacao === 'number' ? cur.notaParticipacao : 0;
            const mediaFinal = ((parcial + global) / 2) + participacao;
            return acc + mediaFinal;
          }, 0);
          const media = notasTurma.length ? somaMedias / notasTurma.length : 0;
          return {
            turma: turma.nome,
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
  }, [isAdmin, anoLetivo, disciplinaSelecionada]);

  // Seleciona automaticamente o grupo de turmas com melhor taxa de frequência média
  useEffect(() => {
    if (freqData.length === 0 || gruposTurmas.length === 0 || grupoTurmasAutoSelecionado) return;
    let melhorMedia = -Infinity;
    let melhorGrupo = -1;
    gruposTurmas.forEach((grupo, idx) => {
      // Pega nomes das turmas do grupo
      const nomesTurmas = grupo.map(t => t.nome);
      // Filtra freqData das turmas desse grupo
      const freqDoGrupo = freqData.filter(f => nomesTurmas.includes(f.turma));
      // Calcula média das taxas
      const media = freqDoGrupo.length > 0 ? freqDoGrupo.reduce((acc, cur) => acc + cur.taxa, 0) / freqDoGrupo.length : 0;
      if (media > melhorMedia) {
        melhorMedia = media;
        melhorGrupo = idx;
      }
    });
    if (melhorGrupo !== -1) {
      setGrupoTurmasSelecionado(melhorGrupo);
      setGrupoTurmasAutoSelecionado(true);
    }
  }, [freqData, gruposTurmas, grupoTurmasAutoSelecionado]);

  // Recalcular frequência quando disciplina ou período mudar
  useEffect(() => {
    if (!isAdmin || freqDataOriginal.length === 0 || turmasLista.length === 0) return;

    const freqResults: FreqPorTurma[] = turmasLista.map(turma => {
      let turmaFreq = freqDataOriginal.filter((f: any) => f.turmaId === turma.id);

      // Filtrar por disciplina se selecionada
      if (disciplinaSelecionada !== 'todas') {
        turmaFreq = turmaFreq.filter((f: any) => f.materiaId === disciplinaSelecionada);
      }

      // Filtrar por período
      if (tipoPeriodo === 'hoje') {
        const hoje = new Date().toISOString().split('T')[0];
        turmaFreq = turmaFreq.filter((f: any) => f.data === hoje);
      } else if (tipoPeriodo === 'mes' && mesSelecionado) {
        const anoAtual = new Date().getFullYear();
        turmaFreq = turmaFreq.filter((f: any) => {
          if (!f.data) return false;
          const dataFreq = new Date(f.data);
          return dataFreq.getFullYear() === anoAtual &&
            (dataFreq.getMonth() + 1).toString().padStart(2, '0') === mesSelecionado;
        });
      } else if (tipoPeriodo === 'personalizado' && dataPersonalizada) {
        turmaFreq = turmaFreq.filter((f: any) => f.data === dataPersonalizada);
      }

      const total = turmaFreq.length;
      const presentes = turmaFreq.filter((f: any) => f.presenca).length;
      const taxa = total ? (presentes / total) * 100 : 0;
      return { turma: turma.nome, taxa: parseFloat(taxa.toFixed(2)) };
    });
    setFreqData(freqResults);
  }, [disciplinaSelecionada, tipoPeriodo, mesSelecionado, dataPersonalizada, freqDataOriginal, turmasLista, isAdmin]);

  // Recalcular notas quando filtros de turma ou disciplina mudarem
  useEffect(() => {
    if (!isAdmin || notaDataOriginal.length === 0 || turmasLista.length === 0) return;

    // Calcular nota média por turma
    let turmasParaCalcular = turmasLista;

    // Se um grupo de turmas específico foi selecionado, usar apenas essas turmas
    if (grupoTurmasSelecionado !== -1) {
      turmasParaCalcular = gruposTurmas[grupoTurmasSelecionado] || [];
    }

    const notaResults: NotaMediaPorTurma[] = turmasParaCalcular.map(turma => {
      let notasTurma = notaDataOriginal.filter(n => n.turmaId === turma.id);

      // Filtrar por disciplina se selecionada
      if (disciplinaSelecionada !== 'todas') {
        notasTurma = notasTurma.filter(n => n.materiaId === disciplinaSelecionada);
      }

      const somaMedias = notasTurma.reduce((acc, cur) => {
        const parcial = typeof cur.notaParcial === 'number' ? cur.notaParcial : 0;
        const global = typeof cur.notaGlobal === 'number' ? cur.notaGlobal : 0;
        const participacao = typeof cur.notaParticipacao === 'number' ? cur.notaParticipacao : 0;
        const mediaFinal = ((parcial + global) / 2) + participacao;
        return acc + mediaFinal;
      }, 0);
      const media = notasTurma.length ? somaMedias / notasTurma.length : 0;
      return {
        turma: turma.nome,
        media: parseFloat(media.toFixed(2))
      };
    });

    setNotaData(notaResults);
  }, [grupoTurmasSelecionado, disciplinaSelecionada, notaDataOriginal, turmasLista, gruposTurmas, isAdmin]);

  if (loading) {
    return (
      <AppLayout>
        <Container className="d-flex justify-content-center align-items-center vh-75">
          <Spinner animation="border" />
        </Container>
      </AppLayout>
    );
  }

  const dadosFreqFiltrados = grupoTurmasSelecionado === -1
    ? freqData
    : freqData.filter(f => gruposTurmas[grupoTurmasSelecionado]?.some(t => t.nome === f.turma));

  const dadosNotaFiltrados = notaData; // Mostrar todas as turmas, mesmo com média 0

  return (
    <AppLayout>
      <Container className="my-4">
        <div className="border-gray-200 mb-3">
          {/* Header */}
          <div className="mb-4 px-1">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center gap-2">
                <BarChart3 size={32} color="#2563eb" style={{ minWidth: 32, minHeight: 32 }} />
                <h1
                  className="fw-bold mb-0"
                  style={{
                    fontSize: '2rem',
                    background: 'linear-gradient(135deg, #1e293b 0%, #2563eb 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  Dashboard
                </h1>
              </div>
            </div>
            <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
              Bem-vindo(a) ao MobClassApp!
            </p>
          </div>
        </div>

        {isAdmin ? (
          <>
            <Row xs={1} sm={2} md={4} className="g-3">
              <DashboardCard icon={<FaUserGraduate size={30} color="#22c55e" />} title="Alunos" value={counts?.alunos} />
              <DashboardCard icon={<FaChalkboardTeacher size={30} color="#a259e6" />} title="Professores" value={counts?.professores} />
              <DashboardCard icon={<FaUsers size={30} color="#3b82f6" />} title="Turmas" value={counts?.turmas} />
              <DashboardCard icon={<FaClipboardList size={30} color="#ff9800" />} title="Atividades" value={counts?.atividades} />
            </Row>

            <Card className="shadow-sm mt-3 mb-3" style={{ boxShadow: '0 0 0 2px #2563eb33' }}>
              <Card.Body>
                <h5 className="px-1 mb-2 d-flex align-items-center gap-2" style={{ fontWeight: 500 }}>
                  <Filter className='text-muted' size={20} />
                  Filtros
                </h5>
                <Row className="g-3">
                  <Col md={3}>
                    <Form.Label className="small text-muted">Turmas (5 por opção)</Form.Label>
                    <Form.Select
                      value={grupoTurmasSelecionado}
                      onChange={e => {
                        setGrupoTurmasSelecionado(Number(e.target.value));
                        setGrupoTurmasAutoSelecionado(true);
                      }}
                    >
                      <option value={-1} disabled hidden>Selecione as turmas</option>
                      {gruposTurmas.map((grupo, idx) => {
                        const primeiro = grupo[0]?.nome || '';
                        const ultimo = grupo[grupo.length - 1]?.nome || '';
                        return (
                          <option key={idx} value={idx}>{primeiro} - {ultimo}</option>
                        );
                      })}
                    </Form.Select>
                  </Col>
                  <Col md={3}>
                    <Form.Label className="small text-muted">Disciplinas</Form.Label>
                    <Form.Select
                      value={disciplinaSelecionada}
                      onChange={e => setDisciplinaSelecionada(e.target.value)}
                    >
                      <option value="todas">Todas as Disciplinas</option>
                      {materiasLista.map(materia => (
                        <option key={materia.id} value={materia.id}>
                          {materia.nome}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={3}>
                    <Form.Label className="small text-muted">Tipo de Período</Form.Label>
                    <Form.Select value={tipoPeriodo} onChange={e => setTipoPeriodo(e.target.value)}>
                      <option value="">Selecione o período</option>
                      <option value="hoje">Hoje</option>
                      <option value="mes">Mês</option>
                      <option value="personalizado">Personalizado</option>
                    </Form.Select>
                  </Col>
                  {tipoPeriodo === 'personalizado' && (
                    <Col md={3}>
                      <Form.Label className="small text-muted">Data Personalizada</Form.Label>
                      <Form.Control
                        type="date"
                        value={dataPersonalizada}
                        onChange={e => setDataPersonalizada(e.target.value)}
                        placeholder="Selecione uma data"
                      />
                    </Col>
                  )}
                  {tipoPeriodo === 'mes' && (
                    <Col md={3}>
                      <Form.Label className="small text-muted">Selecione o Mês</Form.Label>
                      <Form.Select
                        value={mesSelecionado}
                        onChange={e => setMesSelecionado(e.target.value)}
                      >
                        <option value="">Selecione o mês</option>
                        <option value="01">Janeiro</option>
                        <option value="02">Fevereiro</option>
                        <option value="03">Março</option>
                        <option value="04">Abril</option>
                        <option value="05">Maio</option>
                        <option value="06">Junho</option>
                        <option value="07">Julho</option>
                        <option value="08">Agosto</option>
                        <option value="09">Setembro</option>
                        <option value="10">Outubro</option>
                        <option value="11">Novembro</option>
                        <option value="12">Dezembro</option>
                      </Form.Select>
                    </Col>
                  )}
                </Row>
              </Card.Body>
            </Card>

            <Row xs={1} lg={2} className="g-4">
              <Col>
                <Card className="p-1 h-100">
                  <Card.Header className="fw-bold bg-white" style={{ borderBottom: '0' }}>Taxa de Frequência por Turmas</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dadosFreqFiltrados}>
                        <XAxis
                          dataKey="turma"
                          tick={{ fontSize: 11, fontStyle: 'italic', fill: '#495057', dy: 10, dx: -10 }}
                          angle={-20}
                        />
                        <YAxis
                          domain={[0, 100]}
                          unit="%"
                          tick={{ fontSize: 14, fill: '#495057' }}
                        />
                        <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                        <Bar
                          dataKey="taxa"
                          label={{ position: 'top' }}
                          fill="#8884d8"
                          radius={[5, 5, 0, 0]}
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
                <Card className="h-100 pt-1 px-1">
                  <Card.Header className="fw-bold bg-white" style={{ borderBottom: '0' }}>Nota Média por Turma</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={dadosNotaFiltrados} margin={{ left: 0, right: 20, top: 5, bottom: 6 }}>
                        {/* <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" /> */}
                        <XAxis
                          dataKey="turma"
                          tick={{ fontSize: 11, fontStyle: 'italic', fill: '#495057', dy: 10, dx: -10 }}
                          angle={-20}
                          interval={0}
                        />
                        <YAxis
                          domain={[0, 10]}
                          tick={{ fontSize: 14, fill: '#495057' }}
                        />
                        <Tooltip formatter={(value: number) => `${value.toFixed(2)} pts`} />
                        <Line
                          type="monotone"
                          dataKey="media"
                          stroke="#007bff"
                          dot={{ stroke: '#007bff', strokeWidth: 2, fill: '#fff', r: 5 }}
                          activeDot={{ r: 8 }}
                        />
                        {/* <Legend /> */}
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
      <Card className="shadow-sm p-2 mb-0">
        <Card.Body>
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex flex-column align-items-start">
              <Card.Title className="mb-1" style={{ fontSize: '1.1rem', color: '#3b4861' }}>{title}</Card.Title>
              <span className="fs-3 fw-bold">{value ?? 0}</span>
            </div>
            <div className="d-flex align-items-center ms-3">
              <span className="fs-2 text-secondary">{icon}</span>
            </div>
          </div>
        </Card.Body>
      </Card>
    </Col>
  );
}












