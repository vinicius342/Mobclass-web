// src/pages/Notas.tsx - Atualizado com turmas via professores_materias
import { JSX, useEffect, useState, useMemo } from 'react';
import AppLayout from '../components/layout/AppLayout';
import {
  Container, Row, Col, Button, Form, Table, Spinner, Toast, ToastContainer,
  InputGroup, FormControl,
  Card
} from 'react-bootstrap';
import { Aluno } from '../models/Aluno';
import { Turma } from '../models/Turma';
import { Nota } from '../models/Nota';
import { NotaService } from '../services/data/NotaService';
import { FirebaseNotaRepository } from '../repositories/nota/FirebaseNotaRepository';
import { turmaService } from '../services/data/TurmaService';
import { AlunoService } from '../services/usuario/AlunoService';
import { FirebaseAlunoRepository } from '../repositories/aluno/FirebaseAlunoRepository';
import { MateriaService, MateriaComTurma } from '../services/data/MateriaService';
import { ProfessorMateriaService } from '../services/data/ProfessorMateriaService';
import { FirebaseProfessorMateriaRepository } from '../repositories/professor_materia/FirebaseProfessorMateriaRepository';
import { FirebaseMateriaRepository } from '../repositories/materia/FirebaseMateriaRepository';
import { useAuth } from '../contexts/AuthContext';
import { useAnoLetivo } from '../contexts/AnoLetivoContext';
import { Save, Check, Undo, BookOpen } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import NotasVisualizacao from '../components/notas/NotasVisualizacao';

export default function Notas(): JSX.Element {
  const { userData } = useAuth()!;
  const isAdmin = userData?.tipo === 'administradores';
  const userId = userData?.uid;
  const { anoLetivo } = useAnoLetivo();

  // Inicializar services
  const notaService = useMemo(
    () => new NotaService(new FirebaseNotaRepository(), new FirebaseMateriaRepository()),
    []
  );
  const alunoService = useMemo(
    () => new AlunoService(new FirebaseAlunoRepository()),
    []
  );
  const materiaService = useMemo(
    () => new MateriaService(new FirebaseMateriaRepository()),
    []
  );
  const professorMateriaService = useMemo(
    () => new ProfessorMateriaService(new FirebaseProfessorMateriaRepository()),
    []
  );

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [materias, setMaterias] = useState<MateriaComTurma[]>([]);
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


  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      try {
        let turmasList: Turma[] = [];
        let materiasList: MateriaComTurma[] = [];
        let materiaIds: string[] = [];

        if (isAdmin) {
          // Buscar todas as turmas do ano letivo
          const todasTurmas = await turmaService.listarTodas();
          turmasList = todasTurmas.filter((t: Turma) => Number(t.anoLetivo) === anoLetivo);

          // Buscar vínculos e matérias
          const turmaIdsAnoLetivo = turmasList.map(t => t.id);
          const todosVinculos = await professorMateriaService.listar();
          const todasMaterias = await materiaService.listar();

          // Construir matérias com turmas usando o service
          materiasList = materiaService.construirMateriasComTurmas(
            todasMaterias,
            todosVinculos,
            turmaIdsAnoLetivo
          );
          materiaIds = Array.from(new Set(materiasList.map(m => m.id)));
        } else {
          // Professor: buscar vínculos do professor
          const vinculosProfessor = await professorMateriaService.listarPorProfessor(userId!);

          // Buscar turmas do ano letivo
          const turmaIdsVinculados = [...new Set(vinculosProfessor.map(v => v.turmaId))];
          const turmasVinculadas = await Promise.all(
            turmaIdsVinculados.map(id => turmaService.buscarPorId(id))
          );
          turmasList = turmasVinculadas
            .filter((t): t is Turma => t !== null && Number(t.anoLetivo) === anoLetivo);

          // Filtrar vínculos para apenas turmas do ano letivo
          const turmaIdsAnoLetivo = turmasList.map(t => t.id);

          // Buscar matérias e construir lista com turmaId usando o service
          const todasMaterias = await materiaService.listar();
          materiasList = materiaService.construirMateriasComTurmas(
            todasMaterias,
            vinculosProfessor,
            turmaIdsAnoLetivo
          );
          materiaIds = Array.from(new Set(materiasList.map(m => m.id)));
        }

        // Buscar todos os alunos ativos
        const todosAlunos = await alunoService['alunoRepository'].findAll();
        const alunosAtivos = todosAlunos
          .filter((a: Aluno) => a.status !== 'Inativo')
          .sort((a: Aluno, b: Aluno) => a.nome.localeCompare(b.nome));

        // Buscar notas
        const todasNotas = await notaService.listarTodas();
        const notasFiltradas = isAdmin
          ? todasNotas
          : todasNotas.filter((n: Nota) => materiaIds.includes(n.materiaId));

        // Mapear notas com nome do aluno
        const notasComNome = notasFiltradas.map((nota: Nota) => ({
          ...nota,
          nomeAluno: alunosAtivos.find((a: Aluno) => a.id === nota.alunoUid)?.nome || 'Desconhecido',
        }));

        setTurmas(turmasList.sort((a, b) => a.nome.localeCompare(b.nome)));
        setAlunos(alunosAtivos);
        setMaterias(materiasList as any); // Type assertion necessária para compatibilidade com estrutura legada
        setNotas(notasComNome);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setToast({ show: true, message: 'Erro ao carregar dados', variant: 'danger' });
      } finally {
        setLoading(false);
      }
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
      .filter(a => alunoService.obterTurmaDoAno(a, anoLetivo) === filtroTurma && (a as any).status !== 'Inativo') // Filtrar por histórico de turmas e excluir inativos
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const newEdit: Record<string, any> = {};
    alunosFiltrados.forEach(a => {
      const existing = notaService.buscarNotaPorFiltros(
        notas,
        filtroTurma,
        filtroMateria,
        filtroBimestre,
        a.id
      );
      newEdit[a.id] = existing
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
    const notaPreparada = notaService.prepararDadosNota({
      ...data,
      turmaId: filtroTurma,
      alunoUid: uid,
      materiaId: filtroMateria,
      bimestre: filtroBimestre,
    });

    await notaService.salvar(notaPreparada);
  };

  const handleSave = async (uid: string) => {
    if (!filtroTurma || !filtroMateria || !filtroBimestre) return;
    const data = notasEdit[uid];

    if (!notaService.validarNotaPreenchida(data)) {
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
        if (notaService.validarNotaPreenchida(data)) {
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
    const notaOriginal = notaService.buscarNotaPorFiltros(
      notas,
      filtroTurma,
      filtroMateria,
      filtroBimestre,
      uid
    );
    const editado = notasEdit[uid];
    return notaService.campoAlterado(editado, notaOriginal, campo);
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
                    {materiaService.removerDuplicatas(
                      materias.filter(m => !filtroTurma || m.turmaId === filtroTurma)
                    ).map(m => (
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
                          .filter(([uid]) => alunos.find(a => a.id === uid)?.nome.toLowerCase().includes(busca.toLowerCase()))
                          .map(([uid, nota]) => {
                            const aluno = alunos.find(a => a.id === uid)!;
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
                    .filter(([uid]) => alunos.find(a => a.id === uid)?.nome.toLowerCase().includes(busca.toLowerCase()))
                    .map(([uid, nota]) => {
                      const aluno = alunos.find(a => a.id === uid)!;
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
                    {materiaService.removerDuplicatas(
                      materias.filter(m => !filtroTurma || m.turmaId === filtroTurma)
                    ).map(m => (
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
              alunos={alunos as any} // Type assertion para compatibilidade temporária
              notas={notas as any} // Type assertion para compatibilidade temporária
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
