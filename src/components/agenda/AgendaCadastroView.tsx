// src/components/agenda/AgendaCadastroView.tsx
import { Card, Row, Col, Form, Button, Dropdown, Table } from 'react-bootstrap';
import { Plus, X, Download, ArrowDownUp, Edit, Trash2 } from 'lucide-react';
import Paginacao from '../common/Paginacao';

// Tipos
interface AgendaItem {
  id: string;
  diaSemana: string;
  horario: string;
  materiaId: string;
  turmaId: string;
}

interface Turma {
  id: string;
  nome: string;
  isVirtualizada?: boolean;
  turmaOriginalId?: string;
}

interface Materia {
  id: string;
  nome: string;
}

interface Professor {
  id: string;
  nome: string;
}

interface Vinculo {
  id: string;
  professorId: string;
  materiaId: string;
  turmaId: string;
}

interface AgendaCadastroViewProps {
  // Dados
  turmas: Turma[];
  materias: Materia[];
  professores: Professor[];
  vinculos: Vinculo[];
  diasSemana: string[];
  dadosPaginados: AgendaItem[];
  
  // Filtros
  filtroBusca: string;
  setFiltroBusca: (value: string) => void;
  filtroTurma: string;
  setFiltroTurma: (value: string) => void;
  filtroProfessor: string;
  setFiltroProfessor: (value: string) => void;
  filtroTurno: string;
  setFiltroTurno: (value: string) => void;
  filtroDia: string;
  setFiltroDia: (value: string) => void;
  
  // Ordenação
  ordenacao: 'turno' | 'dia' | 'horario' | 'materia' | 'professor' | 'turma';
  setOrdenacao: (value: 'turno' | 'dia' | 'horario' | 'materia' | 'professor' | 'turma') => void;
  
  // Paginação
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPaginas: number;
  
  // Funções
  limparFiltros: () => void;
  downloadPDF: () => void;
  downloadExcel: () => void;
  handleShow: () => void;
  handleEditar: (item: AgendaItem) => void;
  handleExcluir: (item: AgendaItem) => void;
  formatarNomeProfessor: (nome: string | undefined) => string;
  getShiftColor: (turno: string) => { bg: string; color: string; variant: string };
  
  // Permissões
  isAdmin: boolean;
}

export default function AgendaCadastroView({
  turmas,
  materias,
  professores,
  vinculos,
  diasSemana,
  dadosPaginados,
  filtroBusca,
  setFiltroBusca,
  filtroTurma,
  setFiltroTurma,
  filtroProfessor,
  setFiltroProfessor,
  filtroTurno,
  setFiltroTurno,
  filtroDia,
  setFiltroDia,
  ordenacao,
  setOrdenacao,
  currentPage,
  setCurrentPage,
  totalPaginas,
  limparFiltros,
  downloadPDF,
  downloadExcel,
  handleShow,
  handleEditar,
  handleExcluir,
  formatarNomeProfessor,
  getShiftColor,
  isAdmin
}: AgendaCadastroViewProps) {
  return (
    <div>
      {/* Primeira Row de Filtros */}
      <Card className='mb-3'>
        <Card.Body>
          <Row className="mb-3 mb-custom-mobile-1">
            <Col md={3}>
              <Form.Select value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
                <option value="">Todas as Turmas</option>
                {[...turmas].sort((a, b) => a.nome.localeCompare(b.nome)).map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select value={filtroProfessor} onChange={e => setFiltroProfessor(e.target.value)}>
                <option value="">Todos os Professores</option>
                {[...professores].sort((a, b) => a.nome.localeCompare(b.nome)).map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)}>
                <option value="">Todos os turnos</option>
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select value={filtroDia} onChange={e => setFiltroDia(e.target.value)}>
                <option value="">Todos os dias</option>
                {diasSemana.map(dia => (
                  <option key={dia} value={dia}>{dia}</option>
                ))}
              </Form.Select>
            </Col>
          </Row>

          {/* Segunda Row de Filtros */}
          <Row>
            <Col md={4}>
              <Form.Control
                type="text"
                placeholder="Buscar aulas, professores, matérias..."
                value={filtroBusca}
                onChange={e => setFiltroBusca(e.target.value)}
              />
            </Col>
            <Col md={3} className="d-none d-md-flex align-items-center justify-content-end">
              <Button
                variant="link"
                className="text-muted d-flex align-items-center gap-2 p-0 border-0"
                onClick={limparFiltros}
                style={{ textDecoration: 'none' }}
              >
                <X size={16} />
                <span>Limpar filtros</span>
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Botão Limpar Filtros - Mobile (fora do Card) */}
      <div className="d-block d-md-none mb-2">
        <Button
          className="w-100 d-flex align-items-center justify-content-center gap-2 p-2"
          onClick={limparFiltros}
          style={{ backgroundColor: 'white', color: 'black', textDecoration: 'none', fontWeight: 500, border: '1px solid #e1e7ef' }}
        >
          <X size={16} />
          <span>Limpar filtros</span>
        </Button>
      </div>

      <Row className="align-items-center mb-2">
        <Col md={6} className="mb-2 mb-md-0">
          <Dropdown className="w-100">
            <Dropdown.Toggle
              className="w-100 d-flex align-items-center justify-content-center gap-2"
              style={{ border: '1px solid #e1e7ef', backgroundColor: 'white', color: 'black', fontWeight: 500 }}
              variant="light"
            >
              <Download size={18} />
              Exportar
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
        <Col md={6} className="d-flex justify-content-end">
          <Button
            variant='outline-primary'
            className="d-none d-md-flex align-items-center gap-2"
            onClick={handleShow}
          >
            <Plus size={18} />
            <span>Adicionar Aula</span>
          </Button>
          <Button
            variant='primary'
            className="d-flex d-md-none w-100 align-items-center justify-content-center gap-2"
            onClick={handleShow}
          >
            <Plus size={18} />
            <span>Adicionar Aula</span>
          </Button>
        </Col>
      </Row>

      <Card className='shadow-sm p-3'>
        <div className="d-flex align-items-center justify-content-between mb-3 px-3">
          <h3 className="mb-0">Lista de Aulas</h3>
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
              <Dropdown.Item eventKey="turno" active={ordenacao === 'turno'}>Turno</Dropdown.Item>
              <Dropdown.Item eventKey="dia" active={ordenacao === 'dia'}>Dia</Dropdown.Item>
              <Dropdown.Item eventKey="horario" active={ordenacao === 'horario'}>Horário</Dropdown.Item>
              <Dropdown.Item eventKey="materia" active={ordenacao === 'materia'}>Matéria</Dropdown.Item>
              <Dropdown.Item eventKey="professor" active={ordenacao === 'professor'}>Professor</Dropdown.Item>
              <Dropdown.Item eventKey="turma" active={ordenacao === 'turma'}>Turma</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>

        {/* Versão Desktop - Tabela */}
        <div className="agenda-table-desktop">
          <Table responsive hover>
            <thead className="thead-sticky">
              <tr style={{ textAlign: 'center' }}>
                <th className='text-muted nothing-in-mobile'>Turno</th>
                <th className='text-muted'>Dia</th>
                <th className='text-muted'>Horário</th>
                <th className='text-muted'>Matéria</th>
                <th className='text-muted'>Professor</th>
                <th className='text-muted'>Turma</th>
                <th className='text-muted'>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dadosPaginados.map(item => {
                const horarioInicio = item.horario.split(' - ')[0];
                const hora = parseInt(horarioInicio.split(':')[0]);
                let turno = '';

                if (hora >= 6 && hora < 12) {
                  turno = 'Manhã';
                } else if (hora >= 12 && hora < 18) {
                  turno = 'Tarde';
                } else {
                  turno = 'Noite';
                }

                const materia = materias.find(m => m.id === item.materiaId);
                const vinculo = vinculos.find(v => v.materiaId === item.materiaId && v.turmaId === item.turmaId);
                const professor = professores.find(p => p.id === vinculo?.professorId);
                const turnoStyle = getShiftColor(turno);

                // Buscar turma pelo id exato, se não encontrar, buscar virtualizada pelo turmaOriginalId
                let turma = turmas.find(t => t.id === item.turmaId);
                let nomeTurma = turma?.nome;
                if (!turma) {
                  // Procurar turma virtualizada que tenha turmaOriginalId igual ao turmaId da aula
                  turma = turmas.find(t => t.isVirtualizada && t.turmaOriginalId === item.turmaId);
                  nomeTurma = turma?.nome;
                }
                if (!nomeTurma) nomeTurma = '-';

                return (
                  <tr key={item.id} className='align-middle linha-agenda' style={{ textAlign: 'center' }}>
                    <td className='nothing-in-mobile'>
                      <span
                        className="badge badge-turno px-2 py-1"
                        style={{
                          backgroundColor: turnoStyle.bg,
                          color: turnoStyle.color
                        }}
                      >
                        {turno}
                      </span>
                    </td>
                    <td>{item.diaSemana}</td>
                    <td>{item.horario}</td>
                    <td><strong>{materia?.nome || '-'}</strong></td>
                    <td>{formatarNomeProfessor(professor?.nome)}</td>
                    <td>
                      <span className="badge badge-turma px-2 py-1">
                        {nomeTurma}
                      </span>
                    </td>
                    <td>
                      <Dropdown align="end">
                        <Dropdown.Toggle
                          variant="light"
                          size="sm"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            boxShadow: 'none'
                          }}
                          className="dropdown-toggle-no-caret"
                        >
                          ⋯
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          <Dropdown.Item onClick={() => handleEditar(item)} className="d-flex align-items-center gap-2">
                            <Edit size={16} /> Editar
                          </Dropdown.Item>
                          {isAdmin && (
                            <Dropdown.Item onClick={() => handleExcluir(item)} className="d-flex align-items-center gap-2 text-danger">
                              <Trash2 size={16} /> Excluir
                            </Dropdown.Item>
                          )}
                        </Dropdown.Menu>
                      </Dropdown>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>

        {/* Versão Mobile - Cards */}
        <div className="agenda-mobile-cards d-none">
          {dadosPaginados.length === 0 ? (
            <div className="agenda-empty-state">
              <div className="empty-icon">📅</div>
              <h4>Nenhuma aula encontrada</h4>
              <p>Tente ajustar os filtros ou adicione uma nova aula.</p>
            </div>
          ) : (
            dadosPaginados.map(item => {
              const horarioInicio = item.horario.split(' - ')[0];
              const hora = parseInt(horarioInicio.split(':')[0]);
              let turno = '';
              let turnoClass = '';

              if (hora >= 6 && hora < 12) {
                turno = 'Manhã';
                turnoClass = 'manha';
              } else if (hora >= 12 && hora < 18) {
                turno = 'Tarde';
                turnoClass = 'tarde';
              } else {
                turno = 'Noite';
                turnoClass = 'noite';
              }

              const materia = materias.find(m => m.id === item.materiaId);
              const vinculo = vinculos.find(v => v.materiaId === item.materiaId && v.turmaId === item.turmaId);
              const professor = professores.find(p => p.id === vinculo?.professorId);
              const turma = turmas.find(t => t.id === item.turmaId);

              return (
                <div key={item.id} className="agenda-card-mobile">
                  <div className="agenda-card-header">
                    <span className={`agenda-card-turno ${turnoClass}`}>
                      {turno}
                    </span>
                    <Dropdown align="end">
                      <Dropdown.Toggle
                        variant="light"
                        size="sm"
                        className="dropdown-toggle-no-caret"
                      >
                        ⋯
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item onClick={() => handleEditar(item)} className="d-flex align-items-center gap-2">
                          <Edit size={16} /> Editar
                        </Dropdown.Item>
                        {isAdmin && (
                          <Dropdown.Item onClick={() => handleExcluir(item)} className="d-flex align-items-center gap-2 text-danger">
                            <Trash2 size={16} /> Excluir
                          </Dropdown.Item>
                        )}
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>

                  <div className="agenda-card-body">
                    <div className="agenda-card-row">
                      <span className="agenda-card-label">Dia:</span>
                      <span className="agenda-card-value">{item.diaSemana}</span>
                    </div>
                    <div className="agenda-card-row">
                      <span className="agenda-card-label">Horário:</span>
                      <span className="agenda-card-value highlight">{item.horario}</span>
                    </div>
                    <div className="agenda-card-row">
                      <span className="agenda-card-label">Matéria:</span>
                      <span className="agenda-card-value highlight">{materia?.nome || '-'}</span>
                    </div>
                    <div className="agenda-card-row">
                      <span className="agenda-card-label">Professor:</span>
                      <span className="agenda-card-value">{formatarNomeProfessor(professor?.nome)}</span>
                    </div>
                  </div>

                  <div className="agenda-card-footer">
                    <span className="agenda-card-turma-badge">
                      {turma?.nome || '-'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Paginacao
        paginaAtual={currentPage}
        totalPaginas={totalPaginas}
        aoMudarPagina={setCurrentPage}
      />
    </div>
  );
}
