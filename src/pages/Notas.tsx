// src/pages/Notas.tsx - Atualizado com turmas via professores_materias
import { JSX, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import {
  Container, Row, Col, Button, Form, Table, Spinner, Toast, ToastContainer,
  InputGroup, FormControl,
  Card
} from 'react-bootstrap';
import {
  collection, getDocs, addDoc, updateDoc, doc, Timestamp,
  query, where, getDoc
} from 'firebase/firestore';
import { db } from '../services/firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useAnoLetivo } from '../contexts/AnoLetivoContext';
import { Save, Check, Undo, BookOpen } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import NotasVisualizacao from '../components/notas/NotasVisualizacao';

interface Turma { id: string; nome: string; }
interface Aluno {
  uid: string;
  nome: string;
  turmaId: string;
  historicoTurmas?: { [anoLetivo: string]: string }; // Histórico de turmas por ano letivo
}
interface Materia { id: string; nome: string; turmaId?: string; }
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
  const { anoLetivo } = useAnoLetivo();

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


  // Função auxiliar para obter a turma do aluno no ano letivo específico
  const getTurmaAlunoNoAno = (aluno: Aluno, ano: number): string => {
    const anoStr = ano.toString();

    // Verificar se existe histórico de turmas
    if (aluno.historicoTurmas && aluno.historicoTurmas[anoStr]) {
      return aluno.historicoTurmas[anoStr];
    }

    // Fallback para turmaId atual (compatibilidade com dados antigos)
    return aluno.turmaId;
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      let turmaDocs = [];
      let materiaIds: string[] = [];
      let materiasList: Materia[] = [];

      if (isAdmin) {
        const turmasSnap = await getDocs(collection(db, 'turmas'));
        // Filtra turmas pelo ano letivo selecionado (convertendo para número)
        turmaDocs = turmasSnap.docs.filter(doc => Number(doc.data()?.anoLetivo) === anoLetivo);

        // Busca os vínculos de professores_materias para as turmas do ano letivo
        const turmaIdsAnoLetivo = turmaDocs.map(d => d.id);
        const vinculosSnap = await getDocs(collection(db, 'professores_materias'));
        const vinculosFiltrados = vinculosSnap.docs
          .map(d => ({ id: d.id, ...d.data() as any }))
          .filter(v => turmaIdsAnoLetivo.includes(v.turmaId));

        // Busca as matérias e adiciona o turmaId vindo do vínculo
        const materiasSnap = await getDocs(collection(db, 'materias'));
        const materiasMap = new Map(materiasSnap.docs.map(d => [d.id, { id: d.id, ...d.data() as any }]));

        // Cria lista de matérias com turmaId baseado nos vínculos
        const materiasComTurma = new Map<string, Materia>();
        vinculosFiltrados.forEach(vinculo => {
          const materia = materiasMap.get(vinculo.materiaId);
          if (materia) {
            const key = `${materia.id}_${vinculo.turmaId}`;
            materiasComTurma.set(key, {
              id: materia.id,
              nome: materia.nome,
              turmaId: vinculo.turmaId
            });
          }
        });

        materiasList = Array.from(materiasComTurma.values());
        materiaIds = Array.from(new Set(materiasList.map(m => m.id)));
      } else {
        const vincSnap = await getDocs(query(collection(db, 'professores_materias'), where('professorId', '==', userId)));
        const vincList = vincSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

        const turmaIds = [...new Set(vincList.map(v => v.turmaId))];
        // Busca as turmas e filtra pelo ano letivo (convertendo para número)
        turmaDocs = (await Promise.all(turmaIds.map(async id => await getDoc(doc(db, 'turmas', id))))).filter(doc => doc.exists() && Number(doc.data()?.anoLetivo) === anoLetivo);

        // Filtra vínculos para apenas turmas do ano letivo selecionado
        const turmaIdsAnoLetivo = turmaDocs.map(d => d.id);
        const vinculosFiltrados = vincList.filter(v => turmaIdsAnoLetivo.includes(v.turmaId));

        // Busca as matérias e adiciona o turmaId vindo do vínculo
        materiaIds = [...new Set(vinculosFiltrados.map(v => v.materiaId))];
        const materiasSnap = await Promise.all(
          materiaIds.map(async id => {
            const m = await getDoc(doc(db, 'materias', id));
            return { id: m.id, ...(m.data() as any) };
          })
        );

        // Cria lista de matérias com turmaId baseado nos vínculos
        const materiasComTurma = new Map<string, Materia>();
        vinculosFiltrados.forEach(vinculo => {
          const materia = materiasSnap.find(m => m.id === vinculo.materiaId);
          if (materia) {
            const key = `${materia.id}_${vinculo.turmaId}`;
            materiasComTurma.set(key, {
              id: materia.id,
              nome: materia.nome,
              turmaId: vinculo.turmaId
            });
          }
        });

        materiasList = Array.from(materiasComTurma.values());
      }

      const alunosSnap = await getDocs(collection(db, 'alunos'));
      const alunosList = alunosSnap.docs
        .map(d => ({ uid: d.id, ...(d.data() as any) }))
        .filter(aluno => (aluno as any).status !== 'Inativo') as Aluno[]; // Excluir usuários inativos

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
  }, [userData, anoLetivo]);

  // Limpa os filtros quando o ano letivo muda
  useEffect(() => {
    setFiltroTurma('');
    setFiltroMateria('');
    setFiltroBimestre('');
  }, [anoLetivo]);

  useEffect(() => {
    if (!filtroTurma || !filtroMateria || !filtroBimestre) {
      setNotasEdit({});
      return;
    }
    const alunosFiltrados = alunos
      .filter(a => getTurmaAlunoNoAno(a, anoLetivo) === filtroTurma && (a as any).status !== 'Inativo') // Filtrar por histórico de turmas e excluir inativos
      .sort((a, b) => a.nome.localeCompare(b.nome));
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



  return (
    <AppLayout>
      <Container className="my-4">

        <div className="border-gray-200 mb-3">
          {/* Header */}
          <div className="mb-4 px-1">
            <div className="d-flex align-items-center gap-2 mb-1">
              <BookOpen size={32} color="#2563eb" style={{ minWidth: 32, minHeight: 32 }} />
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
                Gestão de Notas Escolares
              </h1>
            </div>
            <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
              Gerencie lançamentos, avaliações e resultados
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="container px-0 d-none d-md-block">
          <div className="d-flex py-3">
            <div className="custom-tabs-container">
              <button
                className={`custom-tab ${activeTab === 'lancamento-notas' ? 'active' : ''}`}
                onClick={() => setActiveTab('lancamento-notas')}
                type="button"
              >
                Lançamento de Notas
              </button>
              <button
                className={`custom-tab ${activeTab === 'visualizacao-resultados' ? 'active' : ''}`}
                onClick={() => setActiveTab('visualizacao-resultados')}
                type="button"
              >
                Visualização de Resultados
              </button>
            </div>
          </div>
        </div>

        {/* Mobile navigation Tabs */}
        <div className="container px-0 d-block d-md-none">
          <div className="d-flex py-3">
            <div className="w-100 custom-tabs-container">
              <button
                className={`custom-tab ${activeTab === 'lancamento-notas' ? 'active' : ''}`}
                onClick={() => setActiveTab('lancamento-notas')}
                type="button"
                style={{ flex: 1 }}
              >
                Lanç. de Notas
              </button>
              <button
                className={`custom-tab ${activeTab === 'visualizacao-resultados' ? 'active' : ''}`}
                onClick={() => setActiveTab('visualizacao-resultados')}
                type="button"
                style={{ flex: 1 }}
              >
                Vis. de Resultados
              </button>
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
                    {turmas.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Select value={filtroMateria} onChange={e => setFiltroMateria(e.target.value)}>
                    <option value="">Selecione a Matéria</option>
                    {materias
                      .filter(m => !filtroTurma || m.turmaId === filtroTurma)
                      .reduce((unique, m) => {
                        // Remove duplicatas: apenas uma matéria por ID
                        if (!unique.find(item => item.id === m.id)) {
                          unique.push(m);
                        }
                        return unique;
                      }, [] as Materia[])
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
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

                {/* Versão Desktop */}
                <div className="notas-table-desktop d-none d-md-block">
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
                </div>

                {/* Versão Mobile */}
                <div className="notas-mobile-cards d-block d-md-none">
                  {Object.entries(notasEdit)
                    .filter(([uid]) => alunos.find(a => a.uid === uid)?.nome.toLowerCase().includes(busca.toLowerCase()))
                    .map(([uid, nota]) => {
                      const aluno = alunos.find(a => a.uid === uid)!;
                      return (
                        <div key={uid} className="notas-aluno-card">
                          <div className="notas-aluno-header">
                            <div className="notas-aluno-nome">
                              {alunosSalvos.includes(uid) && (
                                <Check size={18} color="#28a745" />
                              )}
                              {aluno.nome}
                            </div>
                          </div>

                          <div className="notas-aluno-body">
                            <div className="notas-campo-mobile">
                              <span className="notas-campo-label">Parcial:</span>
                              <Form.Control
                                type="number"
                                value={nota.notaParcial}
                                onChange={e => handleChange(uid, 'notaParcial', e.target.value)}
                                className={`notas-campo-input${campoAlterado(uid, 'notaParcial') ? ' campo-alterado' : ''}`}
                              />
                            </div>

                            <div className="notas-campo-mobile">
                              <span className="notas-campo-label">Global:</span>
                              <Form.Control
                                type="number"
                                value={nota.notaGlobal}
                                onChange={e => handleChange(uid, 'notaGlobal', e.target.value)}
                                className={`notas-campo-input${campoAlterado(uid, 'notaGlobal') ? ' campo-alterado' : ''}`}
                              />
                            </div>

                            <div className="notas-campo-mobile">
                              <span className="notas-campo-label">Participação:</span>
                              <Form.Control
                                type="number"
                                value={nota.notaParticipacao}
                                onChange={e => handleChange(uid, 'notaParticipacao', e.target.value)}
                                className={`notas-campo-input${campoAlterado(uid, 'notaParticipacao') ? ' campo-alterado' : ''}`}
                              />
                            </div>

                            <div className="notas-campo-mobile">
                              <span className="notas-campo-label">Recuperação:</span>
                              <Form.Control
                                type="number"
                                value={nota.notaRecuperacao}
                                onChange={e => handleChange(uid, 'notaRecuperacao', e.target.value)}
                                className={`notas-campo-input${campoAlterado(uid, 'notaRecuperacao') ? ' campo-alterado' : ''}`}
                              />
                            </div>
                          </div>

                          <Button
                            className="notas-save-button"
                            onClick={() => handleSave(uid)}
                            variant="primary"
                            size="sm"
                          >
                            <Save size={16} className="me-2" />
                            Salvar Notas
                          </Button>
                        </div>
                      );
                    })}
                </div>
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
            <Card className='shadow-sm px-3 pt-3 gap-2 mb-3'>
              <Row className="mb-3">
                <Col md={3}>
                  <Form.Select value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
                    <option value="">Selecione a Turma</option>
                    {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Select value={filtroMateria} onChange={e => setFiltroMateria(e.target.value)}>
                    <option value="">Selecione a Matéria</option>
                    {materias
                      .filter(m => !filtroTurma || m.turmaId === filtroTurma)
                      .reduce((unique, m) => {
                        // Remove duplicatas: apenas uma matéria por ID
                        if (!unique.find(item => item.id === m.id)) {
                          unique.push(m);
                        }
                        return unique;
                      }, [] as Materia[])
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
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
                {/* Botão Desktop */}
                <Col md={3} className="d-none d-md-block">
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
                </Col>
              </Row>
            </Card>

            {/* Botão Mobile */}
            <div className="w-100 my-2 d-block d-md-none">
              <Row>
                <Col>
                  <Button
                    onClick={() => {
                      setFiltroTurma('');
                      setFiltroMateria('');
                      setFiltroBimestre('');
                      setBusca('');
                    }}
                    className="w-100 d-flex align-items-center justify-content-center gap-2 bg-white"
                    style={{ color: 'black', border: '1px solid #e1e7ef' }}
                  >
                    <Undo size={20} />
                    Limpar Filtros
                  </Button>
                </Col>
              </Row>
            </div>

            {/* Visualização dos resultados filtrados por turma, matéria e bimestre */}
            <NotasVisualizacao
              filtroTurma={filtroTurma}
              filtroMateria={filtroMateria}
              filtroBimestre={filtroBimestre}
              busca={busca}
              setBusca={setBusca}
              turmas={turmas}
              materias={materias}
              alunos={alunos}
              notas={notas}
              isAdmin={isAdmin}
              paginaAtualPorBimestre={paginaAtualPorBimestre}
              itensPorPagina={itensPorPagina}
              onPaginaChange={handlePaginaChange}
            />
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
