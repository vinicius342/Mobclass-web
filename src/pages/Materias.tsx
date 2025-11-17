import { JSX, useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Spinner, Button, Modal, Form,
  ToastContainer, Toast, Pagination, Card, Dropdown, Badge,
  Col,
  Row
} from 'react-bootstrap';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { PlusCircle, PencilFill, TrashFill } from 'react-bootstrap-icons';
import { Notebook } from 'lucide-react';

interface Materia {
  id: string;
  nome: string;
  codigo: string;
  categoria?: string;
}

export default function Materias(): JSX.Element {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [termoBusca, setTermoBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  const itensPorPagina = 10;
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'danger' }>({ show: false, message: '', variant: 'success' });

  useEffect(() => {
    fetchMaterias();
  }, []);

  useEffect(() => {
    if (showModal) {
      setTimeout(() => {
        document.getElementById('nome-materia')?.focus();
      }, 100);
    }
  }, [showModal]);

  const fetchMaterias = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'materias'));
    const lista = snap.docs.map(d => ({
      id: d.id,
      nome: d.data().nome,
      codigo: d.data().codigo,
      categoria: d.data().categoria
    })).sort((a, b) => a.nome.localeCompare(b.nome));
    setMaterias(lista);
    setLoading(false);
  };

  const openModal = (item?: Materia) => {
    if (item) {
      setEditId(item.id);
      setNome(item.nome);
      setCategoria(item.categoria || '');
    } else {
      setEditId(null);
      setNome('');
      setCategoria('');
    }
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const gerarCodigoMateria = (nome: string): string => {
    const prefixo = nome.substring(0, 3).toUpperCase();
    const numero = Math.floor(100 + Math.random() * 900);
    return `${prefixo}${numero}`;
  };

  const handleSalvar = async () => {
    if (!nome.trim()) {
      setToast({ show: true, message: 'Nome da matéria é obrigatório.', variant: 'danger' });
      return;
    }

    if (!categoria) {
      setToast({ show: true, message: 'Categoria é obrigatória.', variant: 'danger' });
      return;
    }

    // Verificar duplicidade (mesmo nome e categoria)
    const materiaDuplicada = materias.find(m =>
      m.nome.toLowerCase().trim() === nome.toLowerCase().trim() &&
      m.categoria === categoria &&
      m.id !== editId
    );

    if (materiaDuplicada) {
      setToast({ show: true, message: 'Já existe uma matéria com este nome nesta categoria.', variant: 'danger' });
      return;
    }

    const codigoGerado = editId
      ? materias.find(m => m.id === editId)?.codigo || gerarCodigoMateria(nome)
      : gerarCodigoMateria(nome);

    const payload = {
      nome: nome.trim(),
      codigo: codigoGerado,
      categoria
    };

    try {
      if (editId) {
        await updateDoc(doc(db, 'materias', editId), payload);
      } else {
        await addDoc(collection(db, 'materias'), payload);
      }
      setToast({ show: true, message: editId ? 'Matéria atualizada com sucesso!' : 'Matéria criada com sucesso!', variant: 'success' });
      closeModal();
      fetchMaterias();
    } catch (err) {
      console.error(err);
      setToast({ show: true, message: 'Erro ao salvar matéria.', variant: 'danger' });
    }
  };

  const handleExcluir = async (id: string) => {
    if (window.confirm('Deseja excluir esta matéria?')) {
      try {
        await deleteDoc(doc(db, 'materias', id));
        setToast({ show: true, message: 'Matéria excluída.', variant: 'success' });
        fetchMaterias();
      } catch (err) {
        console.error(err);
        setToast({ show: true, message: 'Erro ao excluir matéria.', variant: 'danger' });
      }
    }
  };

  // Função para determinar categoria da matéria (usa a categoria salva ou fallback para cálculo automático)
  const getCategoria = (nome: string, categoriaSalva?: string): string => {
    if (categoriaSalva) return categoriaSalva;

    if (/matemática|física|química|biologia|ciências|geometria|álgebra|exatas/i.test(nome)) {
      return 'Exatas';
    } else if (/história|geografia|filosofia|sociologia|humanas/i.test(nome)) {
      return 'Humanas';
    } else if (/português|inglês|espanhol|literatura|linguagens|redação/i.test(nome)) {
      return 'Linguagens';
    }
    return 'Outras';
  };

  // Filtrar matérias baseado na busca e categoria
  const materiasFiltradas = materias.filter(materia => {
    const matchBusca = termoBusca === '' || materia.nome.toLowerCase().includes(termoBusca.toLowerCase());
    const categoriaFinal = getCategoria(materia.nome, materia.categoria);
    const matchCategoria = categoriaFiltro === '' || categoriaFinal === categoriaFiltro;
    return matchBusca && matchCategoria;
  });

  const totalPaginas = Math.ceil(materiasFiltradas.length / itensPorPagina);
  const inicio = (paginaAtual - 1) * itensPorPagina;
  const fim = inicio + itensPorPagina;
  const materiasPaginadas = materiasFiltradas.slice(inicio, fim);

  // Resetar página quando filtros mudam
  useEffect(() => {
    setPaginaAtual(1);
  }, [termoBusca, categoriaFiltro]);

  const getCategoriaBadgeClass = (categoria: string) => {
    switch (categoria) {
      case 'Exatas': return 'status-badge exatas'; // verde
      case 'Humanas': return 'status-badge humanas'; // lilás
      case 'Linguagens': return 'status-badge linguagens'; // laranja
      case 'Outras': return 'status-badge outras'; // cinza escuro
      case 'Total': return 'status-badge total'; // azul claro
      default: return 'status-badge';
    }
  };

  return (
    <AppLayout>
      <Container className="my-4">
        <div className="border-gray-200 mb-3">
          {/* Header */}
          <div className="mb-4 px-1">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center gap-2">
                <Notebook size={32} color="#2563eb" style={{ minWidth: 32, minHeight: 32 }} />
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
                  Gestão de Matérias
                </h1>
              </div>
              <Button variant="primary" onClick={() => openModal()} className="d-none d-md-flex">
                <PlusCircle className="me-2" />
                Nova Matéria
              </Button>
            </div>
            <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
              Gerencie as disciplinas ofertadas na escola
            </p>
          </div>
        </div>

        <Row className='mb-3'>
          <Col md={3}>
            <Card className='py-3 px-2 mb-1'>
              <div className="px-3 py-2 h-100 d-flex flex-column justify-content-center">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <p className="text-sm mb-1" style={{ fontSize: '0.95rem', color: '#6b7280' }}>Total de Matérias</p>
                    <p className="text-2xl fw-bold mb-0" style={{ fontSize: '1.5rem', fontWeight: 500 }}>{materias.length}</p>
                  </div>
                  <div className="p-2 d-flex align-items-center justify-content-center" style={{ background: '#3b82f61a', borderRadius: 12 }}>
                    <div className="rounded" style={{ width: 24, height: 24, background: '#3b82f6' }}></div>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
          <Col md={3}>
            <Card className='py-3 px-2 mb-1'>
              <div className="px-3 py-2 h-100 d-flex flex-column justify-content-center">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <p className="text-sm mb-1" style={{ fontSize: '0.92rem', color: '#6b7280' }}>Exatas</p>
                    <p className="text-2xl fw-bold mb-0" style={{ fontSize: '1.5rem', fontWeight: 500 }}>{materias.filter(m => getCategoria(m.nome, m.categoria) === 'Exatas').length}</p>
                  </div>
                  <div className="p-2 d-flex align-items-center justify-content-center" style={{ background: '#22c55e1a', borderRadius: 12 }}>
                    <div className="rounded" style={{ width: 24, height: 24, background: '#22c55e' }}></div>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
          <Col md={3}>
            <Card className='py-3 px-2 mb-1'>
              <div className="px-3 py-2 h-100 d-flex flex-column justify-content-center">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <p className="text-sm mb-1" style={{ fontSize: '0.92rem', color: '#6b7280' }}>Humanas</p>
                    <p className="text-2xl fw-bold mb-0" style={{ fontSize: '1.5rem', fontWeight: 500 }}>{materias.filter(m => getCategoria(m.nome, m.categoria) === 'Humanas').length}</p>
                  </div>
                  <div className="p-2 d-flex align-items-center justify-content-center" style={{ background: '#a259e61a', borderRadius: 12 }}>
                    <div className="rounded" style={{ width: 24, height: 24, background: '#a259e6' }}></div>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
          <Col md={3}>
            <Card className='py-3 px-2 mb-1'>
              <div className="px-3 py-2 h-100 d-flex flex-column justify-content-center">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <p className="text-sm mb-1" style={{ fontSize: '0.92rem', color: '#6b7280' }}>Linguagens</p>
                    <p className="text-2xl fw-bold mb-0" style={{ fontSize: '1.5rem', fontWeight: 500 }}>{materias.filter(m => getCategoria(m.nome, m.categoria) === 'Linguagens').length}</p>
                  </div>
                  <div className="p-2 d-flex align-items-center justify-content-center" style={{ background: '#ff98001a', borderRadius: 12 }}>
                    <div className="rounded" style={{ width: 24, height: 24, background: '#ff9800' }}></div>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Card de busca e filtro */}
        <div className="card mb-3">
          <div className="card-body d-flex flex-column flex-md-row align-items-md-center gap-3">
            <div className="flex-grow-1">
              <input
                type="text"
                className="form-control"
                placeholder="Buscar matéria..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
              />
            </div>
            <div>
              <select
                className="form-select"
                style={{ minWidth: 180 }}
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
              >
                <option value="">Todas as categorias</option>
                <option value="Exatas">Exatas</option>
                <option value="Humanas">Humanas</option>
                <option value="Linguagens">Linguagens</option>
                <option value="Outras">Outras</option>
              </select>
            </div>
          </div>
        </div>

        {/* Botão mobile Nova Matéria */}
        <div className="d-block d-md-none mb-3">
          <Button variant="primary" onClick={() => openModal()} className="w-100">
            <PlusCircle className="me-2" />
            Nova Matéria
          </Button>
        </div>

        {loading ? (
          <div className="d-flex justify-content-center align-items-center vh-50">
            <Spinner animation="border" />
          </div>
        ) : (
          <>
            {/* Versão Desktop */}
            <div className="materias-list-desktop d-none d-md-block">
              <Card>
                <Card.Body>
                  <h3 className="mb-3 px-3">Matérias</h3>
                  {/* Cabeçalho da lista */}
                  <div className="d-flex justify-content-between px-3 py-2 border-bottom fw-bold text-muted" style={{ fontSize: '1rem', fontWeight: 600 }}>
                    <div style={{ width: '50%' }}>Nome da Matéria</div>
                    <div style={{ width: '25%', textAlign: 'center' }}>Categoria</div>
                    <div style={{ width: '25%', textAlign: 'end', paddingRight: 10 }}>Ações</div>
                  </div>

                  {/* Lista de matérias */}
                  <div>
                    {materiasPaginadas.length > 0 ? materiasPaginadas.map(item => (
                      <Card
                        key={item.id}
                        className="custom-card-frequencia"
                        style={{ borderBottom: '1px solid #f1f3f4' }}
                      >
                        <Card.Body className="d-flex justify-content-between align-items-center py-3 px-3">
                          <div style={{ width: '50%' }}>
                            <span className="aluno-nome-frequencia" style={{ fontSize: '1rem' }}>{item.nome}</span>
                          </div>
                          <div style={{ width: '25%', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <Badge className={getCategoriaBadgeClass(getCategoria(item.nome, item.categoria))} style={{ margin: 0, padding: '2px 8px 2px 8px' }}>
                              {getCategoria(item.nome, item.categoria)}
                            </Badge>
                          </div>
                          <div style={{ width: '25%', textAlign: 'end', paddingRight: 18 }}>
                            <Dropdown align="end">
                              <Dropdown.Toggle
                                variant="light"
                                size="sm"
                                style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
                                className="dropdown-toggle-no-caret"
                              >
                                ⋯
                              </Dropdown.Toggle>
                              <Dropdown.Menu>
                                <Dropdown.Item onClick={() => openModal(item)} className="d-flex align-items-center gap-2">
                                  <PencilFill size={16} /> Editar
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => handleExcluir(item.id)} className="d-flex align-items-center gap-2 text-danger">
                                  <TrashFill size={16} /> Excluir
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </div>
                        </Card.Body>
                      </Card>
                    )) : (
                      <div className="text-center py-5">
                        <p className="text-muted">Nenhuma matéria encontrada.</p>
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </div>

            {/* Versão Mobile */}
            <div className="materias-mobile-cards d-block d-md-none">
              <Card className="shadow-sm">
                <Card.Body>
                  <div className="materias-header-mobile mb-3">
                    <h3 className="mb-0">Matérias</h3>
                  </div>

                  {materiasPaginadas.length > 0 ? (
                    <div className="materias-grid-mobile px-0">
                      {materiasPaginadas.map(item => (
                        <div key={item.id} className="materias-card-mobile">
                          <div className="materias-card-header">
                            <div className="materias-card-info">
                              <div className="materias-card-title">{item.nome}</div>
                              <div className="materias-card-codigo">Código: {item.codigo}</div>
                            </div>
                            <Badge className={getCategoriaBadgeClass(getCategoria(item.nome, item.categoria))}>
                              {getCategoria(item.nome, item.categoria)}
                            </Badge>
                          </div>

                          <div className="materias-card-actions">
                            <button
                              className="materias-action-btn materias-edit-btn"
                              onClick={() => openModal(item)}
                            >
                              <PencilFill size={16} />
                              Editar
                            </button>
                            <button
                              className="materias-action-btn materias-delete-btn"
                              onClick={() => handleExcluir(item.id)}
                            >
                              <TrashFill size={16} />
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="materias-empty-state">
                      <div className="materias-empty-icon">
                        <Notebook size={48} />
                      </div>
                      <h5 className="materias-empty-title">Nenhuma matéria encontrada</h5>
                      <p className="materias-empty-text">
                        {termoBusca || categoriaFiltro
                          ? 'Tente ajustar os filtros de busca.'
                          : 'Comece adicionando sua primeira matéria.'
                        }
                      </p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </div>
          </>
        )}

        {/* Paginação fora do card */}
        {totalPaginas > 1 && (
          <div className="d-flex justify-content-center py-3">
            <Pagination className="mb-0">
              <Pagination.Prev disabled={paginaAtual === 1} onClick={() => setPaginaAtual(p => p - 1)} />
              {[...Array(totalPaginas)].map((_, i) => (
                <Pagination.Item
                  key={i}
                  active={paginaAtual === i + 1}
                  onClick={() => setPaginaAtual(i + 1)}
                >
                  {i + 1}
                </Pagination.Item>
              ))}
              <Pagination.Next disabled={paginaAtual === totalPaginas} onClick={() => setPaginaAtual(p => p + 1)} />
            </Pagination>
          </div>
        )}

        <Modal show={showModal} onHide={closeModal} centered>
          <Modal.Header closeButton>
            <Modal.Title>{editId ? 'Editar Matéria' : 'Nova Matéria'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Nome da Matéria</Form.Label>
                <Form.Control
                  id="nome-materia"
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Digite o nome da matéria..."
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Categoria</Form.Label>
                <Form.Select
                  value={categoria}
                  onChange={e => setCategoria(e.target.value)}
                >
                  <option value="">Selecione uma categoria</option>
                  <option value="Exatas">Exatas</option>
                  <option value="Humanas">Humanas</option>
                  <option value="Linguagens">Linguagens</option>
                  <option value="Outras">Outras</option>
                </Form.Select>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={handleSalvar}
              disabled={!nome.trim() || !categoria}
            >
              {editId ? 'Atualizar' : 'Criar'} Matéria
            </Button>
          </Modal.Footer>
        </Modal>

        <ToastContainer position="bottom-end" className="p-3">
          <Toast bg={toast.variant} show={toast.show} onClose={() => setToast(prev => ({ ...prev, show: false }))} delay={3000} autohide>
            <Toast.Body className="text-white">{toast.message}</Toast.Body>
          </Toast>
        </ToastContainer>
      </Container>
    </AppLayout>
  );
}










