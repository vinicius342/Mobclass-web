// DashboardProfessor.tsx - Atualizado para filtrar cards e gráficos por vínculos
import { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Container, Row, Col, Card, Spinner, Button } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip,
  Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { FaTasks, FaCalendarAlt, FaBullhorn } from 'react-icons/fa';

// Services
import { ProfessorMateriaService } from '../services/data/ProfessorMateriaService';
import { FirebaseProfessorMateriaRepository } from '../repositories/professor_materia/FirebaseProfessorMateriaRepository';
import { TarefaService } from '../services/data/TarefaService';
import { FirebaseTarefaRepository } from '../repositories/tarefa/FirebaseTarefaRepository';
import { FirebaseEntregaRepository } from '../repositories/entrega/FirebaseEntregaRepository';
import { AgendaService } from '../services/data/AgendaService';
import { FirebaseAgendaRepository } from '../repositories/agenda/FirebaseAgendaRepository';
import { ComunicadoService } from '../services/data/ComunicadoService';
import { FirebaseComunicadoRepository } from '../repositories/comunicado/FirebaseComunicadoRepository';
import { FrequenciaService } from '../services/data/FrequenciaService';
import { FirebaseFrequenciaRepository } from '../repositories/frequencia/FirebaseFrequenciaRepository';
import { NotaService } from '../services/data/NotaService';
import { FirebaseNotaRepository } from '../repositories/nota/FirebaseNotaRepository';

// Instanciar services
const professorMateriaService = new ProfessorMateriaService(new FirebaseProfessorMateriaRepository());
const tarefaService = new TarefaService(new FirebaseTarefaRepository(), new FirebaseEntregaRepository());
const agendaService = new AgendaService(new FirebaseAgendaRepository());
const comunicadoService = new ComunicadoService(new FirebaseComunicadoRepository());
const frequenciaService = new FrequenciaService(new FirebaseFrequenciaRepository());
const notaService = new NotaService(new FirebaseNotaRepository());

const PIE_COLORS = ['#004085', '#007bff', '#66b0ff'];

const diasPt: Record<string, string> = {
  Monday: 'Segunda-feira',
  Tuesday: 'Terça-feira',
  Wednesday: 'Quarta-feira',
  Thursday: 'Quinta-feira',
  Friday: 'Sexta-feira',
  Saturday: 'Sábado',
  Sunday: 'Domingo',
};

export default function DashboardProfessor() {
  const { userData } = useAuth() ?? {};
  const navigate = useNavigate();

  const [tarefasCount, setTarefasCount] = useState(0);
  const [aulasCount, setAulasCount] = useState(0);
  const [comunicadosCount, setComunicadosCount] = useState(0);
  const [freqChartData, setFreqChartData] = useState<any[]>([]);
  const [desempenhoChart, setDesempenhoChart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData?.tipo !== 'professores') {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      if (!userData?.email) {
        setLoading(false);
        return;
      }
      
      // Buscar professor pelo email
      const allProfessores = await professorService.listar();
      const professorAtual = allProfessores.find((p: any) => p.email === userData.email);
      
      if (!professorAtual) {
        console.error('Professor não encontrado com email:', userData.email);
        setLoading(false);
        return;
      }
      
      // Buscar vínculos do professor
      const vinculos = await professorMateriaService.listarPorProfessor(professorAtual.id);
      const turmaIds = [...new Set(vinculos.map(v => v.turmaId))];

      if (turmaIds.length === 0) {
        setLoading(false);
        return;
      }

      // Buscar dados em paralelo
      const [tarefas, aulas, comunicados, frequencias, todasNotas] = await Promise.all([
        tarefaService.listarTarefasPorTurmas(turmaIds),
        agendaService.listarPorTurmas(turmaIds),
        comunicadoService.listarPorTurmas(turmaIds),
        frequenciaService.listar(),
        notaService.listarTodas(),
      ]);

      // Contar itens
      setTarefasCount(tarefas.length);
      setAulasCount(aulas.length);
      setComunicadosCount(comunicados.length);

      // Filtrar frequências do professor nas turmas vinculadas
      const freqFiltradas = frequencias.filter(
        f => turmaIds.includes(f.turmaId) && f.professorId === professorAtual.id
      );

      // Agrupar frequências por dia da semana usando service
      const freqChart = frequenciaService.agruparPorDiaSemana(freqFiltradas, diasPt);
      setFreqChartData(freqChart);

      // Filtrar notas pelas matérias e turmas do professor
      const notasFiltradas = todasNotas.filter(n =>
        vinculos.some(v => v.materiaId === n.materiaId && v.turmaId === n.turmaId)
      );

      // Calcular médias finais e distribuir por desempenho usando service
      const mediasFinais = notaService.calcularMediasFinais(notasFiltradas);
      const desempenho = notaService.distribuirPorDesempenho(mediasFinais);

      setDesempenhoChart(desempenho);
      setLoading(false);
    };

    fetchData();
  }, [userData, navigate]);

  if (loading) {
    return (
      <AppLayout>
        <Container className="d-flex justify-content-center align-items-center vh-100">
          <Spinner animation="border" />
        </Container>
      </AppLayout>
    );
  }

  const mediaFrequencia = freqChartData.length
    ? (freqChartData.reduce((acc, d) => acc + d.taxa, 0) / freqChartData.length).toFixed(1)
    : '0';

  const melhorDia = freqChartData.reduce((prev, curr) => (curr.taxa > prev.taxa ? curr : prev), freqChartData[0] || { dia: '', taxa: 0 });
  const piorDia = freqChartData.reduce((prev, curr) => (curr.taxa < prev.taxa ? curr : prev), freqChartData[0] || { dia: '', taxa: 0 });
  const maxY = Math.ceil(Math.max(...freqChartData.map(d => d.presencas + d.faltas)) / 10) * 10;

  return (
    <AppLayout>
      <Container className="my-4">
        <h3 className="mb-4 text-primary">Painel do Professor</h3>

        <Row xs={1} sm={2} md={3} className="g-3 mb-4">
          <Col><Card className="text-center shadow-sm"><Card.Body><div className="mb-2"><FaTasks size={30} /></div><Card.Title>Tarefas</Card.Title><Card.Text className="fs-2 fw-bold">{tarefasCount}</Card.Text><Button variant="outline-primary" size="sm" onClick={() => navigate('/tarefas')}>Ver</Button></Card.Body></Card></Col>
          <Col><Card className="text-center shadow-sm"><Card.Body><div className="mb-2"><FaCalendarAlt size={30} /></div><Card.Title>Próximas Aulas</Card.Title><Card.Text className="fs-2 fw-bold">{aulasCount}</Card.Text><Button variant="outline-primary" size="sm" onClick={() => navigate('/agenda')}>Ver</Button></Card.Body></Card></Col>
          <Col><Card className="text-center shadow-sm"><Card.Body><div className="mb-2"><FaBullhorn size={30} /></div><Card.Title>Comunicados</Card.Title><Card.Text className="fs-2 fw-bold">{comunicadosCount}</Card.Text><Button variant="outline-primary" size="sm" onClick={() => navigate('/comunicados')}>Ver</Button></Card.Body></Card></Col>
        </Row>

        <Row className="mb-4">
          <Col md={6}>
            <Card className="shadow-sm">
              <Card.Header className="fw-bold">Frequência por Dia</Card.Header>
              <Card.Body>
                <Card.Text className="mb-2">
                  📊 <strong>Média de presença semanal:</strong> {mediaFrequencia}%<br />
                  🏆 <strong>Melhor presença:</strong> {melhorDia?.dia} ({melhorDia?.taxa?.toFixed(1)}%)<br />
                  🚫 <strong>Maior ausência:</strong> {piorDia?.dia} ({piorDia?.taxa?.toFixed(1)}%)
                </Card.Text>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={freqChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dia" />
                    <YAxis domain={[0, maxY]} />
                    <Tooltip
                      formatter={(value: number, name: string, props: any) => {
                        const { presencas, faltas } = props.payload;
                        const total = presencas + faltas;
                        const percentual = total ? ((value / total) * 100).toFixed(1) : '0';
                        return [`${value} (${percentual}%)`, name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="presencas" stackId="a" fill="#007bff" name="Presenças" />
                    <Bar dataKey="faltas" stackId="a" fill="#d6d8db" name="Faltas" />
                  </BarChart>
                </ResponsiveContainer>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="shadow-sm">
              <Card.Header className="fw-bold">Distribuição de Desempenho</Card.Header>
              <Card.Body>
                {desempenhoChart.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={desempenhoChart}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                      >
                        {desempenhoChart.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted text-center mb-0">Ainda não há dados suficientes para gerar o gráfico.</p>
                )}
                <div className="text-center mt-2">
                  {desempenhoChart.map((item, index) => (
                    <span key={index} className="me-3">
                      <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: PIE_COLORS[index], borderRadius: '50%', marginRight: 5 }} />
                      {item.faixa}: {item.value}
                    </span>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </AppLayout>
  );
}
