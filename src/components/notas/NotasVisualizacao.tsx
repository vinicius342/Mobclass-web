// src/components/notas/NotasVisualizacao.tsx
import { JSX, useState } from 'react';
import { Row, Col, Card, FormControl, Dropdown, Button, Modal, Table } from 'react-bootstrap';
import { BarChart, Award, Activity, TrendingDown, ArrowDownUp, Download } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faFaceFrown, faSearch } from '@fortawesome/free-solid-svg-icons';
import { FaClockRotateLeft } from 'react-icons/fa6';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip } from 'recharts';
import Paginacao from '../common/Paginacao';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Turma { id: string; nome: string; }
interface Aluno { uid: string; nome: string; turmaId: string; }
interface Materia { id: string; nome: string; turmaId?: string; }
interface Nota {
  id: string; turmaId: string; materiaId: string; bimestre: string;
  notaParcial: number; notaGlobal: number; notaParticipacao: number;
  notaRecuperacao?: number;
  alunoUid: string; nomeAluno: string; dataLancamento: string;
}

interface NotasVisualizacaoProps {
  filtroTurma: string;
  filtroMateria: string;
  filtroBimestre: string;
  busca: string;
  setBusca: (value: string) => void;
  turmas: Turma[];
  materias: Materia[];
  alunos: Aluno[];
  notas: Nota[];
  isAdmin: boolean;
  paginaAtualPorBimestre: Record<string, number>;
  itensPorPagina: number;
  onPaginaChange: (bimestre: string, pagina: number) => void;
}

export default function NotasVisualizacao({
  filtroTurma,
  filtroMateria,
  filtroBimestre,
  busca,
  setBusca,
  turmas,
  materias,
  alunos,
  notas,
  isAdmin,
  paginaAtualPorBimestre,
  itensPorPagina,
  onPaginaChange
}: NotasVisualizacaoProps): JSX.Element {
  const [showHistorico, setShowHistorico] = useState(false);
  const [historicoAluno, setHistoricoAluno] = useState<{ nome: string, notas: Nota[] } | null>(null);
  const [ordenacao, setOrdenacao] = useState<'nome' | 'parcial' | 'global' | 'participacao' | 'recuperacao' | 'media' | 'data'>('nome');

  const getNotaColor = (valor: number | undefined) => {
    if (typeof valor !== 'number') return '';
    if (valor >= 9) return 'text-success';
    if (valor >= 6) return 'text-warning';
    return 'text-danger';
  };

  if (!filtroTurma || !filtroMateria || !filtroBimestre) {
    return (
      <Card className="shadow-sm">
        <Card.Body>
          <div className="text-center text-muted py-5">
            <FontAwesomeIcon icon={faCircleExclamation} size="2x" className="mb-3" />
            <div>Selecione turma, matéria e bimestre para visualização.</div>
          </div>
        </Card.Body>
      </Card>
    );
  }

  // Filtrar e deduplicar notas (mantém apenas a mais recente por aluno/matéria)
  const resultadosMap = new Map<string, Nota>();
  notas.forEach(n => {
    const aluno = alunos.find(a => a.uid === n.alunoUid);
    const alunoAtivo = aluno && (aluno as any).status !== 'Inativo';
    
    if (!alunoAtivo || n.turmaId !== filtroTurma || n.materiaId !== filtroMateria || 
        n.bimestre !== filtroBimestre || !n.nomeAluno.toLowerCase().includes(busca.toLowerCase()) ||
        (!isAdmin && !materias.some(m => m.id === n.materiaId))) {
      return;
    }

    const chave = `${n.alunoUid}-${n.materiaId}`;
    const existente = resultadosMap.get(chave);
    const dataAtual = new Date(n.dataLancamento.split('/').reverse().join('-')).getTime();
    const dataExistente = existente ? new Date(existente.dataLancamento.split('/').reverse().join('-')).getTime() : 0;
    if (!existente || dataAtual > dataExistente) {
      resultadosMap.set(chave, n);
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
  const paginaAtual = paginaAtualPorBimestre[filtroBimestre] || 1;

  const calcularMediaFinal = (n: Nota) => {
    const parcial = typeof n.notaParcial === 'number' ? n.notaParcial : 0;
    const global = typeof n.notaGlobal === 'number' ? n.notaGlobal : 0;
    const participacao = typeof n.notaParticipacao === 'number' ? n.notaParticipacao : 0;
    const media = ((parcial + global) / 2) + participacao;
    return Math.min(parseFloat(media.toFixed(1)), 10);
  };

  // Função para exportar PDF das notas
  const downloadPDF = () => {
    const turmaNome = turmas.find(t => t.id === filtroTurma)?.nome || 'Desconhecida';
    const materiaNome = materias.find(m => m.id === filtroMateria)?.nome || 'Desconhecida';

    const doc = new jsPDF();
    doc.text(`Relatório de Notas - ${turmaNome} - ${materiaNome} - ${filtroBimestre} Bimestre`, 14, 15);

    const dadosParaTabela = resultadosFiltrados.map(nota => {
      const mediaFinal = calcularMediaFinal(nota);
      return [
        nota.nomeAluno,
        nota.notaParcial?.toString() || '-',
        nota.notaGlobal?.toString() || '-',
        nota.notaParticipacao?.toString() || '-',
        nota.notaRecuperacao?.toString() || '-',
        mediaFinal.toString(),
        nota.dataLancamento
      ];
    });

    autoTable(doc, {
      startY: 25,
      head: [['Aluno', 'Parcial', 'Global', 'Participação', 'Recuperação', 'Média Final', 'Data']],
      body: dadosParaTabela,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: 25 }
      }
    });

    doc.save(`notas-${turmaNome}-${materiaNome}-${filtroBimestre}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Função para exportar Excel das notas
  const downloadExcel = () => {
    const turmaNome = turmas.find(t => t.id === filtroTurma)?.nome || 'Desconhecida';
    const materiaNome = materias.find(m => m.id === filtroMateria)?.nome || 'Desconhecida';

    const dadosParaExcel = resultadosFiltrados.map(nota => {
      const mediaFinal = calcularMediaFinal(nota);
      return {
        'Aluno': nota.nomeAluno,
        'Nota Parcial': nota.notaParcial || '-',
        'Nota Global': nota.notaGlobal || '-',
        'Nota Participação': nota.notaParticipacao || '-',
        'Nota Recuperação': nota.notaRecuperacao || '-',
        'Média Final': mediaFinal,
        'Data Lançamento': nota.dataLancamento
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dadosParaExcel);
    worksheet['!cols'] = [
      { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 18 },
      { wch: 18 }, { wch: 15 }, { wch: 18 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Notas');
    XLSX.writeFile(workbook, `notas-${turmaNome}-${materiaNome}-${filtroBimestre}-${new Date().toISOString().split('T')[0]}.xlsx`);
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

  // Função reutilizável para ordenar e paginar resultados
  const ordenarDados = (dados: Nota[]) => {
    let dadosOrdenados = [...dados];
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
    return dadosOrdenados.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);
  };

  return (
    <>
      {/* Desktop: Row layout */}
      <Row className="mb-3 d-none d-md-flex">
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

      {/* Mobile: Block layout with full width */}
      <div className="d-block d-md-none mb-3">
        <Card className="text-center shadow-sm mb-2 w-100">
          <Card.Body>
            <Card.Title className="fw-bold text-muted fs-6">Média Geral</Card.Title>
            <h4 className="fw-bold text-primary d-flex justify-content-center align-items-center gap-2">
              <BarChart size={20} className="text-primary" />
              {mediaTurma}
            </h4>
          </Card.Body>
        </Card>

        <Card className="text-center shadow-sm mb-2 w-100">
          <Card.Body>
            <Card.Title className="fw-bold text-muted fs-6">Excelentes (≥ 9)</Card.Title>
            <h4 className="fw-bold text-success d-flex justify-content-center align-items-center gap-2">
              <Award size={20} className="text-success" />
              {estatisticas.excelentes}
            </h4>
          </Card.Body>
        </Card>

        <Card className="text-center shadow-sm mb-2 w-100">
          <Card.Body>
            <Card.Title className="fw-bold text-muted fs-6">Regulares (6 a 8.9)</Card.Title>
            <h4 className="fw-bold text-warning d-flex justify-content-center align-items-center gap-2">
              <Activity size={20} className="text-warning" />
              {estatisticas.regulares}
            </h4>
          </Card.Body>
        </Card>

        <Card className="text-center shadow-sm mb-2 w-100">
          <Card.Body>
            <Card.Title className="fw-bold text-muted fs-6">Baixas (&lt; 6)</Card.Title>
            <h4 className="fw-bold text-danger d-flex justify-content-center align-items-center gap-2">
              <TrendingDown size={20} className="text-danger" />
              {estatisticas.baixas}
            </h4>
          </Card.Body>
        </Card>
      </div>

      {/* Cards com gráficos */}
      <Row className="notas-charts-mobile">
        <Col md={6} className='mb-0'>
          <Card className="shadow-md mb-3">
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
          <Card className="shadow-md mb-0">
            <Card.Body>
              <h3 className="fs-5 fw-bold text-dark mb-0 mb-1">Top 5 Alunos - Média Final</h3>
              <ResponsiveContainer width="100%" height={250}>
                <ReBarChart
                  data={
                    resultadosFiltrados
                      .filter(nota => {
                        const aluno = alunos.find(a => a.uid === nota.alunoUid);
                        const alunoAtivo = aluno && (aluno as any).status !== 'Inativo';
                        return alunoAtivo && nota.turmaId === filtroTurma;
                      })
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
                    tick={{ fontSize: 12 }}
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

      {/* Card de Exportação */}
      <Row className="mb-3">
        <Col md={6}>
          <Dropdown className="w-100">
            <Dropdown.Toggle
              className="w-100 d-flex align-items-center justify-content-center gap-2"
              style={{ border: '1px solid #e1e7ef', backgroundColor: 'white', color: 'black', fontWeight: 500 }}
              variant="light"
            >
              <Download size={18} />
              Exportar Notas
            </Dropdown.Toggle>
            <Dropdown.Menu className="w-100">
              <Dropdown.Item onClick={downloadPDF}>
                Exportar PDF
              </Dropdown.Item>
              <Dropdown.Item onClick={downloadExcel}>
                Exportar Excel
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </Col>
      </Row>

      <Card className='shadow-sm mb-3 mt-2'>
        <Card.Body>
          <FormControl
            placeholder="Buscar aluno..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            type="search"
            autoComplete="off"
          />
        </Card.Body>
      </Card>

      <Card className="shadow-sm p-3">
        <div className="d-flex align-items-center justify-content-between mb-3 px-3">
          <h3 className="mb-0">Resumo de Notas</h3>
          <Dropdown onSelect={key => setOrdenacao(key as any)}>
            <Dropdown.Toggle
              size="sm"
              variant="outline-secondary"
              id="dropdown-ordenar"
              className="d-flex align-items-center gap-2 py-1 px-2"
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

        {/* Versão Desktop */}
        <div className="notas-table-desktop d-none d-md-block">
          <div className="d-flex fw-bold text-muted px-2 py-2 border-bottom text-center medium">
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
            {ordenarDados(resultadosFiltrados).map(nota => {
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
                          .filter(n => {
                            const aluno = alunos.find(a => a.uid === n.alunoUid);
                            const alunoAtivo = aluno && (aluno as any).status !== 'Inativo';
                            return alunoAtivo && n.alunoUid === nota.alunoUid && 
                                   n.materiaId === filtroMateria && n.turmaId === filtroTurma;
                          })
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
            })}
          </div>
        </div>

        {/* Versão Mobile */}
        <div className="notas-mobile-cards d-block d-md-none">
          {ordenarDados(resultadosFiltrados).map(nota => {
            const mediaFinal = calcularMediaFinal(nota);
            return (
              <div key={nota.id} className="notas-resultado-card">
                <div className="notas-resultado-header">
                  <div className="notas-resultado-nome">{nota.nomeAluno}</div>
                  <div className={`notas-resultado-media ${getNotaColor(mediaFinal)}`}>
                    {mediaFinal}
                  </div>
                </div>

                <div className="notas-resultado-body">
                  <div className="notas-resultado-row">
                    <span className="notas-resultado-label">Parcial:</span>
                    <span className={`notas-resultado-valor ${getNotaColor(nota.notaParcial)}`}>
                      {nota.notaParcial ?? '-'}
                    </span>
                  </div>

                  <div className="notas-resultado-row">
                    <span className="notas-resultado-label">Global:</span>
                    <span className={`notas-resultado-valor ${getNotaColor(nota.notaGlobal)}`}>
                      {nota.notaGlobal ?? '-'}
                    </span>
                  </div>

                  <div className="notas-resultado-row">
                    <span className="notas-resultado-label">Participação:</span>
                    <span className={`notas-resultado-valor ${getNotaColor(nota.notaParticipacao)}`}>
                      {nota.notaParticipacao ?? '-'}
                    </span>
                  </div>

                  <div className="notas-resultado-row">
                    <span className="notas-resultado-label">Recuperação:</span>
                    <span className={`notas-resultado-valor ${getNotaColor(nota.notaRecuperacao)}`}>
                      {nota.notaRecuperacao ?? '-'}
                    </span>
                  </div>
                </div>

                <div className="notas-resultado-footer">
                  <span className="notas-resultado-data">{nota.dataLancamento}</span>
                  <Button
                    size="sm"
                    variant="outline-primary"
                    className="notas-action-mobile d-flex align-items-center gap-1"
                    onClick={() => {
                      const historicoNotas = notas
                        .filter(n => {
                          const aluno = alunos.find(a => a.uid === n.alunoUid);
                          const alunoAtivo = aluno && (aluno as any).status !== 'Inativo';
                          return alunoAtivo && n.alunoUid === nota.alunoUid && 
                                 n.materiaId === filtroMateria && n.turmaId === filtroTurma;
                        })
                        .sort((a, b) => {
                          const ordem = ['1º', '2º', '3º', '4º'];
                          return ordem.indexOf(a.bimestre) - ordem.indexOf(b.bimestre);
                        });
                      setHistoricoAluno({ nome: nota.nomeAluno, notas: historicoNotas });
                      setShowHistorico(true);
                    }}
                  >
                    <FaClockRotateLeft size={14} />
                    Histórico
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-3">
        <Paginacao
          paginaAtual={paginaAtual}
          totalPaginas={totalPaginas}
          aoMudarPagina={(pagina) => onPaginaChange(filtroBimestre, pagina)}
        />
      </div>

      {/* Modal de Histórico */}
      <Modal
        show={showHistorico}
        onHide={() => setShowHistorico(false)}
        centered
        className="historico-modal"
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Histórico de Notas - {historicoAluno?.nome}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {historicoAluno?.notas && historicoAluno.notas.length > 0 && (
            <Row>
              <Col md={5}>
                <Card className='mb-2 py-1'>
                  <Card.Body className="py-2 px-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center gap-2">
                        <Download size={16} />
                        <h6 className="text-dark fw-medium mb-0 fs-6">Exportar Histórico</h6>
                      </div>
                      <div className="d-flex gap-2">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => {
                            if (!historicoAluno) return;
                            const turmaNome = turmas.find(t => t.id === filtroTurma)?.nome || 'Desconhecida';
                            const materiaNome = materias.find(m => m.id === filtroMateria)?.nome || 'Desconhecida';
                            const doc = new jsPDF();
                            doc.text(`Histórico de Notas - ${historicoAluno.nome} - ${turmaNome} - ${materiaNome}`, 14, 15);
                            const dadosParaTabela = ['1º', '2º', '3º', '4º'].map(bim => {
                              const nota = historicoAluno.notas.find(n => n.bimestre === bim);
                              const mediaFinal = nota ? calcularMediaFinal(nota) : '-';
                              return [
                                bim,
                                nota?.notaParcial?.toString() || '-',
                                nota?.notaGlobal?.toString() || '-',
                                nota?.notaParticipacao?.toString() || '-',
                                nota?.notaRecuperacao?.toString() || '-',
                                typeof mediaFinal === 'number' ? mediaFinal.toString() : '-',
                                nota?.dataLancamento || '-'
                              ];
                            });
                            autoTable(doc, {
                              startY: 25,
                              head: [['Bimestre', 'Parcial', 'Global', 'Participação', 'Recuperação', 'Média Final', 'Data']],
                              body: dadosParaTabela,
                              styles: { fontSize: 9 },
                              headStyles: { fillColor: [41, 128, 185] },
                              columnStyles: {
                                0: { cellWidth: 20 }, 1: { cellWidth: 20 }, 2: { cellWidth: 20 },
                                3: { cellWidth: 25 }, 4: { cellWidth: 25 }, 5: { cellWidth: 25 }, 6: { cellWidth: 25 }
                              }
                            });
                            doc.save(`historico-${historicoAluno.nome.replace(/\s+/g, '-')}-${turmaNome}-${materiaNome}-${new Date().toISOString().split('T')[0]}.pdf`);
                          }}
                        >
                          Exportar PDF
                        </Button>
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={() => {
                            if (!historicoAluno) return;
                            const turmaNome = turmas.find(t => t.id === filtroTurma)?.nome || 'Desconhecida';
                            const materiaNome = materias.find(m => m.id === filtroMateria)?.nome || 'Desconhecida';
                            const dadosParaExcel = ['1º', '2º', '3º', '4º'].map(bim => {
                              const nota = historicoAluno.notas.find(n => n.bimestre === bim);
                              const mediaFinal = nota ? calcularMediaFinal(nota) : '-';
                              return {
                                'Bimestre': bim,
                                'Nota Parcial': nota?.notaParcial || '-',
                                'Nota Global': nota?.notaGlobal || '-',
                                'Nota Participação': nota?.notaParticipacao || '-',
                                'Nota Recuperação': nota?.notaRecuperacao || '-',
                                'Média Final': typeof mediaFinal === 'number' ? mediaFinal : '-',
                                'Data Lançamento': nota?.dataLancamento || '-'
                              };
                            });
                            const worksheet = XLSX.utils.json_to_sheet(dadosParaExcel);
                            worksheet['!cols'] = [
                              { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 18 },
                              { wch: 18 }, { wch: 15 }, { wch: 18 }
                            ];
                            const workbook = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(workbook, worksheet, 'Histórico');
                            XLSX.writeFile(workbook, `historico-${historicoAluno.nome.replace(/\s+/g, '-')}-${turmaNome}-${materiaNome}-${new Date().toISOString().split('T')[0]}.xlsx`);
                          }}
                        >
                          Exportar Excel
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Versão Desktop */}
          <div className="d-none d-md-block" style={{ overflowX: 'auto' }}>
            {historicoAluno?.notas.length ? (
              <Table bordered size="sm" className="mb-0" style={{ minWidth: 700, fontSize: '1rem', textAlign: 'center', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
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

          {/* Versão Mobile */}
          <div className="d-block d-md-none">
            {historicoAluno?.notas.length ? (
              <div className="historico-mobile-cards">
                {['1º', '2º', '3º', '4º'].map(bim => {
                  const n = historicoAluno.notas.find(nota => nota.bimestre === bim);
                  const mediaFinal = n ? calcularMediaFinal(n) : '-';
                  return (
                    <div key={bim} className="historico-bimestre-card">
                      <div className="historico-bimestre-header">
                        <span className="historico-bimestre-titulo">{bim} Bimestre</span>
                        <span className={`historico-bimestre-media ${getNotaColor(typeof mediaFinal === 'number' ? mediaFinal : undefined)}`}>
                          Média: {typeof mediaFinal === 'number' ? mediaFinal : '-'}
                        </span>
                      </div>
                      <div className="historico-bimestre-body">
                        <div className="historico-nota-row">
                          <span className="historico-nota-label">Parcial:</span>
                          <span className={`historico-nota-valor ${getNotaColor(n?.notaParcial)}`}>
                            {n?.notaParcial ?? '-'}
                          </span>
                        </div>
                        <div className="historico-nota-row">
                          <span className="historico-nota-label">Global:</span>
                          <span className={`historico-nota-valor ${getNotaColor(n?.notaGlobal)}`}>
                            {n?.notaGlobal ?? '-'}
                          </span>
                        </div>
                        <div className="historico-nota-row">
                          <span className="historico-nota-label">Participação:</span>
                          <span className={`historico-nota-valor ${getNotaColor(n?.notaParticipacao)}`}>
                            {n?.notaParticipacao ?? '-'}
                          </span>
                        </div>
                        <div className="historico-nota-row">
                          <span className="historico-nota-label">Recuperação:</span>
                          <span className={`historico-nota-valor ${getNotaColor(n?.notaRecuperacao)}`}>
                            {n?.notaRecuperacao ?? '-'}
                          </span>
                        </div>
                      </div>
                      {n?.dataLancamento && (
                        <div className="historico-bimestre-footer">
                          <small className="text-muted">Lançado em: {n.dataLancamento}</small>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
}
