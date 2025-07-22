// src/pages/Frequencia.tsx - Corrigido para usar professores_materias
import { JSX, useEffect, useState, useRef } from 'react';
import React from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Row, Col, Form, Button, Spinner, Toast, ToastContainer,
  Card,
  Modal,
} from 'react-bootstrap';
import {
  collection, getDocs, query, where,
  writeBatch, doc, getDoc} from 'firebase/firestore';
import { AlertTriangle, CalendarIcon, Check, CheckSquare, Eye, Info, Plus, Save, Undo, User, UserCheck, UserX, X } from "lucide-react";
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FaUserCheck, FaUsers, FaUserTimes } from 'react-icons/fa';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { BarChart, Bar, XAxis, YAxis } from 'recharts';

//Data
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css"
import { ptBR } from "date-fns/locale";
import { registerLocale } from "react-datepicker";
import { CheckCircle, XCircle } from 'react-bootstrap-icons';

// 👇 força o tipo como 'any' para evitar conflito
registerLocale("pt-BR", ptBR as any);

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
interface Vinculo {
  professorId: string;
  materiaId: string;
  turmaId: string;
}

export default function Frequencia(): JSX.Element {
  const { userData } = useAuth()!;
  const isAdmin = userData?.tipo === 'administradores';

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);

  const [turmaId, setTurmaId] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [dataAula, setDataAula] = useState('');

  const [attendance, setAttendance] = useState<Record<string, boolean | null>>({});
  const [history, setHistory] = useState<Record<string, boolean | null>[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'danger' | 'warning' }>({ show: false, message: '', variant: 'success' });

  const [showJustModal, setShowJustModal] = useState(false);
  const [alunoJustId, setAlunoJustId] = useState<string | null>(null);
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [justificativaTexto, setJustificativaTexto] = useState('');

  useEffect(() => {
    async function fetchData() {
      let turmaDocs = [];
      let materiaIds: string[] = [];
      let materiasList: Materia[] = [];

      if (isAdmin) {
        const turmaSnap = await getDocs(collection(db, 'turmas'));
        turmaDocs = turmaSnap.docs;

        const snap = await getDocs(collection(db, 'materias'));
        materiasList = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        materiaIds = materiasList.map(m => m.id);
      } else {
        if (!userData) return;
        const vincSnap = await getDocs(query(collection(db, 'professores_materias'), where('professorId', '==', userData.uid)));
        const vincList = vincSnap.docs.map(d => d.data() as Vinculo);
        setVinculos(vincList);

        const turmaIds = [...new Set(vincList.map(v => v.turmaId))];
        turmaDocs = await Promise.all(turmaIds.map(async id => await getDoc(doc(db, 'turmas', id))));

        materiaIds = [...new Set(vincList.map(v => v.materiaId))];
        const materiasSnap = await Promise.all(materiaIds.map(async id => {
          const ref = await getDoc(doc(db, 'materias', id));
          return { id: ref.id, nome: ref.data()?.nome || 'Desconhecida' };
        }));
        materiasList = materiasSnap;
      }

      setTurmas(
        turmaDocs
          .map(d => ({ id: d.id, nome: d.data()?.nome || '-' }))
          .sort((a, b) => a.nome.localeCompare(b.nome))
      );
      setMaterias(materiasList);
    }
    fetchData();
  }, [userData]);

  useEffect(() => {
    if (turmaId && materiaId) {
      setTimeout(() => {
        document.getElementById('data-aula')?.focus();
      }, 0);
    }
  }, [turmaId, materiaId]);

  useEffect(() => {
    async function fetchAlunos() {
      if (!turmaId || !materiaId || !dataAula) {
        setAlunos([]);
        setAttendance({});
        return;
      }
      setLoading(true);
      try {
        const alunosSnap = await getDocs(query(collection(db, 'alunos'), where('turmaId', '==', turmaId)));
        const listaAlunos: Aluno[] = alunosSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .sort((a, b) => a.nome.localeCompare(b.nome));
        setAlunos(listaAlunos);

        const freqSnap = await getDocs(
          query(collection(db, 'frequencias'),
            where('turmaId', '==', turmaId),
            where('materiaId', '==', materiaId),
            where('data', '==', dataAula))
        );
        const presMap: Record<string, boolean | null> = {};
        freqSnap.docs.forEach(d => {
          const ddata = d.data() as any;
          presMap[ddata.alunoId] = ddata.presenca;
        });
        const initial: Record<string, boolean | null> = {};
        listaAlunos.forEach(a => {
          // Se houver registro anterior, usa ele. Caso contrário, marca como presente
          initial[a.id] = presMap[a.id] !== undefined ? presMap[a.id] : true;
        });
        setAttendance(initial);

        const justificativasMap: Record<string, string> = {};
        freqSnap.docs.forEach(d => {
          const ddata = d.data() as any;
          if (ddata.observacao) {
            justificativasMap[ddata.alunoId] = ddata.observacao;
          }
        });
        setJustificativas(justificativasMap);

      } catch (err) {
        console.error('Erro ao buscar dados de frequência:', err);
      }
      setLoading(false);
    }
    fetchAlunos();
  }, [turmaId, materiaId, dataAula]);

  const atualizarAttendance = (novoAttendance: Record<string, boolean | null>) => {
    setHistory(prev => [...prev, attendance]); // salva estado atual no histórico
    setAttendance(novoAttendance);
  };

  const marcarPresenca = (alunoId: string, presente: boolean | null) => {
    const novos = { ...attendance, [alunoId]: presente };
    atualizarAttendance(novos);
  };

  const marcarTodosComoPresente = () => {
    const novos = Object.fromEntries(alunos.map(a => [a.id, true]));
    atualizarAttendance(novos);
  };

  const marcarTodosComoAusente = () => {
    const novos = Object.fromEntries(alunos.map(a => [a.id, false]));
    atualizarAttendance(novos);
  };

  const desfazerAlteracao = () => {
    setHistory(prev => {
      if (prev.length === 0) return prev; // nada para desfazer

      const ultimoEstado = prev[prev.length - 1];
      setAttendance(ultimoEstado);

      return prev.slice(0, -1);
    });
  };


  const handleSalvar = async () => {
    if (!turmaId || !materiaId || !dataAula || !alunos.length || Object.keys(attendance).length === 0) return;
    setSaving(true);
    const batch = writeBatch(db);
    alunos.forEach(aluno => {
      const docId = `${turmaId}_${materiaId}_${dataAula}_${aluno.id}`;
      const ref = doc(db, 'frequencias', docId);
      const justificativa = justificativas[aluno.id];
      batch.set(ref, {
        turmaId,
        materiaId,
        data: dataAula,
        alunoId: aluno.id,
        presenca: justificativa ? false : attendance[aluno.id], // Se tem justificativa, salva como ausente
        professorId: userData?.uid || '',
        observacao: justificativa || ''
      });
    });
    try {
      await batch.commit();
      setToast({ show: true, message: 'Frequência salva com sucesso!', variant: 'success' });
    } catch (err) {
      console.error('Erro ao salvar frequência:', err);
      setToast({ show: true, message: 'Falha ao salvar frequência.', variant: 'danger' });
    }
    setSaving(false);
  };

  // Cards porcentagem
  const totalAlunos = alunos.length;
  const totalPresentes = Object.values(attendance).filter(v => v === true).length;
  const totalAusentes = Object.values(attendance).filter(v => v === false).length;

  const porcentagemPresentes = totalAlunos ? ((totalPresentes / totalAlunos) * 100).toFixed(0) : 0;
  const porcentagemAusentes = totalAlunos ? ((totalAusentes / totalAlunos) * 100).toFixed(0) : 0;


  // Filtrar alunos
  const [filtroAlunos, setFiltroAlunos] = useState<'todos' | 'presentes' | 'ausentes'>('todos');
  const [buscaNome, setBuscaNome] = useState('');
  const filtrarAlunos = (tipo: 'todos' | 'presentes' | 'ausentes') => {
    setFiltroAlunos(tipo);
  };
  const alunosFiltrados = alunos.filter(a => {
    // filtro presença
    if (filtroAlunos === 'presentes' && !attendance[a.id]) return false;
    if (filtroAlunos === 'ausentes' && attendance[a.id]) return false;

    // filtro busca nome (case insensitive)
    if (buscaNome.trim() === '') return true;
    return a.nome.toLowerCase().includes(buscaNome.toLowerCase());
  });

  // Tabs
  const [activeTab, setActiveTab] = useState<'lancamento-frequencia' | 'relatorios-frequencia'>('lancamento-frequencia');

  // Confirmação de presença
  const [showModal, setShowModal] = useState(false);

  // Data
  function formatDate(date: Date) {
    // Garante que a data seja local, sem fuso horário
    return date.toLocaleDateString('en-CA'); // yyyy-MM-dd
  }

  function handleDateChange(date: Date | null) {
    if (!date) {
      setDataAula("");
      return;
    }

    const selectedDateISO = formatDate(date);
    const hoje = new Date();
    const hojeISO = formatDate(hoje);

    if (selectedDateISO !== hojeISO) {
      alert("A data selecionada não é a data atual.");
    }

    setDataAula(selectedDateISO);
  }


  type CustomDateInputProps = {
    value?: string;
    onClick?: () => void;
  };
  const CustomDateInput = React.forwardRef<HTMLInputElement, CustomDateInputProps>(
    ({ value, onClick }, ref) => {
      return (
        <div
          onClick={onClick}
          ref={ref as React.Ref<HTMLDivElement>} // para evitar problemas com ref no wrapper
          className="position-relative"
          style={{ width: "100%" }}
        >
          <input
            type="text"
            value={value}
            readOnly
            className="form-control"
            placeholder="Selecione uma data"
            autoComplete="off"
            style={{ width: "100%", paddingRight: "2.5rem" }} // espaço para o ícone
          />
          <CalendarIcon
            size={18}
            className="position-absolute"
            style={{
              top: "50%",
              right: "10px",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "#6c757d",
            }}
          />
        </div>
      );
    }
  );

  function stringToLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // mês começa em 0
  }

  // FILTROS RELATORIOS
  function limparFiltrosRelatorio() {
    setTipoPeriodo('');
    setPeriodoMes('');
    setDataPeriodo([null, null]);
    setTurmaId('');
    setMateriaId('');
  }

  const [periodoMes, setPeriodoMes] = useState('');
  const [dataPeriodo, setDataPeriodo] = useState<[Date | null, Date | null]>([null, null]); // [dataInicio, dataFim]
  const [tipoPeriodo, setTipoPeriodo] = useState('');

  const previousTab = useRef(activeTab);

  useEffect(() => {
    if (previousTab.current === 'relatorios-frequencia' && activeTab === 'lancamento-frequencia') {
      limparFiltrosRelatorio();
    }
    previousTab.current = activeTab;
  }, [activeTab]);

// Trecho otimizado da funcao aplicarFiltrosRelatorio
const aplicarFiltrosRelatorio = async () => {
  setLoadingRelatorio(true);

  if (!turmaId || !materiaId || !tipoPeriodo) {
    setToast({
      show: true,
      message: 'Por favor, selecione todos os filtros necessários.',
      variant: 'warning',
    });
    setLoadingRelatorio(false);
    return;
  }

  const alunosSnap = await getDocs(
    query(collection(db, 'alunos'), where('turmaId', '==', turmaId))
  );
  const listaAlunos: Aluno[] = alunosSnap.docs
    .map(d => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  setAlunosRelatorio(listaAlunos);

  let inicioStr = '';
  let fimStr = '';

  if (tipoPeriodo === 'mes' && periodoMes) {
    const indexMes = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ].indexOf(periodoMes);
    const now = new Date();
    const start = new Date(now.getFullYear(), indexMes, 1);
    const end = new Date(now.getFullYear(), indexMes + 1, 0);
    inicioStr = start.toISOString().split('T')[0];
    fimStr = end.toISOString().split('T')[0];
  }

  if (tipoPeriodo === 'personalizado' && dataPeriodo[0] && dataPeriodo[1]) {
    inicioStr = dataPeriodo[0].toISOString().split('T')[0];
    fimStr = dataPeriodo[1].toISOString().split('T')[0];
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'frequencias'),
      where('turmaId', '==', turmaId),
      where('materiaId', '==', materiaId),
      where('data', '>=', inicioStr),
      where('data', '<=', fimStr)
    )
  );

  let registros = snapshot.docs.map(doc => doc.data());

  const total = registros.length;
  const presencas = registros.filter(r => r.presenca).length;
  const presencaPercentual = total > 0 ? Number(((presencas / total) * 100).toFixed(1)) : 0;
  const ausentesPercentual = 100 - presencaPercentual;

  setFrequenciaGrafico({
    presenca: presencaPercentual,
    ausencia: ausentesPercentual
  });

  const alunosResumo: Record<string, { nome: string, presencas: number, total: number }> = {};

  async function getNomeAluno(alunoId: string): Promise<string> {
    const alunoObj = alunos.find(a => a.id === alunoId);
    if (alunoObj) return alunoObj.nome;
    try {
      const docSnap = await getDoc(doc(db, 'alunos', alunoId));
      if (docSnap.exists()) return docSnap.data().nome || 'Desconhecido';
    } catch {}
    return 'Desconhecido';
  }

  for (const reg of registros) {
    const alunoId = reg.alunoId;
    let nome = alunos.find(a => a.id === alunoId)?.nome || await getNomeAluno(alunoId);
    const primeiroNome = nome.split(' ')[0];
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
  setRegistrosRelatorio(registros);
  setLoadingRelatorio(false);
};


  // Graficos do relatório
  const [frequenciaGrafico, setFrequenciaGrafico] = useState<{ presenca: number; ausencia: number } | null>(null);
  const [melhoresAlunosGrafico, setMelhoresAlunosGrafico] = useState<{ id: string, nome: string, percentual: number }[]>([]);

  //Lista Relatorio
  const [alunosRelatorio, setAlunosRelatorio] = useState<Aluno[]>([]);
  const [registrosRelatorio, setRegistrosRelatorio] = useState<any[]>([]);

  return (
    <AppLayout>
      <Container className="my-4">
        <div className="min-h-screen bg-gray-50">
          <div className="bg-white border-bottom border-gray-200">
            <div className="container px-4">
              <div className="d-flex align-items-center justify-content-between py-4">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="d-flex align-items-center justify-content-center rounded bg-primary"
                    style={{ width: 48, height: 48 }}
                  >
                    <CheckSquare size={24} color="#fff" />
                  </div>
                  <div>
                    <h2 className="fs-3 fw-bold text-dark mb-0">Gestão de Frequência</h2>
                    <p className="text-muted mb-0" style={{ fontSize: 14 }}>
                      MobClassApp - Portal do Professor
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Navigation Tabs */}
          <div className="bg-white border-bottom border-gray-200">
            <div className="container px-4">
              <div className="d-flex gap-3 py-3">
                <Button
                  variant={activeTab === 'lancamento-frequencia' ? 'primary' : 'outline-primary'}
                  className="d-flex align-items-center gap-2"
                  onClick={() => setActiveTab('lancamento-frequencia')}
                >
                  <Plus size={18} className='nothing-in-mobile'/>
                  <span>Lançamento de Frequência</span>
                </Button>
                <Button
                  variant={activeTab === 'relatorios-frequencia' ? 'primary' : 'outline-primary'}
                  className="d-flex align-items-center gap-2"
                  onClick={() => setActiveTab('relatorios-frequencia')}
                >
                  <Eye size={18} className='nothing-in-mobile'/>
                  <span>Relatórios de Frequência</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content*/}
          <div className="py-4 pb-0">
            {activeTab === 'lancamento-frequencia' ? (
              <Card className='shadow-sm p-3 mb-0'>
                <Row className="mb-3 info-cards-frequencia">
                  <Col md={4}>
                    <Form.Select
                      value={turmaId}
                      onChange={e => {
                        setTurmaId(e.target.value);
                        setMateriaId('');
                      }}
                    >
                      <option value="">Selecione a Turma</option>
                      {turmas.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>

                  <Col md={4}>
                    <Form.Select
                      value={materiaId}
                      onChange={e => setMateriaId(e.target.value)}
                      disabled={!turmaId}
                    >
                      <option value="">Selecione a Matéria</option>
                      {isAdmin
                        ? materias
                          .filter(m => m && m.nome)
                          .map(m => (
                            <option key={m.id} value={m.id}>
                              {m.nome}
                            </option>
                          ))
                        : vinculos
                          .filter(v => v.turmaId === turmaId)
                          .map(v => {
                            const materia = materias.find(m => m.id === v.materiaId);
                            return materia ? (
                              <option key={materia.id} value={materia.id}>
                                {materia.nome}
                              </option>
                            ) : null;
                          })}
                    </Form.Select>
                  </Col>

                  <Col md={4}>
                    <DatePicker
                      selected={dataAula ? stringToLocalDate(dataAula) : null}
                      onChange={handleDateChange}
                      dateFormat="dd/MM/yyyy"
                      locale="pt-BR"
                      calendarClassName="custom-calendar-small"
                      customInput={<CustomDateInput />}
                      showPopperArrow={false}
                      autoComplete="off"
                      wrapperClassName="w-100"
                    />
                  </Col>
                </Row>
                <Row className="mb-2 justify-content-end">
                  <Col className="d-flex gap-3 justify-content-end" md={7}>
                    <Button
                      variant="success"
                      onClick={marcarTodosComoPresente}
                      className="d-flex align-items-center gap-2"
                    >
                      <UserCheck size={18} />
                      Todos Presentes
                    </Button>
                    <Button
                      variant="danger"
                      onClick={marcarTodosComoAusente}
                      className="d-flex align-items-center gap-2"
                    >
                      <UserX size={18} />
                      Todos Ausentes
                    </Button>
                    <Button
                      onClick={desfazerAlteracao}
                      disabled={history.length === 0}
                      className="d-flex align-items-center gap-2 text-secondary bg-transparent border-0 p-0"
                    >
                      <Undo size={18} />
                      Desfazer
                    </Button>
                  </Col>
                </Row>
              </Card>
            ) : (
              <Card className='shadow-sm p-3'>
                <Row className="mb-3 info-cards-frequencia">
                  <Col md={3}>
                    <Form.Select
                      value={turmaId}
                      onChange={e => {
                        setTurmaId(e.target.value);
                        setMateriaId('');
                      }}
                    >
                      <option value="">Selecione a Turma</option>
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
                      disabled={!turmaId}
                    >
                      <option value="">Selecione a Matéria</option>
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
                      onChange={e => {
                        const valor = e.target.value;
                        setTipoPeriodo(valor);
                        setDataAula(''); // limpa a seleção anterior ao trocar o tipo
                      }}
                    >
                      <option value="">Selecione o Tipo de Período</option>
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
                        onChange={(update: [Date | null, Date | null]) => {
                          setDataPeriodo(update);
                        }}
                        dateFormat="dd/MM/yyyy"
                        locale="pt-BR"
                        calendarClassName="custom-calendar-small"
                        customInput={<CustomDateInput />}
                        showPopperArrow={false}
                        autoComplete="off"
                        wrapperClassName="w-100"
                        isClearable
                      />
                    </Col>
                  )}

                </Row>

                <Row className="mb-2 justify-content-end">
                  <Col className="d-flex gap-3 justify-content-end" md={7}>
                    <Button
                      variant="primary"
                      className="d-flex align-items-center gap-2"
                      onClick={aplicarFiltrosRelatorio}
                    >
                      Aplicar Filtros
                    </Button>
                    <Button
                      className="d-flex align-items-center gap-2 text-secondary bg-transparent border-0 p-0"
                      style={{ color: 'black' }}
                      onClick={limparFiltrosRelatorio}
                    >
                      Limpar Filtros
                    </Button>

                  </Col>
                </Row>
              </Card>
            )}
            {activeTab === "relatorios-frequencia" && frequenciaGrafico && (
              <Row className="info-cards-frequencia">
                <Col md={5}>
                  <Card className="shadow-md">
                    <Card.Body>
                      <h3 className="fs-5 fw-bold text-dark mb-0 mb-1">Frequência da Turma</h3>
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
                  <Card className="shadow-md">
                    <Card.Body>
                      <h3 className="fs-5 fw-bold text-dark mb-0 mb-1">Top 5 Alunos - Presença (%)</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={melhoresAlunosGrafico}>
                          <XAxis
                            dataKey="nome"
                            interval={0}
                            tickFormatter={nome => nome.split(' ')[0]} // Mostra só o primeiro nome
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
          </div>

          {/* Lista do relatorio */}
          {activeTab === "relatorios-frequencia" && frequenciaGrafico && (
            // <Row>
            <Card className="shadow-sm">
              <Card.Body>
                <h3 className="mb-3 px-3">Resumo de Frequência</h3>
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex justify-content-between px-3 py-2 border-bottom fw-bold text-muted">
                    <div style={{ width: '25%', display: 'flex', justifyContent: 'center' }}>Aluno</div>
                    <div style={{ width: '15%', display: 'flex', justifyContent: 'center' }}>Presenças</div>
                    <div style={{ width: '15%', display: 'flex', justifyContent: 'center' }}>Faltas</div>
                    <div style={{ width: '20%', display: 'flex', justifyContent: 'center' }} className="nothing-in-mobile">Frequência</div>
                    <div style={{ width: '20%', display: 'flex', justifyContent: 'center' }}>Status</div>
                  </div>
                  {loadingRelatorio ? (
                    <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                      <Spinner animation="border" />
                    </div>
                  ) : (
                    alunosRelatorio.map(a => {
                      const registrosAluno = registrosRelatorio.filter(r => r.alunoId === a.id);
                      const presencas = registrosAluno.filter(r => r.presenca === true).length;
                      const faltas = registrosAluno.filter(r => r.presenca === false).length;
                      const total = registrosAluno.length;
                      const percentual = total > 0 ? ((presencas / total) * 100).toFixed(1) : '0.0';
                      let status = null;

                      if (parseFloat(percentual) >= 80) {
                        status = (
                          <span className="badge bg-success d-flex align-items-center gap-1 justify-content-center" style={{ width: 'fit-content' }}>
                            <CheckCircle size={16} /> OK
                          </span>
                        );
                      } else if (parseFloat(percentual) >= 60) {
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
                        <Card
                          key={a.id}
                          className="w-100 custom-card-frequencia mb-0"
                        >
                          <Card.Body className="d-flex justify-content-between align-items-center py-3 px-3">
                            <div className="d-flex align-items-center" style={{ width: '25%' }}>
                              <div className="user-icon-circle-frequencia">
                                <User size={24} color="#fff" />
                              </div>
                              <span className="aluno-nome-frequencia ms-2" style={{ fontSize: '1rem' }}>{a.nome}</span>
                            </div>
                            <div style={{ width: '15%', textAlign: 'center' }}>
                              <span className="text-success fw-bold">{presencas}</span>
                            </div>
                            <div style={{ width: '15%', textAlign: 'center' }}>
                              <span className="text-danger fw-bold">{faltas}</span>
                            </div>
                            <div style={{ width: '20%', display: 'flex', alignItems: 'center', gap: '8px' }} className='nothing-in-mobile'>
                              <div
                                className="progress"
                                style={{
                                  width: '120px', // largura fixa
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
                                  aria-valuenow={parseFloat(percentual)}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                ></div>
                              </div>
                              <span
                                style={{
                                  fontWeight: 'bold',
                                  minWidth: '40px',
                                  textAlign: 'right',
                                  fontSize: '0.9rem',
                                }}
                              >
                                {percentual}%
                              </span>
                            </div>
                            <div style={{ width: '20%', textAlign: 'center', justifyContent: 'center', display: 'flex' }}>{status}</div>
                          </Card.Body>
                        </Card>
                      );
                    })
                  )}
                </div>
              </Card.Body>
            </Card>
            // </Row>
          )}

          {activeTab === "lancamento-frequencia" && alunos.length > 0 && (
            <>
              <Row className='pt-4 info-cards-frequencia'>
                <Col md={4}>
                  <Card className="shadow-sm p-3 text-center">
                    <div className="fs-4 text-success">
                      <FaUserCheck className="me-2" />
                      {totalPresentes}
                    </div>
                    <div className="fw-semibold fs-6">
                      <span className="text-success">Presentes</span>
                      <span className="text-muted"> ({porcentagemPresentes}%)</span>
                    </div>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="shadow-sm p-3 text-center">
                    <div className="fs-4 text-danger">
                      <FaUserTimes className="me-2" />
                      {totalAusentes}
                    </div>
                    <div className="fw-semibold fs-6">
                      <span className="text-danger">Ausentes</span>
                      <span className="text-muted"> ({porcentagemAusentes}%)</span>
                    </div>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="shadow-sm p-3 text-center">
                    <div className="fs-4 text-secondary">
                      <FaUsers className="me-2" />
                      {totalAlunos}
                    </div>
                    <div className="fw-semibold fs-6 text-secondary">Total de Alunos</div>
                  </Card>
                </Col>
              </Row>
              <Card className='shadow-sm p-3'>
                <Col md={12} className="d-flex justify-content-end gap-3">
                  <Form.Control
                    type="search"
                    placeholder="Buscar aluno..."
                    value={buscaNome}
                    onChange={e => setBuscaNome(e.target.value)}
                    autoComplete="off"
                  />
                  <Button
                    variant={filtroAlunos === "todos" ? "primary" : "outline-primary"}
                    onClick={() => filtrarAlunos('todos')}
                    className="d-flex align-items-center gap-2"
                  >
                    Todos
                  </Button>

                  <Button
                    variant={filtroAlunos === "presentes" ? "primary" : "outline-primary"}
                    onClick={() => filtrarAlunos('presentes')}
                    className="d-flex align-items-center gap-2"
                  >
                    Presentes
                  </Button>

                  <Button
                    variant={filtroAlunos === "ausentes" ? "primary" : "outline-primary"}
                    onClick={() => filtrarAlunos('ausentes')}
                    className="d-flex align-items-center gap-2"
                  >
                    Ausentes
                  </Button>

                </Col>
              </Card>
            </>
          )}

          {loading ? (
            <div className="d-flex justify-content-center align-items-center vh-50">
              <Spinner animation="border" />
            </div>
          ) : (
            activeTab === "lancamento-frequencia" && alunos.length > 0 && (
              <Card className="shadow-sm">
                <Card.Body>
                  <h3 className="mb-3 px-3">Lista de Alunos</h3>
                  <div className="d-flex flex-column gap-0">
                    {alunosFiltrados.map(a => (
                      <Card
                        key={a.id}
                        className="w-100 custom-card-frequencia mb-0"
                      >
                        <Card.Body className="d-flex justify-content-between align-items-center py-3 px-3">
                          <div className="d-flex align-items-center">
                            <div className="user-icon-circle-frequencia">
                              <User size={24} color="#fff" />
                            </div>
                            <span className="aluno-nome-frequencia">{a.nome}</span>
                          </div>
                          <div className="d-flex gap-2 button-group-card-frequencia">

                            <Button
                              variant={attendance[a.id] ? "success" : "outline-success"}
                              size="lg"
                              className="btn-presenca-frequencia d-flex align-items-center gap-2"
                              onClick={() => {
                                marcarPresenca(a.id, true);
                                if (justificativas[a.id]) {
                                  setJustificativas(prev => {
                                    const novo = { ...prev };
                                    delete novo[a.id];
                                    return novo;
                                  });
                                  setToast({
                                    show: true,
                                    message: 'Justificativa removida!',
                                    variant: 'danger'
                                  });
                                }
                              }}
                            >
                              <Check size={20} />
                              Presente
                            </Button>

                            <Button
                              variant={attendance[a.id] === false && !justificativas[a.id] ? "danger" : "outline-danger"}
                              size="lg"
                              className="btn-presenca-frequencia d-flex align-items-center gap-2"
                              onClick={() => {
                                marcarPresenca(a.id, false);
                                if (justificativas[a.id]) {
                                  setJustificativas(prev => {
                                    const novo = { ...prev };
                                    delete novo[a.id];
                                    return novo;
                                  });
                                  setToast({
                                    show: true,
                                    message: 'Justificativa removida!',
                                    variant: 'danger'
                                  });
                                }
                              }}
                            >
                              <X size={20} />
                              Ausente
                            </Button>
                            <Button
                              variant={justificativas[a.id] ? "warning" : "outline-warning"}
                              size="lg"
                              className={`btn-presenca-frequencia d-flex align-items-center gap-2 justifyificada-button${justificativas[a.id] ? " selected" : ""}`}
                              onClick={() => {
                                setAlunoJustId(a.id);
                                setJustificativaTexto(justificativas[a.id] || '');
                                setShowJustModal(true);
                              }}
                            >
                              <Info size={20} />
                              Justificado
                            </Button>

                          </div>
                        </Card.Body>
                      </Card>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            )
          )
          }
          {(activeTab === "lancamento-frequencia" && alunos.length > 0 && (
            <Button
              variant="primary"
              onClick={() => setShowModal(true)}
              disabled={
                saving ||
                loading ||
                !alunos.length ||
                Object.keys(attendance).length === 0
              }
              className="d-flex justify-content-center align-items-center mx-auto"
            >
              {saving ? (
                <Spinner animation="border" size="sm" />
              ) : (
                <>
                  <Save size={20} />
                  <span className="ms-2">Salvar Frequência</span>
                </>
              )}
            </Button>
          ))}


          {/* Modal Confirmacao */}
          <Modal show={showModal} onHide={() => setShowModal(false)} centered>
            <Modal.Header closeButton>
              <Modal.Title>Confirmar Frequência</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              Você marcou <strong>{totalPresentes}</strong> presentes e <strong>{totalAusentes}</strong> ausentes. Deseja confirmar?
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowModal(false);
                  handleSalvar(); // aqui você chama sua função de salvar
                }}
              >
                Confirmar
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Modal Justificativa */}
          <Modal show={showJustModal} onHide={() => setShowJustModal(false)} centered>
            <Modal.Header closeButton>
              <Modal.Title>Justificativa de Ausência</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group controlId="justificativa">
                  <Form.Label>Motivo</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Ex: Atestado médico"
                    value={justificativaTexto}
                    onChange={(e) => setJustificativaTexto(e.target.value)}
                  />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowJustModal(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (alunoJustId) {
                    setJustificativas(prev => ({
                      ...prev,
                      [alunoJustId]: justificativaTexto
                    }));
                    // Marca como ausente ao salvar justificativa
                    marcarPresenca(alunoJustId, false);
                  }
                  setShowJustModal(false);
                }}
              >
                Salvar Justificativa
              </Button>
            </Modal.Footer>
          </Modal>

          <ToastContainer position="bottom-end" className="p-3">
            <Toast
              show={toast.show}
              bg={toast.variant}
              onClose={() => setToast(prev => ({ ...prev, show: false }))}
              delay={3000}
              autohide
            >
              <Toast.Body className="text-white">{toast.message}</Toast.Body>
            </Toast>
          </ToastContainer>
        </div>
      </Container>
    </AppLayout>
  );
}







