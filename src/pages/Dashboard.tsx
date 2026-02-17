import { useEffect, useState, JSX, useMemo } from 'react';
import AppLayout from '../components/layout/AppLayout';
import {
  Container, Row, Col, Card, Spinner, Form
} from 'react-bootstrap';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useAnoLetivoAtual } from '../hooks/useAnoLetivoAtual';
import { FaUserGraduate, FaChalkboardTeacher, FaUsers, FaClipboardList } from 'react-icons/fa';
import { BarChart3, Filter } from 'lucide-react';

// Services
import { turmaService } from '../services/data/TurmaService';
import { MateriaService } from '../services/data/MateriaService';
import { AlunoService } from '../services/usuario/AlunoService';
import { ProfessorService } from '../services/data/ProfessorService';
import { TarefaService } from '../services/data/TarefaService';
import { FrequenciaService } from '../services/data/FrequenciaService';
import { notaService } from '../services/data/NotaService';

// Instanciar services
const materiaService = new MateriaService();
const alunoService = new AlunoService();
const professorService = new ProfessorService();
const tarefaService = new TarefaService();
const frequenciaService = new FrequenciaService();

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
  const [notaData, setNotaData] = useState<NotaMediaPorTurma[]>([]);
  const [turmasLista, setTurmasLista] = useState<{ id: string; nome: string }[]>([]);
  const [materiasLista, setMateriasLista] = useState<{ id: string; nome: string }[]>([]);
  const [grupoTurmasSelecionado, setGrupoTurmasSelecionado] = useState<number>(-1); // -1 = todas
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState<string>('todas');
  const [tipoPeriodo, setTipoPeriodo] = useState<string>("");
  const [dataPersonalizada, setDataPersonalizada] = useState<string>("");
  const [mesSelecionado, setMesSelecionado] = useState<string>("");
  const [loadingCards, setLoadingCards] = useState(true);
  const [loadingGraficos, setLoadingGraficos] = useState(false);
  const [grupoTurmasAutoSelecionado, setGrupoTurmasAutoSelecionado] = useState<boolean>(false);

  // Divide as turmas em grupos de 5 - separa turmas que iniciam com letra das que iniciam com número
  const gruposTurmas = useMemo(() => {
    // Separar turmas que iniciam com letra e com número
    const turmasComLetra = turmasLista.filter(t => /^[a-zA-Z]/.test(t.nome));
    const turmasComNumero = turmasLista.filter(t => /^[0-9]/.test(t.nome));

    const grupos: { id: string; nome: string }[][] = [];

    // Adicionar grupos de turmas com letra (5 por grupo)
    for (let i = 0; i < turmasComLetra.length; i += 5) {
      grupos.push(turmasComLetra.slice(i, i + 5));
    }

    // Adicionar grupos de turmas com número (5 por grupo)
    for (let i = 0; i < turmasComNumero.length; i += 5) {
      grupos.push(turmasComNumero.slice(i, i + 5));
    }

    return grupos;
  }, [turmasLista]);

  // Etapa 1: Carrega apenas cards principais (rápido)
  useEffect(() => {
    if (!isAdmin) {
      setLoadingCards(false);
      return;
    }

    async function fetchCards() {
      try {
        const [alunos, professores, turmas, tarefas] = await Promise.all([
          alunoService.listar(),
          professorService.listar(),
          turmaService.listarPorAnoLetivo(anoLetivo.toString()),
          tarefaService.listarTarefas(),
        ]);

        // Processa em setTimeout para não bloquear
        setTimeout(() => {
          setTurmasLista(turmas.sort((a, b) => a.nome.localeCompare(b.nome)));

          setCounts({
            alunos: alunos.length,
            professores: professores.length,
            turmas: turmas.length,
            atividades: tarefas.length,
          });

          setLoadingCards(false);
          // Inicia carregamento dos gráficos após 150ms para dar tempo da UI responder
          setTimeout(() => setLoadingGraficos(true), 150);
        }, 0);
      } catch (error) {
        console.error('Erro ao carregar cards:', error);
        setLoadingCards(false);
      }
    }

    fetchCards();
  }, [isAdmin, anoLetivo]);

  // Etapa 2: Carrega gráficos de forma assíncrona (não bloqueia UI)
  useEffect(() => {
    if (!isAdmin || !loadingGraficos) return;

    // Se não há turmas, não há o que carregar - finaliza o loading
    if (turmasLista.length === 0) {
      setLoadingGraficos(false);
      return;
    }

    async function fetchGraficos() {
      try {
        const materias = await materiaService.listar();

        // Processa matérias
        setTimeout(() => {
          setMateriasLista(materias);

          // Carrega frequências de forma otimizada - apenas dados agregados
          setTimeout(async () => {
            try {
              const turmaIds = turmasLista.map(t => t.id);
              const resultados = await frequenciaService.calcularTaxasDashboard(turmaIds);
              
              // Mapeia resultados para o formato esperado
              const freqResults = turmasLista.map(turma => {
                const resultado = resultados.find(r => r.turmaId === turma.id);
                return {
                  turma: turma.nome,
                  taxa: resultado?.taxa || 0
                };
              });
              
              setFreqData(freqResults);
              setLoadingGraficos(false);
            } catch (error) {
              console.error('Erro ao carregar taxas de frequência:', error);
              setFreqData([]);
              setLoadingGraficos(false);
            }
          }, 0);
        }, 0);
      } catch (error) {
        console.error('Erro ao carregar gráficos:', error);
        setLoadingGraficos(false);
      }
    }

    fetchGraficos();
  }, [isAdmin, loadingGraficos, turmasLista]);

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
    if (!isAdmin || turmasLista.length === 0) return;

    async function recarregarFrequencias() {
      try {
        const filtros: any = {};

        // Filtrar por disciplina
        if (disciplinaSelecionada !== 'todas') {
          filtros.materiaId = disciplinaSelecionada;
        }

        // Filtrar por período
        if (tipoPeriodo) {
          filtros.periodo = {
            tipo: tipoPeriodo as 'hoje' | 'mes' | 'personalizado',
            data: dataPersonalizada,
            mes: mesSelecionado,
            ano: anoLetivo
          };
        }

        const turmaIds = turmasLista.map(t => t.id);
        const resultados = await frequenciaService.calcularTaxasDashboard(
          turmaIds,
          Object.keys(filtros).length > 0 ? filtros : undefined
        );

        // Mapeia resultados para o formato esperado
        const freqResults = turmasLista.map(turma => {
          const resultado = resultados.find(r => r.turmaId === turma.id);
          return {
            turma: turma.nome,
            taxa: resultado?.taxa || 0
          };
        });

        setFreqData(freqResults);
      } catch (error) {
        console.error('Erro ao recalcular frequências:', error);
      }
    }

    recarregarFrequencias();
  }, [disciplinaSelecionada, tipoPeriodo, mesSelecionado, dataPersonalizada, turmasLista, isAdmin, anoLetivo]);

  // Recalcular notas quando filtros de turma ou disciplina mudarem
  useEffect(() => {
    if (!isAdmin || turmasLista.length === 0) return;

    // Calcular nota média por turma
    let turmasParaCalcular = turmasLista;

    // Se um grupo de turmas específico foi selecionado, usar apenas essas turmas
    if (grupoTurmasSelecionado !== -1) {
      turmasParaCalcular = gruposTurmas[grupoTurmasSelecionado] || [];
    }

    const turmaIds = turmasParaCalcular.map(t => t.id);
    const materiaId = disciplinaSelecionada !== 'todas' ? disciplinaSelecionada : undefined;

    (async () => {
      try {
        const medias = await notaService.listarMediasPorTurma(turmaIds, materiaId);
        const resultado = medias.map(m => {
          const turma =
            turmasParaCalcular.find(t => t.id === m.turmaId) ||
            turmasLista.find(t => t.id === m.turmaId);

          return {
            turma: turma ? turma.nome : m.turmaId,
            media: m.media,
          };
        });
        setNotaData(resultado);
      } catch (error) {
        console.error('Erro ao carregar médias por turma:', error);
      }
    })();
  }, [grupoTurmasSelecionado, disciplinaSelecionada, turmasLista, gruposTurmas, isAdmin]);

  const dadosFreqFiltrados = grupoTurmasSelecionado === -1
    ? freqData
    : freqData.filter(f => gruposTurmas[grupoTurmasSelecionado]?.some(t => t.nome === f.turma));

  const dadosNotaFiltrados = notaData; // Mostrar todas as turmas, mesmo com média 0

  return (
    <AppLayout>
      <Container className="my-4">
        <Row className="align-items-center">
          {/* Header */}
          <Col md={9}>
            <div className="border-gray-200 mb-3">
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
          </Col>
          <Col md={3}>
            <Card className="shadow-sm mb-3" style={{
              boxShadow: '0 0 0 2px #2563eb33',
            }}>
              <Card.Body className="py-3">
                <div className="d-flex align-items-center gap-2">
                  <div>
                    <h6 className="mb-0" style={{ fontWeight: 600, color: '#1e40af' }}>
                      Ano Letivo {anoLetivo}
                    </h6>
                    <small className="text-muted">
                      Sistema de Gestão Escolar
                    </small>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {loadingCards ? (
          <Container className="d-flex justify-content-center align-items-center py-5">
            <Spinner animation="border" />
          </Container>
        ) : isAdmin ? (
          <>
            <Row xs={1} sm={2} md={4} className="g-3">
              <DashboardCard icon={<FaUserGraduate size={30} color="#22c55e" />} title="Alunos" value={counts?.alunos} />
              <DashboardCard icon={<FaChalkboardTeacher size={30} color="#a259e6" />} title="Professores" value={counts?.professores} />
              <DashboardCard icon={<FaUsers size={30} color="#3b82f6" />} title="Turmas" value={counts?.turmas} />
              <DashboardCard icon={<FaClipboardList size={30} color="#ff9800" />} title="Atividades" value={counts?.atividades} />
            </Row>

            {loadingGraficos ? (
              <Container className="d-flex justify-content-center align-items-center py-5">
                <Spinner animation="border" />
              </Container>
            ) : (
              <>
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

                {turmasLista.length === 0 ? (
                  <Card className="shadow-sm mt-3" style={{ boxShadow: '0 0 0 2px #fbbf2433' }}>
                    <Card.Body className="text-center py-5">
                      <div style={{
                        fontSize: '3rem',
                        color: '#fbbf24',
                        marginBottom: '1rem'
                      }}>
                        📊
                      </div>
                      <p className="text-muted mb-0">
                        Forme as turmas para visualizar os gráficos de desempenho e frequência do ano letivo {anoLetivo}.
                      </p>
                    </Card.Body>
                  </Card>
                ) : gruposTurmas.length === 0 || grupoTurmasSelecionado === -1 ? (
                  <Card className="shadow-sm mt-3" style={{ boxShadow: '0 0 0 2px #3b82f633' }}>
                    <Card.Body className="text-center py-5">
                      <div style={{
                        fontSize: '3rem',
                        color: '#3b82f6',
                        marginBottom: '1rem'
                      }}>
                        🔍
                      </div>
                      <h5 className="mb-2" style={{ color: '#78716c' }}>
                        Selecione um grupo de turmas
                      </h5>
                      <p className="text-muted mb-0">
                        Utilize o filtro acima para selecionar as turmas que deseja visualizar.
                      </p>
                    </Card.Body>
                  </Card>
                ) : (
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
                )}
              </>
            )}
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
