// src/components/frequencia/FrequenciaRelatorios.tsx
import { useState } from 'react';
import { Card, Row, Col, Form, Button, Spinner, Modal, Dropdown } from 'react-bootstrap';
import { collection, getDocs, query, where, doc, getDoc, Query, DocumentData } from 'firebase/firestore';
import { db } from '../../services/firebase';
import DatePicker from "react-datepicker";
import { CheckCircle, XCircle } from 'react-bootstrap-icons';
import { AlertTriangle, User } from "lucide-react";
import { FaClockRotateLeft } from 'react-icons/fa6';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis } from 'recharts';
import Paginacao from '../common/Paginacao';

interface Aluno {
  id: string;
  nome: string;
  turmaId: string;
}

interface Turma {
  id: string;
  nome: string;
}

interface Materia {
  id: string;
  nome: string;
}

interface FrequenciaRelatoriosProps {
  turmas: Turma[];
  materias: Materia[];
  onToast: (message: string, variant: 'success' | 'danger' | 'warning') => void;
}

export default function FrequenciaRelatorios({ turmas, materias, onToast }: FrequenciaRelatoriosProps) {
  // Estados de filtros
  const [turmaId, setTurmaId] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [tipoPeriodo, setTipoPeriodo] = useState('');
  const [periodoMes, setPeriodoMes] = useState('');
  const [dataPeriodo, setDataPeriodo] = useState<[Date | null, Date | null]>([null, null]);

  // Estados de dados
  const [alunosRelatorio, setAlunosRelatorio] = useState<Aluno[]>([]);
  const [registrosRelatorio, setRegistrosRelatorio] = useState<any[]>([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // Estados de gráficos
  const [frequenciaGrafico, setFrequenciaGrafico] = useState<{ presenca: number; ausencia: number } | null>(null);
  const [melhoresAlunosGrafico, setMelhoresAlunosGrafico] = useState<{ id: string, nome: string, percentual: number }[]>([]);

  // Estados de UI
  const [buscaNome, setBuscaNome] = useState('');
  const [ordenacaoRelatorio, setOrdenacaoRelatorio] = useState<'nome' | 'presencas' | 'faltas' | 'percentual'>('nome');
  const [paginaAtualRelatorio, setPaginaAtualRelatorio] = useState(1);
  const itensPorPaginaRelatorio = 10;

  // Modal de histórico
  const [showModalHistorico, setShowModalHistorico] = useState(false);
  const [alunoHistorico, setAlunoHistorico] = useState<{ nome: string; id: string } | null>(null);
  const [historicoFrequencia, setHistoricoFrequencia] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const limparFiltrosRelatorio = () => {
    setTipoPeriodo('');
    setPeriodoMes('');
    setDataPeriodo([null, null]);
    setTurmaId('');
    setMateriaId('');
    setFrequenciaGrafico(null);
    setMelhoresAlunosGrafico([]);
    setAlunosRelatorio([]);
    setRegistrosRelatorio([]);
  };

  const aplicarFiltrosRelatorio = async () => {
    setLoadingRelatorio(true);
    setPaginaAtualRelatorio(1);

    if (!materiaId || !tipoPeriodo) {
      onToast('Por favor, selecione todos os filtros necessários.', 'warning');
      setLoadingRelatorio(false);
      return;
    }

    try {
      // Buscar alunos
      let alunosSnap;
      if (turmaId) {
        alunosSnap = await getDocs(query(collection(db, 'alunos'), where('turmaId', '==', turmaId)));
      } else {
        alunosSnap = await getDocs(collection(db, 'alunos'));
      }

      const listaAlunos: Aluno[] = alunosSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(aluno => (aluno as any).status !== 'Inativo')
        .sort((a, b) => a.nome.localeCompare(b.nome));

      setAlunosRelatorio(listaAlunos);

      // Construir query de frequências
      let q: Query<DocumentData> = collection(db, 'frequencias');

      if (tipoPeriodo === 'hoje') {
        const hoje = new Date().toISOString().split('T')[0];
        q = query(q, where('data', '==', hoje));
      }

      if (tipoPeriodo === 'mes' && periodoMes) {
        const indexMes = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ].indexOf(periodoMes);
        const now = new Date();
        const start = new Date(now.getFullYear(), indexMes, 1);
        const end = new Date(now.getFullYear(), indexMes + 1, 0);
        q = query(
          q,
          where('data', '>=', start.toISOString().split('T')[0]),
          where('data', '<=', end.toISOString().split('T')[0])
        );
      }

      if (tipoPeriodo === 'personalizado' && dataPeriodo[0] && dataPeriodo[1]) {
        const inicioStr = dataPeriodo[0].toISOString().split('T')[0];
        const fimStr = dataPeriodo[1].toISOString().split('T')[0];
        q = query(
          q,
          where('data', '>=', inicioStr),
          where('data', '<=', fimStr)
        );
      }

      const snapshot = await getDocs(q);
      let registros = snapshot.docs.map(doc => doc.data());

      // Filtrar por turma e matéria
      registros = registros.filter(
        reg => (!turmaId || reg.turmaId === turmaId) &&
          (materiaId === 'all' || reg.materiaId === materiaId) &&
          listaAlunos.some(aluno => aluno.id === reg.alunoId)
      );

      setRegistrosRelatorio(registros);

      // Calcular gráfico da turma
      const total = registros.length;
      const presencas = registros.filter(r => r.presenca).length;
      const presencaPercentual = total > 0 ? Number(((presencas / total) * 100).toFixed(1)) : 0;
      const ausentesPercentual = 100 - presencaPercentual;

      setFrequenciaGrafico({
        presenca: presencaPercentual,
        ausencia: ausentesPercentual
      });

      // Calcular top 5 alunos
      const alunosResumo: Record<string, { nome: string, presencas: number, total: number }> = {};

      for (const reg of registros) {
        const alunoId = reg.alunoId;
        let nome = listaAlunos.find(a => a.id === alunoId)?.nome;

        if (!nome) {
          try {
            const docSnap = await getDoc(doc(db, 'alunos', alunoId));
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.status !== 'Inativo') {
                nome = data.nome || 'Desconhecido';
              }
            }
          } catch {
            nome = 'Desconhecido';
          }
        }

        const primeiroNome = nome?.split(' ')[0] || 'Desconhecido';

        if (!alunosResumo[alunoId]) {
          alunosResumo[alunoId] = { nome: primeiroNome, presencas: 0, total: 0 };
        }

        if (reg.presenca) alunosResumo[alunoId].presencas += 1;
        alunosResumo[alunoId].total += 1;
      }

      const melhoresAlunos = Object.entries(alunosResumo)
        .map(([alunoId, { nome, presencas, total }]) => ({
          id: alunoId,
          nome,
          percentual: total > 0 ? Number(((presencas / total) * 100).toFixed(1)) : 0
        }))
        .sort((a, b) => b.percentual - a.percentual)
        .slice(0, 5);

      setMelhoresAlunosGrafico(melhoresAlunos);
    } catch (error) {
      console.error('Erro ao aplicar filtros:', error);
      onToast('Erro ao buscar dados de frequência.', 'danger');
    } finally {
      setLoadingRelatorio(false);
    }
  };

  const processarDadosAlunos = () => {
    let alunosFiltrados = alunosRelatorio.filter(a =>
      buscaNome.trim() === '' || a.nome.toLowerCase().includes(buscaNome.toLowerCase())
    );

    const alunosComDados = alunosFiltrados.map(aluno => {
      const registrosAluno = registrosRelatorio.filter(r => r.alunoId === aluno.id);
      const presencas = registrosAluno.filter(r => r.presenca).length;
      const faltas = registrosAluno.filter(r => !r.presenca).length;
      const total = registrosAluno.length;
      const percentual = total > 0 ? Number(((presencas / total) * 100).toFixed(1)) : 0;

      return { aluno, presencas, faltas, percentual };
    });

    // Ordenar
    alunosComDados.sort((a, b) => {
      if (ordenacaoRelatorio === 'nome') return a.aluno.nome.localeCompare(b.aluno.nome);
      if (ordenacaoRelatorio === 'presencas') return b.presencas - a.presencas;
      if (ordenacaoRelatorio === 'faltas') return b.faltas - a.faltas;
      if (ordenacaoRelatorio === 'percentual') return b.percentual - a.percentual;
      return 0;
    });

    // Paginar
    const inicio = (paginaAtualRelatorio - 1) * itensPorPaginaRelatorio;
    const fim = inicio + itensPorPaginaRelatorio;
    return alunosComDados.slice(inicio, fim);
  };

  const buscarHistoricoAluno = async (aluno: { nome: string; id: string }) => {
    setAlunoHistorico(aluno);
    setShowModalHistorico(true);
    setLoadingHistorico(true);

    try {
      const hoje = new Date();
      const anoAtual = hoje.getFullYear();

      // Buscar todos os registros do aluno no ano atual
      const q = query(
        collection(db, 'frequencias'),
        where('alunoId', '==', aluno.id),
        where('data', '>=', `${anoAtual}-01-01`),
        where('data', '<=', `${anoAtual}-12-31`)
      );

      const snapshot = await getDocs(q);
      let registros = snapshot.docs.map(doc => doc.data());

      // Filtrar pela matéria se necessário
      if (materiaId !== 'all') {
        registros = registros.filter(r => r.materiaId === materiaId);
      }

      // Agrupar por bimestre
      const bimestres = [
        { nome: '1º Bimestre', inicio: new Date(anoAtual, 0, 1), fim: new Date(anoAtual, 2, 31) },
        { nome: '2º Bimestre', inicio: new Date(anoAtual, 3, 1), fim: new Date(anoAtual, 5, 30) },
        { nome: '3º Bimestre', inicio: new Date(anoAtual, 6, 1), fim: new Date(anoAtual, 8, 30) },
        { nome: '4º Bimestre', inicio: new Date(anoAtual, 9, 1), fim: new Date(anoAtual, 11, 31) }
      ];

      const historico = bimestres.map(bim => {
        const registrosBimestre = registros.filter(r => {
          const data = new Date(r.data);
          return data >= bim.inicio && data <= bim.fim;
        });

        const presencas = registrosBimestre.filter(r => r.presenca).length;
        const faltas = registrosBimestre.filter(r => !r.presenca).length;
        const total = registrosBimestre.length;
        const percentual = total > 0 ? ((presencas / total) * 100).toFixed(1) : '0.0';

        return {
          bimestre: bim.nome,
          presencas,
          faltas,
          total,
          percentual
        };
      });

      setHistoricoFrequencia(historico);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      onToast('Erro ao buscar histórico de frequência.', 'danger');
    } finally {
      setLoadingHistorico(false);
    }
  };

  return (
    <>
      {/* Filtros */}
      <Card className='shadow-sm p-3 mb-3'>
        <Row className="mb-3 mb-custom-mobile-0">
          <Col md={3}>
            <Form.Select
              value={turmaId}
              onChange={e => {
                setTurmaId(e.target.value);
                setMateriaId('');
              }}
            >
              <option value="">Todas as turmas</option>
              {turmas.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Form.Select>
          </Col>

          <Col md={3}>
            <Form.Select
              value={materiaId}
              onChange={e => setMateriaId(e.target.value)}
            >
              <option value="">Selecione a Matéria</option>
              <option value="all">Todas as matérias</option>
              {materias.map(m => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Form.Select>
          </Col>

          <Col md={3}>
            <Form.Select
              value={tipoPeriodo}
              onChange={e => setTipoPeriodo(e.target.value)}
            >
              <option value="">Selecione o Tipo de Período</option>
              <option value="hoje">Hoje</option>
              <option value="mes">Mês</option>
              <option value="personalizado">Personalizado</option>
            </Form.Select>
          </Col>

          {tipoPeriodo === 'mes' && (
            <Col md={3}>
              <Form.Select
                value={periodoMes}
                onChange={e => setPeriodoMes(e.target.value)}
              >
                <option value="">Selecione o Mês</option>
                {[
                  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                ].map((mes, index) => (
                  <option key={index} value={mes}>
                    {mes}
                  </option>
                ))}
              </Form.Select>
            </Col>
          )}

          {tipoPeriodo === 'personalizado' && (
            <Col md={3}>
              <DatePicker
                selectsRange
                startDate={dataPeriodo[0]}
                endDate={dataPeriodo[1]}
                onChange={(update: [Date | null, Date | null]) => setDataPeriodo(update)}
                dateFormat="dd/MM/yyyy"
                locale="pt-BR"
                calendarClassName="custom-calendar-small"
                showPopperArrow={false}
                autoComplete="off"
                wrapperClassName="w-100"
                isClearable
                className="form-control"
              />
            </Col>
          )}
        </Row>

        <Row className="mb-2 justify-content-end d-none d-md-flex">
          <Col className="d-flex gap-2 justify-content-end" md={7}>
            <Button
              variant="primary"
              className="d-flex align-items-center gap-2"
              onClick={aplicarFiltrosRelatorio}
            >
              Aplicar Filtros
            </Button>
            <Button
              className="d-flex align-items-center gap-2 text-secondary bg-transparent border-0 p-0"
              onClick={limparFiltrosRelatorio}
            >
              Limpar Filtros
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Botões mobile */}
      <div className="w-100 my-2 d-block d-md-none">
        <Row className="justify-content-center">
          <Col className="d-flex gap-2 justify-content-center">
            <Button
              variant="primary"
              className="w-100 d-flex align-items-center justify-content-center gap-2"
              onClick={aplicarFiltrosRelatorio}
            >
              Aplicar Filtros
            </Button>
          </Col>
        </Row>
        <Row>
          <Col>
            <Button
              className="mt-2 w-100 d-flex align-items-center justify-content-center gap-2 bg-white"
              style={{ color: 'black', border: '1px solid #e1e7ef', flex: 1 }}
              onClick={limparFiltrosRelatorio}
            >
              Limpar Filtros
            </Button>
          </Col>
        </Row>
      </div>

      {/* Gráficos */}
      {frequenciaGrafico && (
        <Row className="info-cards-frequencia">
          <Col md={5}>
            <Card className="shadow-md h-70 mb-3">
              <Card.Body>
                <h3 className="fs-5 fw-bold text-dark mb-3">Frequência da Turma</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Presenças', value: frequenciaGrafico.presenca },
                        { name: 'Ausências', value: frequenciaGrafico.ausencia }
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ value }) => `${value.toFixed(1)}%`}
                    >
                      <Cell key="presencas" fill="#22c55e" />
                      <Cell key="ausencias" fill="#ef4444" />
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card.Body>
            </Card>
          </Col>

          <Col md={7}>
            <Card className="shadow-md h-70 mb-3">
              <Card.Body>
                <h3 className="fs-5 fw-bold text-dark mb-3">Top 5 Alunos - Presença (%)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={melhoresAlunosGrafico}>
                    <XAxis
                      dataKey="nome"
                      interval={0}
                      tickFormatter={nome => nome.split(' ')[0]}
                    />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(value: number) => `${value}%`} />
                    <Bar dataKey="percentual" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Lista de alunos */}
      {frequenciaGrafico && (
        <>
          <Card className='shadow-sm p-3 mb-3 mt-0'>
            <Form.Control
              type="search"
              placeholder="Buscar aluno..."
              value={buscaNome}
              onChange={e => setBuscaNome(e.target.value)}
              autoComplete="off"
            />
          </Card>

          <Card className="shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3 px-3">
                <h3 className="mb-0">
                  Resumo de Frequência
                  <span className="text-muted" style={{ fontSize: '1rem', marginLeft: 8, verticalAlign: 'middle' }}>
                    ({alunosRelatorio.filter(a => buscaNome.trim() === '' || a.nome.toLowerCase().includes(buscaNome.toLowerCase())).length})
                  </span>
                </h3>
                <Dropdown onSelect={key => setOrdenacaoRelatorio(key as any)}>
                  <Dropdown.Toggle
                    variant="outline-secondary"
                    id="dropdown-ordenar"
                    size="sm"
                    className="d-flex align-items-center gap-2"
                  >
                    Ordenar
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item eventKey="nome" active={ordenacaoRelatorio === 'nome'}>Nome</Dropdown.Item>
                    <Dropdown.Item eventKey="presencas" active={ordenacaoRelatorio === 'presencas'}>Presenças</Dropdown.Item>
                    <Dropdown.Item eventKey="faltas" active={ordenacaoRelatorio === 'faltas'}>Faltas</Dropdown.Item>
                    <Dropdown.Item eventKey="percentual" active={ordenacaoRelatorio === 'percentual'}>Frequência (%)</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>

              {/* Versão Desktop */}
              <div className="d-none d-md-block">
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex justify-content-between px-3 py-2 border-bottom fw-bold text-muted">
                    <div style={{ width: '22%', display: 'flex', justifyContent: 'center' }}>Aluno</div>
                    <div style={{ width: '12%', display: 'flex', justifyContent: 'center' }}>Presenças</div>
                    <div style={{ width: '12%', display: 'flex', justifyContent: 'center' }}>Faltas</div>
                    <div style={{ width: '21%', display: 'flex', justifyContent: 'center' }}>Frequência</div>
                    <div style={{ width: '15%', display: 'flex', justifyContent: 'center' }}>Status</div>
                    <div style={{ width: '8%', display: 'flex', justifyContent: 'center' }}>Ações</div>
                  </div>

                  {loadingRelatorio ? (
                    <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                      <Spinner animation="border" />
                    </div>
                  ) : (
                    processarDadosAlunos().map(({ aluno: a, presencas, faltas, percentual }) => {
                      let status = null;

                      if (percentual >= 80) {
                        status = (
                          <span className="badge bg-success d-flex align-items-center gap-1 justify-content-center" style={{ width: 'fit-content' }}>
                            <CheckCircle size={16} /> OK
                          </span>
                        );
                      } else if (percentual >= 60) {
                        status = (
                          <span className="badge bg-warning text-dark d-flex align-items-center gap-1 justify-content-center" style={{ width: 'fit-content' }}>
                            <AlertTriangle size={16} /> Regular
                          </span>
                        );
                      } else {
                        status = (
                          <span className="badge bg-danger d-flex align-items-center gap-1 justify-content-center" style={{ width: 'fit-content' }}>
                            <XCircle size={16} /> Crítico
                          </span>
                        );
                      }

                      return (
                        <Card key={a.id} className="w-100 custom-card-frequencia mb-0">
                          <Card.Body className="d-flex justify-content-between align-items-center py-3 px-3">
                            <div className="d-flex align-items-center" style={{ width: '22%' }}>
                              <div className="user-icon-circle-frequencia">
                                <User size={24} color="#fff" />
                              </div>
                              <span className="aluno-nome-frequencia ms-2" style={{ fontSize: '1rem' }}>{a.nome}</span>
                            </div>
                            <div style={{ width: '12%', textAlign: 'center' }}>
                              <span className="text-success fw-bold">{presencas}</span>
                            </div>
                            <div style={{ width: '12%', textAlign: 'center' }}>
                              <span className="text-danger fw-bold">{faltas}</span>
                            </div>
                            <div style={{ width: '21%', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                className="progress"
                                style={{
                                  width: '100px',
                                  height: '20px',
                                  borderRadius: '999px',
                                  backgroundColor: '#e9ecef',
                                }}
                              >
                                <div
                                  className="progress-bar"
                                  role="progressbar"
                                  style={{
                                    width: `${percentual}%`,
                                    backgroundColor: '#021E4C',
                                    borderRadius: '999px',
                                  }}
                                  aria-valuenow={percentual}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                ></div>
                              </div>
                              <span style={{ fontWeight: 'bold', minWidth: '35px', textAlign: 'right', fontSize: '0.9rem' }}>
                                {percentual.toFixed(1)}%
                              </span>
                            </div>
                            <div style={{ width: '15%', textAlign: 'center', justifyContent: 'center', display: 'flex' }}>
                              {status}
                            </div>
                            <div style={{ width: '8%', textAlign: 'center', justifyContent: 'center', display: 'flex' }}>
                              <Button
                                size="sm"
                                variant="link"
                                className="d-flex align-items-center gap-1 mx-auto"
                                style={{
                                  color: 'black',
                                  fontWeight: 'bold',
                                  textDecoration: 'none',
                                  border: 'none',
                                  boxShadow: 'none',
                                  padding: 0,
                                  background: 'transparent',
                                  cursor: 'pointer',
                                }}
                                onMouseOver={(e) => (e.currentTarget.style.color = '#333')}
                                onMouseOut={(e) => (e.currentTarget.style.color = 'black')}
                                onClick={() => buscarHistoricoAluno({ nome: a.nome, id: a.id })}
                              >
                                <FaClockRotateLeft /> Histórico
                              </Button>
                            </div>
                          </Card.Body>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Versão Mobile */}
              <div className="d-block d-md-none">
                {loadingRelatorio ? (
                  <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <Spinner animation="border" />
                  </div>
                ) : (
                  processarDadosAlunos().map(({ aluno: a, presencas, faltas, percentual }) => {
                    let status = null;
                    let statusText = '';

                    if (percentual >= 80) {
                      status = 'success';
                      statusText = 'OK';
                    } else if (percentual >= 60) {
                      status = 'warning';
                      statusText = 'Regular';
                    } else {
                      status = 'danger';
                      statusText = 'Crítico';
                    }

                    return (
                      <div key={a.id} className="notas-resultado-card mb-2">
                        <div className="notas-resultado-header">
                          <div className="notas-resultado-nome">{a.nome}</div>
                          <div className={`notas-resultado-media text-${status}`} style={{ fontSize: '1.1rem' }}>
                            {percentual.toFixed(1)}%
                          </div>
                        </div>

                        <div className="notas-resultado-body">
                          <div className="notas-resultado-row">
                            <span className="notas-resultado-label">Presenças:</span>
                            <span className="notas-resultado-valor text-success fw-bold" style={{ fontSize: '0.95rem' }}>
                              {presencas}
                            </span>
                          </div>

                          <div className="notas-resultado-row">
                            <span className="notas-resultado-label">Faltas:</span>
                            <span className="notas-resultado-valor text-danger fw-bold" style={{ fontSize: '0.95rem' }}>
                              {faltas}
                            </span>
                          </div>

                          <div className="notas-resultado-row">
                            <span className="notas-resultado-label">Status:</span>
                            <span className={`badge bg-${status}`}>{statusText}</span>
                          </div>

                          <div className="notas-resultado-row">
                            <Button
                              size="sm"
                              variant="link"
                              className="p-0"
                              style={{ textDecoration: 'none', color: '#021E4C', fontWeight: 'bold' }}
                              onClick={() => buscarHistoricoAluno({ nome: a.nome, id: a.id })}
                            >
                              <FaClockRotateLeft className="me-1" />
                              Ver Histórico
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Paginação */}
          {alunosRelatorio.filter(a =>
            buscaNome.trim() === '' || a.nome.toLowerCase().includes(buscaNome.toLowerCase())
          ).length > itensPorPaginaRelatorio && (
              <Paginacao
                paginaAtual={paginaAtualRelatorio}
                totalPaginas={Math.ceil(
                  alunosRelatorio.filter(a =>
                    buscaNome.trim() === '' || a.nome.toLowerCase().includes(buscaNome.toLowerCase())
                  ).length / itensPorPaginaRelatorio
                )}
                aoMudarPagina={setPaginaAtualRelatorio}
              />
            )}
        </>
      )}

      {/* Modal de Histórico */}
      <Modal show={showModalHistorico} onHide={() => setShowModalHistorico(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Histórico de Frequência - {alunoHistorico?.nome}
            <br />
            <small className="text-muted">
              Matéria: {materiaId === 'all' ? 'Todas as matérias' : (materias.find(m => m.id === materiaId)?.nome || 'Não informada')}
            </small>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingHistorico ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 text-muted">Carregando histórico...</p>
            </div>
          ) : historicoFrequencia.length > 0 ? (
            <>
              {/* Versão Desktop */}
              <div className="table-responsive d-none d-md-block">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Bimestre</th>
                      <th className="text-center">Presenças</th>
                      <th className="text-center">Faltas</th>
                      <th className="text-center">Total de Aulas</th>
                      <th className="text-center">Frequência</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoFrequencia.map(bimestre => (
                      <tr key={bimestre.bimestre}>
                        <td className="fw-bold">{bimestre.bimestre}</td>
                        <td className="text-center text-success fw-bold">{bimestre.presencas}</td>
                        <td className="text-center text-danger fw-bold">{bimestre.faltas}</td>
                        <td className="text-center">{bimestre.total}</td>
                        <td className="text-center fw-bold">{bimestre.percentual}%</td>
                        <td className="text-center">
                          {parseFloat(bimestre.percentual) >= 80 ? (
                            <span className="badge bg-success">
                              <CheckCircle size={14} className="me-1" />
                              OK
                            </span>
                          ) : parseFloat(bimestre.percentual) >= 60 ? (
                            <span className="badge bg-warning text-dark">
                              <AlertTriangle size={14} className="me-1" />
                              Regular
                            </span>
                          ) : (
                            <span className="badge bg-danger">
                              <XCircle size={14} className="me-1" />
                              Crítico
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Versão Mobile */}
              <div className="d-block d-md-none">
                {historicoFrequencia.map(bimestre => {
                  const percentual = parseFloat(bimestre.percentual);
                  let statusVariant = 'danger';
                  let statusText = 'Crítico';

                  if (percentual >= 80) {
                    statusVariant = 'success';
                    statusText = 'OK';
                  } else if (percentual >= 60) {
                    statusVariant = 'warning';
                    statusText = 'Regular';
                  }

                  return (
                    <div key={bimestre.bimestre} className="mb-3 p-3 border rounded">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0 fw-bold">{bimestre.bimestre}</h6>
                        <span className={`badge bg-${statusVariant}`}>{statusText}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span>Presenças:</span>
                        <span className="text-success fw-bold">{bimestre.presencas}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span>Faltas:</span>
                        <span className="text-danger fw-bold">{bimestre.faltas}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span>Total:</span>
                        <span className="fw-bold">{bimestre.total}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span>Frequência:</span>
                        <span className="fw-bold">{bimestre.percentual}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="mb-3">
                <FaClockRotateLeft size={48} className="text-muted" />
              </div>
              <h5>Nenhum registro encontrado</h5>
              <p className="text-muted">Este aluno ainda não possui registros de frequência.</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModalHistorico(false)}>
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
