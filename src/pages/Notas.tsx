// src/pages/Notas.tsx - Atualizado com turmas via professores_materias
import { JSX, useEffect, useState } from 'react';
import { FaClockRotateLeft } from 'react-icons/fa6';
import AppLayout from '../components/AppLayout';
import {
  Container, Row, Col, Button, Form, Table, Spinner, Toast, ToastContainer,
  InputGroup, FormControl,
  Card,
  Modal,
  Dropdown
} from 'react-bootstrap';
import {
  collection, getDocs, addDoc, updateDoc, doc, Timestamp,
  query, where, getDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import Paginacao from '../components/Paginacao';
import { Eye, Plus, Save, Check, Undo, BarChart, Award, Activity, TrendingDown, ArrowDownUp } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faFaceFrown, faSearch } from '@fortawesome/free-solid-svg-icons';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip } from 'recharts';

interface Turma { id: string; nome: string; }
interface Aluno { uid: string; nome: string; turmaId: string; }
interface Materia { id: string; nome: string; turmaId: string; }
interface Nota {
  id: string; turmaId: string; materiaId: string; bimestre: string;
  notaParcial: number; notaGlobal: number; notaParticipacao: number;
  notaRecuperacao?: number;
  alunoUid: string; nomeAluno: string; dataLancamento: string;
}

export default function Notas(): JSX.Element {
  const { userData } = useAuth()!;
  const isAdmin = userData?.tipo === 'administradores';
  const userId = userData?.uid;

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroMateria, setFiltroMateria] = useState('');
  const [filtroBimestre, setFiltroBimestre] = useState('');
  const [notasEdit, setNotasEdit] = useState<Record<string, any>>({});
  const [busca, setBusca] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' as 'success' | 'danger' });
  const [saving, setSaving] = useState(false);
  const [paginaAtualPorBimestre, setPaginaAtualPorBimestre] = useState<Record<string, number>>({ '1º': 1, '2º': 1, '3º': 1, '4º': 1 });
  const itensPorPagina = 10;
  const [alunosSalvos, setAlunosSalvos] = useState<string[]>([]);

  // Estado para modal de histórico
  const [showHistorico, setShowHistorico] = useState(false);
  const [historicoAluno, setHistoricoAluno] = useState<{ nome: string, notas: Nota[] } | null>(null);
  const [ordenacao, setOrdenacao] = useState<'nome' | 'parcial' | 'global' | 'participacao' | 'recuperacao' | 'media' | 'data'>('nome');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      let turmaDocs = [];
      let materiaIds: string[] = [];
      let materiasList: Materia[] = [];

      if (isAdmin) {
        const turmasSnap = await getDocs(collection(db, 'turmas'));
        turmaDocs = turmasSnap.docs;

        const snap = await getDocs(collection(db, 'materias'));
        materiasList = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        materiaIds = materiasList.map(m => m.id);
      } else {
        const vincSnap = await getDocs(query(collection(db, 'professores_materias'), where('professorId', '==', userId)));
        const vincList = vincSnap.docs.map(d => d.data());

        const turmaIds = [...new Set(vincList.map(v => v.turmaId))];
        turmaDocs = await Promise.all(turmaIds.map(async id => await getDoc(doc(db, 'turmas', id))));

        materiaIds = [...new Set(vincList.map(v => v.materiaId))];
        const materiasSnap = await Promise.all(
          materiaIds.map(async id => {
            const m = await getDoc(doc(db, 'materias', id));
            return { id: m.id, ...(m.data() as any) };
          })
        );
        materiasList = materiasSnap;
      }

      const alunosSnap = await getDocs(collection(db, 'alunos'));
      const alunosList = alunosSnap.docs.map(d => ({ uid: d.id, ...(d.data() as any) })) as Aluno[];

      const notasSnap = await getDocs(collection(db, 'notas'));
      const notasDocs = isAdmin ? notasSnap.docs : notasSnap.docs.filter(doc => materiaIds.includes(doc.data().materiaId));

      const notasList = notasDocs.map(docSnap => {
        const data = docSnap.data() as any;
        const alunoData = alunosList.find(a => a.uid === data.alunoUid);
        return {
          id: docSnap.id,
          turmaId: data.turmaId,
          materiaId: data.materiaId,
          bimestre: data.bimestre,
          notaParcial: data.notaParcial,
          notaGlobal: data.notaGlobal,
          notaParticipacao: data.notaParticipacao,
          notaRecuperacao: data.notaRecuperacao,
          alunoUid: data.alunoUid,
          nomeAluno: alunoData?.nome || 'Desconhecido',
          dataLancamento: data.dataLancamento?.toDate().toLocaleDateString('pt-BR') || '',
        };
      });

      setTurmas(
        turmaDocs
          .map(d => ({ id: d.id, nome: d.data()?.nome || '-' }))
          .sort((a, b) => a.nome.localeCompare(b.nome))
      );
      setAlunos(alunosList);
      setMaterias(materiasList);
      setNotas(notasList);
      setLoading(false);
    }
    fetchData();
  }, [userData]);

  useEffect(() => {
    if (!filtroTurma || !filtroMateria || !filtroBimestre) {
      setNotasEdit({});
      return;
    }
    const alunosFiltrados = alunos.filter(a => a.turmaId === filtroTurma).sort((a, b) => a.nome.localeCompare(b.nome));
    const newEdit: Record<string, any> = {};
    alunosFiltrados.forEach(a => {
      const existing = notas.find(n =>
        n.turmaId === filtroTurma &&
        n.materiaId === filtroMateria &&
        n.bimestre === filtroBimestre &&
        n.alunoUid === a.uid
      );
      newEdit[a.uid] = existing
        ? {
          id: existing.id,
          notaParcial: existing.notaParcial?.toString() ?? '',
          notaGlobal: existing.notaGlobal?.toString() ?? '',
          notaParticipacao: existing.notaParticipacao?.toString() ?? '',
          notaRecuperacao: existing.notaRecuperacao?.toString() ?? ''
        }
        : { notaParcial: '', notaGlobal: '', notaParticipacao: '', notaRecuperacao: '' };
    });
    setNotasEdit(newEdit);
  }, [filtroTurma, filtroMateria, filtroBimestre, notas, alunos]);

  const handleChange = (uid: string, field: string, value: string) => {
    setNotasEdit(prev => ({ ...prev, [uid]: { ...prev[uid], [field]: value } }));
  };

  const saveRecord = async (uid: string, data: any) => {
    const parseOrNull = (val: string) => val.trim() !== '' && !isNaN(Number(val)) ? parseFloat(val) : null;

    const payload = {
      turmaId: filtroTurma,
      alunoUid: uid,
      materiaId: filtroMateria,
      bimestre: filtroBimestre,
      notaParcial: parseOrNull(data.notaParcial),
      notaGlobal: parseOrNull(data.notaGlobal),
      notaParticipacao: parseOrNull(data.notaParticipacao),
      notaRecuperacao: parseOrNull(data.notaRecuperacao),
      dataLancamento: Timestamp.now(),
    };

    if (data.id) {
      await updateDoc(doc(db, 'notas', data.id), payload);
    } else {
      await addDoc(collection(db, 'notas'), payload);
    }
  };

  const handleSave = async (uid: string) => {
    if (!filtroTurma || !filtroMateria || !filtroBimestre) return;
    const data = notasEdit[uid];
    const hasAnyNota = [data.notaParcial, data.notaGlobal, data.notaParticipacao].some(val => val.trim() !== '');

    if (!hasAnyNota) {
      setToast({ show: true, message: 'Preencha ao menos um campo de nota', variant: 'danger' });
      return;
    }

    setSaving(true);
    try {
      await saveRecord(uid, data);
      setToast({ show: true, message: 'Nota salva com sucesso!', variant: 'success' });
      setAlunosSalvos(prev => [...prev, uid]);
      setTimeout(() => {
        setAlunosSalvos(prev => prev.filter(id => id !== uid));
      }, 2000); // O check some após 2 segundos (ajuste se quiser)
    } catch (err) {
      console.error(err);
      setToast({ show: true, message: 'Erro ao salvar nota', variant: 'danger' });
    }
    setSaving(false);
  };

  const handleSaveAll = async () => {
    if (!filtroTurma || !filtroMateria || !filtroBimestre) return;
    setSaving(true);
    try {
      for (const [uid, data] of Object.entries(notasEdit)) {
        const hasAnyNota = [data.notaParcial, data.notaGlobal, data.notaParticipacao]
          .some(val => typeof val === 'string' && val.trim() !== '');

        if (hasAnyNota) {
          await saveRecord(uid, data);
        }
      }
      setToast({ show: true, message: 'Notas salvas com sucesso!', variant: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ show: true, message: 'Erro ao salvar notas', variant: 'danger' });
    }
    setSaving(false);
  };

  const handlePaginaChange = (bimestre: string, novaPagina: number) => {
    setPaginaAtualPorBimestre(prev => ({ ...prev, [bimestre]: novaPagina }));
  };

  //Tabs
  const [activeTab, setActiveTab] = useState<'lancamento-notas' | 'visualizacao-resultados'>('lancamento-notas');

  function campoAlterado(uid: string, campo: string): boolean {
    const notaOriginal = notas.find(n =>
      n.turmaId === filtroTurma &&
      n.materiaId === filtroMateria &&
      n.bimestre === filtroBimestre &&
      n.alunoUid === uid
    );
    const valorOriginal = notaOriginal ? ((notaOriginal as Record<string, any>)[campo] ?? '').toString() : '';
    const valorEditado = notasEdit[uid]?.[campo] ?? '';
    return valorEditado !== valorOriginal && valorEditado !== '';
  }

  // Adicione esta função utilitária dentro do componente Notas()
  const getNotaColor = (valor: number | undefined) => {
    if (typeof valor !== 'number') return '';
    if (valor >= 9) return 'text-success';      // verde
    if (valor >= 6) return 'text-warning';      // amarelo
    return 'text-danger';                       // vermelho
  };

  return (
    <AppLayout>
      <Container className="my-4">
        <div className="bg-white border-bottom border-gray-200 mb-4">
          <div className="container px-4 border-bottom">
            <div className="d-flex align-items-center justify-content-between py-4">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="d-flex align-items-center justify-content-center rounded bg-primary text-white fw-bold"
                  style={{ width: 48, height: 48, fontSize: 20 }}
                >
                  10
                </div>
                <div>
                  <h2 className="fs-3 fw-bold text-dark mb-0">Notas</h2>
                  <p className="text-muted mb-0" style={{ fontSize: 14 }}>
                    MobClassApp - Portal do Professor
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* Navigation Tabs */}
          <div className="container px-4">
            <div className="d-flex gap-3 py-3">
              <Button
                variant={activeTab === 'lancamento-notas' ? 'primary' : 'outline-primary'}
                className="d-flex align-items-center gap-2"
                onClick={() => setActiveTab('lancamento-notas')}
              >
                <Plus size={18} className='nothing-in-mobile' />
                <span>Lançamento de Notas</span>
              </Button>
              <Button
                variant={activeTab === 'visualizacao-resultados' ? 'primary' : 'outline-primary'}
                className="d-flex align-items-center gap-2"
                onClick={() => setActiveTab('visualizacao-resultados')}
              >
                <Eye size={18} className='nothing-in-mobile' />
                <span>Visualização de Resultados</span>
              </Button>
            </div>
          </div>
        </div>

        {activeTab === 'lancamento-notas' && (
          <>
            <Card className='shadow-sm p-3'>
              <Row>
                <Col md={3}>
                  <Form.Select value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
                    <option value="">Selecione a Turma</option>
                    {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Select value={filtroMateria} onChange={e => setFiltroMateria(e.target.value)}>
                    <option value="">Selecione a Matéria</option>
                    {materias.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Select value={filtroBimestre} onChange={e => setFiltroBimestre(e.target.value)}>
                    <option value="">Selecione o Bimestre</option>
                    <option value="1º">1º</option>
                    <option value="2º">2º</option>
                    <option value="3º">3º</option>
                    <option value="4º">4º</option>
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <InputGroup>
                    <FormControl placeholder="Buscar aluno" value={busca} onChange={e => setBusca(e.target.value)} />
                  </InputGroup>
                </Col>
              </Row>
            </Card>

            {loading ? (
              <div className="text-center py-5"><Spinner animation="border" /></div>
            ) : !filtroTurma || !filtroMateria || !filtroBimestre ? (
              <Card className="shadow-sm">
                <Card.Body>
                  <div className="text-center text-muted py-5">
                    <FontAwesomeIcon icon={faCircleExclamation} size="2x" className="mb-3" />
                    <div>Selecione turma, matéria e bimestre para lançar notas.</div>
                  </div>
                </Card.Body>
              </Card>
            ) : (
              <>
                <style>{`.table-responsive {overflow-x: visible !important;}`}</style>
                <Card className='shadow-sm p-3'>
                  <Table responsive hover>
                    <thead className="thead-sticky">
                      <tr style={{ textAlign: 'center' }}>
                        <th className='text-muted'>Aluno</th>
                        <th className='text-muted'>Parcial</th>
                        <th className='text-muted'>Global</th>
                        <th className='text-muted'>Participação</th>
                        <th className='text-muted'>Recuperação</th>
                        <th className='text-muted'>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(notasEdit)
                        .filter(([uid]) => alunos.find(a => a.uid === uid)?.nome.toLowerCase().includes(busca.toLowerCase()))
                        .map(([uid, nota]) => {
                          const aluno = alunos.find(a => a.uid === uid)!;
                          return (
                            <tr key={uid} className='align-middle'>
                              <td className='aluno-nome-frequencia ms-2' style={{ fontSize: '1rem', alignItems: 'center' }}>
                                {alunosSalvos.includes(uid) && (
                                  <Check size={18} color="#28a745" style={{ marginRight: 4 }} />
                                )}
                                {aluno.nome}
                              </td>
                              <td>
                                <Form.Control
                                  type="number"
                                  value={nota.notaParcial}
                                  onChange={e => handleChange(uid, 'notaParcial', e.target.value)}
                                  style={{ width: '80px' }}
                                  className={`mx-auto d-block${campoAlterado(uid, 'notaParcial') ? ' campo-alterado' : ''}`}
                                />
                              </td>
                              <td>
                                <Form.Control
                                  type="number"
                                  value={nota.notaGlobal}
                                  onChange={e => handleChange(uid, 'notaGlobal', e.target.value)}
                                  style={{ width: '80px' }}
                                  className={`mx-auto d-block${campoAlterado(uid, 'notaGlobal') ? ' campo-alterado' : ''}`}
                                />
                              </td>
                              <td>
                                <Form.Control
                                  type="number"
                                  value={nota.notaParticipacao}
                                  onChange={e => handleChange(uid, 'notaParticipacao', e.target.value)}
                                  style={{ width: '80px' }}
                                  className={`mx-auto d-block${campoAlterado(uid, 'notaParticipacao') ? ' campo-alterado' : ''}`}
                                />
                              </td>
                              <td>
                                <Form.Control
                                  type="number"
                                  value={nota.notaRecuperacao}
                                  onChange={e => handleChange(uid, 'notaRecuperacao', e.target.value)}
                                  style={{ width: '80px' }}
                                  className={`mx-auto d-block${campoAlterado(uid, 'notaRecuperacao') ? ' campo-alterado' : ''}`}
                                />
                              </td>

                              <td>
                                <Button size="sm" onClick={() => handleSave(uid)}>
                                  <Save size={16} />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </Table>
                </Card>
                {(activeTab === "lancamento-notas" && alunos.length > 0 && (
                  <Button
                    variant="primary"
                    onClick={handleSaveAll}
                    disabled={saving}
                    className="d-flex justify-content-center align-items-center mx-auto"
                  >
                    {saving ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <>
                        <Save size={20} />
                        <span className="ms-2">Salvar Todas</span>
                      </>
                    )}
                  </Button>
                ))}

              </>
            )}
          </>
        )}

        {activeTab === 'visualizacao-resultados' && (
          <>
            <Card className='shadow-sm p-3 gap-2'>
              <Row>
                <Col md={3}>
                  <Form.Select value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
                    <option value="">Selecione a Turma</option>
                    {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Select value={filtroMateria} onChange={e => setFiltroMateria(e.target.value)}>
                    <option value="">Selecione a Matéria</option>
                    {materias.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Select value={filtroBimestre} onChange={e => setFiltroBimestre(e.target.value)}>
                    <option value="">Selecione o Bimestre</option>
                    <option value="1º">1º</option>
                    <option value="2º">2º</option>
                    <option value="3º">3º</option>
                    <option value="4º">4º</option>
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <InputGroup>
                    <FormControl placeholder="Buscar aluno" value={busca} onChange={e => setBusca(e.target.value)} />
                  </InputGroup>
                </Col>
              </Row>
              {/* Botão fora da row, alinhado à direita e mais largo */}
              <div className="d-flex justify-content-end">
                <Button
                  onClick={() => {
                    setFiltroTurma('');
                    setFiltroMateria('');
                    setFiltroBimestre('');
                    setBusca('');
                  }}
                  className="d-flex align-items-center gap-2 text-secondary bg-transparent border-0 px-3 py-2"
                  style={{ minWidth: '180px' }}
                >
                  <Undo size={20} />
                  Limpar Filtros
                </Button>
              </div>
            </Card>

            {/* Visualização dos resultados filtrados por turma, matéria e bimestre */}
            {(() => {
              const bimestre = filtroBimestre;
              if (!filtroTurma || !filtroMateria || !filtroBimestre) {
                return <Card className="shadow-sm">
                  <Card.Body>
                    <div className="text-center text-muted py-5">
                      <FontAwesomeIcon icon={faCircleExclamation} size="2x" className="mb-3" />
                      <div>Selecione turma, matéria e bimestre para visualização.</div>
                    </div>
                  </Card.Body>
                </Card>;
              }

              const resultadosFiltradosOriginal = notas
                .filter(n =>
                  (!filtroTurma || n.turmaId === filtroTurma) &&
                  (!filtroMateria || n.materiaId === filtroMateria) &&
                  n.bimestre === bimestre &&
                  n.nomeAluno.toLowerCase().includes(busca.toLowerCase()) &&
                  (isAdmin || materias.some(m => m.id === n.materiaId))
                );

              const resultadosMap = new Map<string, Nota>();
              resultadosFiltradosOriginal.forEach(nota => {
                const chave = `${nota.alunoUid}-${nota.materiaId}`;
                const existente = resultadosMap.get(chave);
                const dataAtual = new Date(nota.dataLancamento.split('/').reverse().join('-')).getTime();
                const dataExistente = existente ? new Date(existente.dataLancamento.split('/').reverse().join('-')).getTime() : 0;
                if (!existente || dataAtual > dataExistente) {
                  resultadosMap.set(chave, nota);
                }
              });

              const resultadosFiltrados = Array.from(resultadosMap.values()).sort((a, b) => a.nomeAluno.localeCompare(b.nomeAluno));

              if (resultadosFiltrados.length === 0) {
                return (

                  <Card className="shadow-sm">
                    <Card.Body>
                      <div className="text-center text-muted py-5">
                        <FontAwesomeIcon icon={faSearch} size="2x" className="mb-3" />
                        <div>Nenhuma nota encontrada para os filtros selecionados.</div>
                      </div>
                    </Card.Body>
                  </Card>

                );
              }

              const totalPaginas = Math.ceil(resultadosFiltrados.length / itensPorPagina);
              const paginaAtual = paginaAtualPorBimestre[bimestre] || 1;

              const calcularMediaFinal = (n: Nota) => {
                const parcial = typeof n.notaParcial === 'number' ? n.notaParcial : 0;
                const global = typeof n.notaGlobal === 'number' ? n.notaGlobal : 0;
                const participacao = typeof n.notaParticipacao === 'number' ? n.notaParticipacao : 0;
                const media = ((parcial + global) / 2) + participacao;
                return Math.min(parseFloat(media.toFixed(1)), 10);
              };

              const mediasFinais = resultadosFiltrados.map(calcularMediaFinal);
              const totalAlunos = mediasFinais.length;
              const mediaTurma = totalAlunos ? (mediasFinais.reduce((a, b) => a + b, 0) / totalAlunos).toFixed(1) : '-';

              const faixa = (min: number, max: number) =>
                mediasFinais.filter(m => m >= min && m <= max).length;

              const estatisticas = {
                excelentes: faixa(9, 10),
                boas: faixa(7, 8.9),
                regulares: faixa(6, 8.9),
                baixas: faixa(0, 5.9),
              };

              return (
                <>
                  <Row className="mb-4">
                    <Col md={3}>
                      <Card className="text-center shadow-sm mb-0">
                        <Card.Body>
                          <Card.Title className="fw-bold text-muted fs-6">Média Geral</Card.Title>
                          <h4 className="fw-bold text-primary d-flex justify-content-center align-items-center gap-2">
                            <BarChart size={20} className="text-primary" />
                            {mediaTurma}
                          </h4>
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col md={3}>
                      <Card className="text-center shadow-sm mb-0">
                        <Card.Body>
                          <Card.Title className="fw-bold text-muted fs-6">Excelentes (≥ 9)</Card.Title>
                          <h4 className="fw-bold text-success d-flex justify-content-center align-items-center gap-2">
                            <Award size={20} className="text-success" />
                            {estatisticas.excelentes}
                          </h4>
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col md={3}>
                      <Card className="text-center shadow-sm mb-0">
                        <Card.Body>
                          <Card.Title className="fw-bold text-muted fs-6">Regulares (6 a 8.9)</Card.Title>
                          <h4 className="fw-bold text-warning d-flex justify-content-center align-items-center gap-2">
                            <Activity size={20} className="text-warning" />
                            {estatisticas.regulares}
                          </h4>
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col md={3}>
                      <Card className="text-center shadow-sm mb-0">
                        <Card.Body>
                          <Card.Title className="fw-bold text-muted fs-6">Baixas (&lt; 6)</Card.Title>
                          <h4 className="fw-bold text-danger d-flex justify-content-center align-items-center gap-2">
                            <TrendingDown size={20} className="text-danger" />
                            {estatisticas.baixas}
                          </h4>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {/* Cards com gráficos */}
                  <Row>
                    <Col md={6}>
                      <Card className="shadow-md mb-4">
                        <Card.Body>
                          <h3 className="fs-5 fw-bold text-dark mb-0 mb-1">Distribuição das Notas</h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={[
                                  { name: 'Excelentes (≥ 9)', value: estatisticas.excelentes },
                                  { name: 'Regulares (6 a 8.9)', value: estatisticas.regulares },
                                  { name: 'Baixas (< 6)', value: estatisticas.baixas }
                                ]}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                              >
                                <Cell key="excelentes" fill="#22c55e" />
                                <Cell key="regulares" fill="#facc15" />
                                <Cell key="baixas" fill="#ef4444" />
                              </Pie>
                              <Tooltip formatter={(value: number) => `${value} alunos`} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col md={6}>
                      <Card className="shadow-md mb-4">
                        <Card.Body>
                          <h3 className="fs-5 fw-bold text-dark mb-0 mb-1">Top 5 Alunos - Média Final</h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <ReBarChart
                              data={
                                // Apenas alunos da turma selecionada
                                resultadosFiltrados
                                  .filter(nota => nota.turmaId === filtroTurma)
                                  .map(nota => ({
                                    nome: nota.nomeAluno,
                                    media: calcularMediaFinal(nota)
                                  }))
                                  .sort((a, b) => b.media - a.media)
                                  .slice(0, 5)
                              }
                            >
                              <XAxis
                                dataKey="nome"
                                interval={0}
                                tickFormatter={nome => nome.split(' ')[0]}
                                tick={{ fontSize: 15 }}
                              />
                              <YAxis domain={[0, 10]} tickFormatter={v => v} />
                              <ReTooltip formatter={(value: number) => value.toFixed(1)} />
                              <Bar dataKey="media" fill="#2563eb" />
                            </ReBarChart>
                          </ResponsiveContainer>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  <Card className="shadow-sm p-3">
                    <div className="d-flex align-items-center justify-content-between mb-3 px-3">
                      <h3 className="mb-0">Resumo de Notas</h3>
                      <Dropdown onSelect={key => setOrdenacao(key as any)}>
                        <Dropdown.Toggle
                          size="sm" // <-- Adicione este atributo
                          variant="outline-secondary"
                          id="dropdown-ordenar"
                          className="d-flex align-items-center gap-2 py-1 px-2" // <-- padding menor
                        >
                          <ArrowDownUp size={16} />
                          Ordenar
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          <Dropdown.Item eventKey="nome" active={ordenacao === 'nome'}>Nome</Dropdown.Item>
                          <Dropdown.Item eventKey="parcial" active={ordenacao === 'parcial'}>Parcial</Dropdown.Item>
                          <Dropdown.Item eventKey="global" active={ordenacao === 'global'}>Global</Dropdown.Item>
                          <Dropdown.Item eventKey="participacao" active={ordenacao === 'participacao'}>Participação</Dropdown.Item>
                          <Dropdown.Item eventKey="recuperacao" active={ordenacao === 'recuperacao'}>Recuperação</Dropdown.Item>
                          <Dropdown.Item eventKey="media" active={ordenacao === 'media'}>Média Final</Dropdown.Item>
                          <Dropdown.Item eventKey="data" active={ordenacao === 'data'}>Data</Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                    </div>

                    <div className="d-none d-md-flex fw-bold text-muted px-2 py-2 border-bottom text-center medium">
                      <div style={{ width: '20%' }}>Aluno</div>
                      <div style={{ width: '10%' }}>Parcial</div>
                      <div style={{ width: '10%' }}>Global</div>
                      <div style={{ width: '12%' }}>Participação</div>
                      <div style={{ width: '12%' }}>Recuperação</div>
                      <div style={{ width: '11%' }}>Média Final</div>
                      <div style={{ width: '14%' }}>Data</div>
                      <div style={{ width: '11%' }}>Ações</div>
                    </div>

                    <div className="d-flex flex-column">
                      {(() => {
                        // Ordenação dos dados
                        let dadosOrdenados = [...resultadosFiltrados];
                        switch (ordenacao) {
                          case 'nome':
                            dadosOrdenados.sort((a, b) => a.nomeAluno.localeCompare(b.nomeAluno));
                            break;
                          case 'parcial':
                            dadosOrdenados.sort((a, b) => (b.notaParcial ?? 0) - (a.notaParcial ?? 0));
                            break;
                          case 'global':
                            dadosOrdenados.sort((a, b) => (b.notaGlobal ?? 0) - (a.notaGlobal ?? 0));
                            break;
                          case 'participacao':
                            dadosOrdenados.sort((a, b) => (b.notaParticipacao ?? 0) - (a.notaParticipacao ?? 0));
                            break;
                          case 'recuperacao':
                            dadosOrdenados.sort((a, b) => (b.notaRecuperacao ?? 0) - (a.notaRecuperacao ?? 0));
                            break;
                          case 'media':
                            dadosOrdenados.sort((a, b) => calcularMediaFinal(b) - calcularMediaFinal(a));
                            break;
                          case 'data':
                            dadosOrdenados.sort((a, b) => {
                              const da = a.dataLancamento.split('/').reverse().join('-');
                              const db = b.dataLancamento.split('/').reverse().join('-');
                              return new Date(db).getTime() - new Date(da).getTime();
                            });
                            break;
                        }
                        dadosOrdenados = dadosOrdenados.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);
                        return dadosOrdenados.map(nota => {
                          const mediaFinal = calcularMediaFinal(nota);
                          return (
                            <div
                              key={nota.id}
                              className="d-flex flex-wrap justify-content-between align-items-center px-2 py-3 border-bottom text-center align-middle medium"
                            >
                              <div style={{ width: '20%', fontWeight: 600 }}>{nota.nomeAluno}</div>
                              <div style={{ width: '10%' }} className={`fw-bold ${getNotaColor(nota.notaParcial)}`}>{nota.notaParcial ?? '-'}</div>
                              <div style={{ width: '10%' }} className={`fw-bold ${getNotaColor(nota.notaGlobal)}`}>{nota.notaGlobal ?? '-'}</div>
                              <div style={{ width: '12%' }} className={`fw-bold ${getNotaColor(nota.notaParticipacao)}`}>{nota.notaParticipacao ?? '-'}</div>
                              <div style={{ width: '12%' }} className={`fw-bold ${getNotaColor(nota.notaRecuperacao)}`}>{nota.notaRecuperacao ?? '-'}</div>
                              <div style={{ width: '11%' }} className={`fw-bold ${getNotaColor(mediaFinal)}`}>{mediaFinal}</div>
                              <div style={{ width: '14%' }} className="text-muted"><small>{nota.dataLancamento}</small></div>
                              <div style={{ width: '11%' }}>
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
                                  onClick={() => {
                                    const historicoNotas = notas
                                      .filter(n =>
                                        n.alunoUid === nota.alunoUid &&
                                        n.materiaId === filtroMateria &&
                                        n.turmaId === filtroTurma
                                      )
                                      .sort((a, b) => {
                                        const ordem = ['1º', '2º', '3º', '4º'];
                                        return ordem.indexOf(a.bimestre) - ordem.indexOf(b.bimestre);
                                      });
                                    setHistoricoAluno({ nome: nota.nomeAluno, notas: historicoNotas });
                                    setShowHistorico(true);
                                  }}
                                >
                                  <FaClockRotateLeft /> Histórico
                                </Button>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </Card>
                  <div className="mt-3">
                    <Paginacao
                      paginaAtual={paginaAtual}
                      totalPaginas={totalPaginas}
                      aoMudarPagina={(pagina) => handlePaginaChange(bimestre, pagina)}
                    />
                  </div>

                  {/* Modal de Histórico */}
                  <style>
                    {` .modal-content {
                    min-width: fit-content!important}
                    `}
                  </style>
                  <Modal show={showHistorico} onHide={() => setShowHistorico(false)} centered>
                    <Modal.Header closeButton>
                      <Modal.Title>
                        Histórico de Notas - {historicoAluno?.nome}
                      </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                      <div style={{ overflowX: 'auto' }}>
                        {historicoAluno?.notas.length ? (
                          <Table
                            bordered
                            size="sm"
                            className="mb-0"
                            style={{
                              minWidth: 700,
                              fontSize: '1rem',
                              textAlign: 'center',
                              borderRadius: 8,
                              overflow: 'hidden',
                              background: '#fff'
                            }}
                          >
                            <thead className="fw-bold text-muted align-middle" style={{ background: '#f8f9fa' }}>
                              <tr>
                                <th style={{ width: '12%' }}>Bimestre</th>
                                <th style={{ width: '14%' }}>Parcial</th>
                                <th style={{ width: '14%' }}>Global</th>
                                <th style={{ width: '14%' }}>Participação</th>
                                <th style={{ width: '14%' }}>Recuperação</th>
                                <th style={{ width: '14%' }}>Média Final</th>
                                <th style={{ width: '18%' }}>Data</th>
                              </tr>
                            </thead>
                            <tbody>
                              {['1º', '2º', '3º', '4º'].map(bim => {
                                const n = historicoAluno.notas.find(nota => nota.bimestre === bim);
                                const mediaFinal = n ? calcularMediaFinal(n) : '-';
                                return (
                                  <tr key={bim}>
                                    <td style={{ fontWeight: 600 }}>{bim}</td>
                                    <td className={`fw-bold ${getNotaColor(n?.notaParcial)}`}>{n?.notaParcial ?? '-'}</td>
                                    <td className={`fw-bold ${getNotaColor(n?.notaGlobal)}`}>{n?.notaGlobal ?? '-'}</td>
                                    <td className={`fw-bold ${getNotaColor(n?.notaParticipacao)}`}>{n?.notaParticipacao ?? '-'}</td>
                                    <td className={`fw-bold ${getNotaColor(n?.notaRecuperacao)}`}>{n?.notaRecuperacao ?? '-'}</td>
                                    <td className={`fw-bold ${getNotaColor(typeof mediaFinal === 'number' ? mediaFinal : undefined)}`}>{typeof mediaFinal === 'number' ? mediaFinal : '-'}</td>
                                    <td className="text-muted"><small>{n?.dataLancamento ?? '-'}</small></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </Table>
                        ) : (
                          <div className="text-center text-muted py-4">
                            <FontAwesomeIcon icon={faFaceFrown} size="2x" className="mb-3" />
                            <div>Nenhuma nota encontrada para este aluno.</div>
                          </div>
                        )}
                      </div>
                    </Modal.Body>
                  </Modal>

                </>
              );
            })()}
          </>
        )}

        <ToastContainer position="bottom-end" className="p-3">
          <Toast bg={toast.variant} show={toast.show} onClose={() => setToast(prev => ({ ...prev, show: false }))} delay={3000} autohide>
            <Toast.Body className="text-white">{toast.message}</Toast.Body>
          </Toast>
        </ToastContainer>
      </Container>
    </AppLayout>
  );
}

























