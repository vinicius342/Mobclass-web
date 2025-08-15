// src/pages/Usuarios.tsx - Atualizado com suporte ao modoAcesso "responsavel"
import { useEffect, useState, ChangeEvent, JSX } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Button, Table, Badge, Spinner,
  Modal, InputGroup, FormControl, Toast, ToastContainer, Dropdown, Form, Card
} from 'react-bootstrap';
import { PlusCircle, Person } from 'react-bootstrap-icons';
import Paginacao from '../components/Paginacao';
import { db } from '../services/firebase';
import {
  collection, getDocs, updateDoc, deleteDoc, doc, writeBatch
} from 'firebase/firestore';
import UsuarioForm, { FormValues, AlunoOption } from '../components/UsuarioForm';
import { GraduationCap, Plus } from 'lucide-react';

interface UsuarioBase { id: string; nome: string; email: string; status: 'Ativo' | 'Inativo'; dataCriacao?: any; }
interface Professor extends UsuarioBase { turmas: string[]; }
interface Turma { id: string; nome: string; }
interface Aluno extends UsuarioBase { turmaId?: string; responsavelId?: string; modoAcesso?: string; }
interface Responsavel extends UsuarioBase { filhos?: string[]; }
interface Administrador extends UsuarioBase { }

export default function Usuarios(): JSX.Element {
  const [activeTab, setActiveTab] = useState<'todos' | 'professores' | 'alunos' | 'responsaveis' | 'administradores'>('todos');
  const [search, setSearch] = useState('');
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [administradores, setAdministradores] = useState<Administrador[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunosOptions, setAlunosOptions] = useState<AlunoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [turmaFiltro, setTurmaFiltro] = useState<string>('');
  const itemsPerPage = 10;
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [formDefaults, setFormDefaults] = useState<Partial<FormValues>>({});
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'danger' }>({
    show: false, message: '', variant: 'success'
  });
  const [expandedTurmas, setExpandedTurmas] = useState<Set<string>>(new Set());

  // Função para calcular usuários criados este mês
  const calcularNovosEsteMes = () => {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

    const todosUsuarios = [
      ...professores,
      ...alunos,
      ...responsaveis,
      ...administradores
    ];

    return todosUsuarios.filter(usuario => {
      if (!usuario.dataCriacao) return false;
      
      let dataUsuario: Date;
      
      // Tratar diferentes formatos de data do Firestore
      if (usuario.dataCriacao.toDate) {
        // Timestamp do Firestore
        dataUsuario = usuario.dataCriacao.toDate();
      } else if (usuario.dataCriacao.seconds) {
        // Timestamp em formato objeto
        dataUsuario = new Date(usuario.dataCriacao.seconds * 1000);
      } else if (typeof usuario.dataCriacao === 'string') {
        // String de data
        dataUsuario = new Date(usuario.dataCriacao);
      } else {
        // Já é um objeto Date
        dataUsuario = new Date(usuario.dataCriacao);
      }

      return dataUsuario >= inicioMes && dataUsuario <= fimMes;
    }).length;
  };

  // Função para migrar usuários existentes sem dataCriacao
  const migrarUsuariosExistentes = async () => {
    const batch = writeBatch(db);
    let hasUpdates = false;

    const collections = [
      { name: 'professores', data: professores },
      { name: 'alunos', data: alunos },
      { name: 'responsaveis', data: responsaveis },
      { name: 'administradores', data: administradores }
    ];

    // Data padrão para usuários existentes (1 mês atrás para não influenciar estatísticas atuais)
    const dataDefault = new Date();
    dataDefault.setMonth(dataDefault.getMonth() - 1);

    for (const col of collections) {
      for (const usuario of col.data) {
        if (!usuario.dataCriacao) {
          const docRef = doc(db, col.name, usuario.id);
          batch.update(docRef, { dataCriacao: dataDefault });
          hasUpdates = true;
        }
      }
    }

    if (hasUpdates) {
      try {
        await batch.commit();
        console.log('Migração de usuários existentes concluída');
        // Recarregar dados após migração
        window.location.reload();
      } catch (error) {
        console.error('Erro na migração:', error);
      }
    }
  };

  const getCurrentUsersList = () => {
    let list: any[] = [];

    if (activeTab === 'todos') {
      list = [
        ...professores.map(p => ({ ...p, tipoUsuario: 'professores' })),
        ...alunos.map(a => ({ ...a, tipoUsuario: 'alunos' })),
        ...responsaveis.map(r => ({ ...r, tipoUsuario: 'responsaveis' })),
        ...administradores.map(adm => ({ ...adm, tipoUsuario: 'administradores' }))
      ];
    } else {
      list = activeTab === 'professores'
        ? professores
        : activeTab === 'alunos'
          ? alunos
          : activeTab === 'responsaveis'
            ? responsaveis
            : administradores;
    }

    // Aplicar filtros
    list = list.filter(u => {
      const searchLower = search.toLowerCase();
      const nameMatch = u.nome.toLowerCase().includes(searchLower);
      const emailMatch = u.email.toLowerCase().includes(searchLower);
      
      // Buscar também na coluna info
      let infoMatch = false;
      
      if (u.tipoUsuario === 'responsaveis' || (activeTab === 'responsaveis')) {
        // Para responsáveis, buscar pelo nome dos filhos (alunos)
        const responsavel = u as any;
        if (responsavel.filhos && responsavel.filhos.length > 0) {
          infoMatch = responsavel.filhos.some((filhoId: string) => {
            const aluno = alunos.find(a => a.id === filhoId);
            return aluno && aluno.nome.toLowerCase().includes(searchLower);
          });
        }
      } else if ((u.tipoUsuario === 'alunos' || activeTab === 'alunos') && (u as any).turmaId) {
        // Para alunos, buscar pelo nome da turma
        const turma = turmas.find(t => t.id === (u as any).turmaId);
        infoMatch = !!(turma && turma.nome.toLowerCase().includes(searchLower));
      } else if (u.tipoUsuario === 'professores' || activeTab === 'professores') {
        // Para professores, buscar pelo nome das turmas
        const professor = u as any;
        if (professor.turmas && professor.turmas.length > 0) {
          infoMatch = professor.turmas.some((turmaId: string) => {
            const turma = turmas.find(t => t.id === turmaId);
            return turma && turma.nome.toLowerCase().includes(searchLower);
          });
        }
      }
      
      return nameMatch || emailMatch || infoMatch;
    });

    if (activeTab === 'alunos' && turmaFiltro) {
      list = list.filter(a => (a as Aluno).turmaId === turmaFiltro);
    }

    list = list.sort((a, b) => a.nome.localeCompare(b.nome));

    const startIndex = (currentPage - 1) * itemsPerPage;
    return list.slice(startIndex, startIndex + itemsPerPage);
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [pSnap, aSnap, rSnap, tSnap, admSnap] = await Promise.all([
        getDocs(collection(db, 'professores')),
        getDocs(collection(db, 'alunos')),
        getDocs(collection(db, 'responsaveis')),
        getDocs(collection(db, 'turmas')),
        getDocs(collection(db, 'administradores')),
      ]);
      const alunosList = aSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const professoresList = pSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const responsaveisList = rSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const administradoresList = admSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      
      setProfessores(professoresList);
      setAlunos(alunosList);
      setResponsaveis(responsaveisList);
      setAdministradores(administradoresList);
      setTurmas(tSnap.docs.map(d => ({ id: d.id, nome: (d.data() as any).nome })));
      setLoading(false);
      setAlunosOptions(
        alunosList
          .map(a => {
            const turma = tSnap.docs.find(t => t.id === a.turmaId);
            return {
              id: a.id,
              nome: `${a.nome}${turma ? ` - ${(turma.data() as any).nome}` : ''}`,
            };
          })
          .sort((a, b) => a.nome.localeCompare(b.nome))
      );

      // Verificar se há usuários sem dataCriacao e executar migração se necessário
      const todosUsuarios = [...professoresList, ...alunosList, ...responsaveisList, ...administradoresList];
      const usuariosSemData = todosUsuarios.filter(u => !u.dataCriacao);
      
      if (usuariosSemData.length > 0) {
        console.log(`Encontrados ${usuariosSemData.length} usuários sem dataCriacao. Executando migração...`);
        await migrarUsuariosExistentes();
      }
    }
    fetchData();
  }, []);

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value);

  const toggleExpandTurmas = (userId: string) => {
    setExpandedTurmas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const renderTurmasBadges = (turmasIds: string[], userId: string, maxVisible: number = 2) => {
    const isExpanded = expandedTurmas.has(userId);
    const turmasToShow = isExpanded ? turmasIds : turmasIds.slice(0, maxVisible);
    const remainingCount = turmasIds.length - maxVisible;

    return (
      <>
        {turmasToShow.map(id => {
          const turmaNome = turmas.find(t => t.id === id)?.nome || id;
          return (
            <span 
              key={id} 
              style={{ 
                background: '#e0edff', 
                color: '#2563eb', 
                fontWeight: 700, 
                border: 'none', 
                borderRadius: '12px', 
                padding: '0.22rem 0.5rem', 
                fontSize: '0.71rem', 
                letterSpacing: '0.1px', 
                lineHeight: 1.1, 
                marginRight: 4, 
                display: 'inline-block' 
              }}
            >
              {turmaNome}
            </span>
          );
        })}
        {remainingCount > 0 && (
          <span 
            onClick={() => toggleExpandTurmas(userId)}
            style={{ 
              background: '#f1f5f9', 
              color: '#64748b', 
              fontWeight: 600, 
              border: 'none', 
              borderRadius: '12px', 
              padding: '0.22rem 0.5rem', 
              fontSize: '0.71rem', 
              letterSpacing: '0.1px', 
              lineHeight: 1.1, 
              marginRight: 4, 
              display: 'inline-block',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#e2e8f0'}
            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = '#f1f5f9'}
          >
            {isExpanded ? 'menos' : `+${remainingCount} mais`}
          </span>
        )}
      </>
    );
  };

  const usuarioLogado = { tipo: 'administradores' };

  const filterList = <T extends UsuarioBase>(list: T[]) => {
    let filtered = list.filter(u => {
      const searchLower = search.toLowerCase();
      const nameMatch = u.nome.toLowerCase().includes(searchLower);
      const emailMatch = u.email.toLowerCase().includes(searchLower);
      
      // Buscar também na coluna info (nome do aluno para responsáveis)
      let infoMatch = false;
      if (u.id && responsaveis.find(r => r.id === u.id)) {
        // Para responsáveis, buscar pelo nome dos filhos (alunos)
        const responsavel = u as Responsavel;
        if (responsavel.filhos && responsavel.filhos.length > 0) {
          infoMatch = responsavel.filhos.some(filhoId => {
            const aluno = alunos.find(a => a.id === filhoId);
            return aluno && aluno.nome.toLowerCase().includes(searchLower);
          });
        }
      }
      
      return nameMatch || emailMatch || infoMatch;
    });

    if (activeTab === 'alunos' && usuarioLogado.tipo === 'administrador' && turmaFiltro) {
      filtered = filtered.filter(a => (a as Aluno).turmaId === turmaFiltro);
    }

    return filtered.sort((a, b) => a.nome.localeCompare(b.nome));
  };

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Excluir este usuário?')) return;

    let collectionName = activeTab;
    if (activeTab === 'todos') {
      // Determinar o tipo do usuário pela sua presença nas diferentes coleções
      if (professores.find(p => p.id === id)) collectionName = 'professores';
      else if (alunos.find(a => a.id === id)) collectionName = 'alunos';
      else if (responsaveis.find(r => r.id === id)) collectionName = 'responsaveis';
      else if (administradores.find(adm => adm.id === id)) collectionName = 'administradores';
    }

    await deleteDoc(doc(db, collectionName, id));

    if (collectionName === 'professores') setProfessores(prev => prev.filter(u => u.id !== id));
    if (collectionName === 'alunos') setAlunos(prev => prev.filter(u => u.id !== id));
    if (collectionName === 'responsaveis') setResponsaveis(prev => prev.filter(u => u.id !== id));
    if (collectionName === 'administradores') setAdministradores(prev => prev.filter(u => u.id !== id));

    setToast({ show: true, message: 'Usuário excluído!', variant: 'success' });
  };

  const openEdit = (user: UsuarioBase & any) => {
    const tipoUsuario = activeTab === 'todos' ? user.tipoUsuario : activeTab;
    const defaults: Partial<FormValues> = {
      tipoUsuario,
      nome: user.nome,
      email: user.email,
      ...(tipoUsuario === 'alunos' && { turmaId: user.turmaId }),
      ...(tipoUsuario === 'professores' && { turmas: user.turmas }),
      ...(tipoUsuario === 'responsaveis' && { filhos: user.filhos }),
      ...(user.id && { id: user.id }),
    };
    
    // Adicionar o status aos defaults
    (defaults as any).status = user.status || 'Ativo';
    
    setFormDefaults(defaults);
    setFormMode('edit');
    setShowForm(true);
  };

  const handleSubmit = async (data: FormValues) => {
    try {
      const userData = {
        nome: data.nome,
        email: data.email,
        status: (data as any).status || 'Ativo',
        ...(data.tipoUsuario === 'alunos' && { turmaId: data.turmaId }),
        ...(data.tipoUsuario === 'professores' && { turmas: data.turmas }),
        ...(data.tipoUsuario === 'responsaveis' && { filhos: data.filhos }),
        // Adicionar dataCriacao apenas para novos usuários
        ...(formMode === 'add' && { dataCriacao: new Date() }),
      };

      if (formMode === 'edit') {
        const docRef = doc(db, data.tipoUsuario, (formDefaults as any).id);
        await updateDoc(docRef, userData);
      } else {
        const response = await fetch("https://us-central1-agenda-digital-e481b.cloudfunctions.net/api/criar-usuario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: data.nome,
            email: data.email,
            tipoUsuario: data.tipoUsuario,
            status: (data as any).status || 'Ativo',
            turmaId: data.turmaId,
            filhos: data.filhos,
            turmas: data.turmas,
            dataCriacao: new Date().toISOString(),
          }),
        });

        const result = await response.json();

        if (!response.ok) throw new Error(result.message || "Erro ao criar usuário");

        let mensagem = "Usuário salvo com sucesso!";
        if (data.tipoUsuario === "alunos" && result.modoAcesso === "responsavel") {
          mensagem = "Aluno cadastrado sem login. O acesso será feito pelo responsável.";
        }

        setToast({ show: true, message: mensagem, variant: 'success' });
      }

      setShowForm(false);

      const snapshot = await getDocs(collection(db, data.tipoUsuario));
      const novosDados = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      if (data.tipoUsuario === 'professores') setProfessores(novosDados);
      if (data.tipoUsuario === 'alunos') {
        setAlunos(novosDados);
        setAlunosOptions(novosDados.map(a => {
          const turma = turmas.find(t => t.id === a.turmaId);
          return {
            id: a.id,
            nome: `${a.nome}${turma ? ` (${turma.nome})` : ''}`,
          };
        }));
      }
      if (data.tipoUsuario === 'responsaveis') setResponsaveis(novosDados);
      if (data.tipoUsuario === 'administradores') setAdministradores(novosDados);
    } catch (error: any) {
      console.error(error);
      setToast({ show: true, message: error.message || 'Erro ao salvar usuário.', variant: 'danger' });
    }
  };

  function renderRows(): JSX.Element[] {
    let list: any[] = [];

    if (activeTab === 'todos') {
      // Combinar todos os tipos com uma propriedade indicando o tipo
      list = [
        ...professores.map(p => ({ ...p, tipoUsuario: 'professores' })),
        ...alunos.map(a => ({ ...a, tipoUsuario: 'alunos' })),
        ...responsaveis.map(r => ({ ...r, tipoUsuario: 'responsaveis' })),
        ...administradores.map(adm => ({ ...adm, tipoUsuario: 'administradores' }))
      ];
    } else {
      list = activeTab === 'professores'
        ? filterList(professores)
        : activeTab === 'alunos'
          ? filterList(alunos)
          : activeTab === 'responsaveis'
            ? filterList(responsaveis)
            : filterList(administradores);
    }

    // Aplicar filtros
    list = list.filter(u => {
      const searchLower = search.toLowerCase();
      const nameMatch = u.nome.toLowerCase().includes(searchLower);
      const emailMatch = u.email.toLowerCase().includes(searchLower);
      
      // Buscar também na coluna info
      let infoMatch = false;
      
      if (u.tipoUsuario === 'responsaveis' || (activeTab === 'responsaveis')) {
        // Para responsáveis, buscar pelo nome dos filhos (alunos)
        const responsavel = u as Responsavel;
        if (responsavel.filhos && responsavel.filhos.length > 0) {
          infoMatch = responsavel.filhos.some(filhoId => {
            const aluno = alunos.find(a => a.id === filhoId);
            return aluno && aluno.nome.toLowerCase().includes(searchLower);
          });
        }
      } else if (u.tipoUsuario === 'alunos' && u.turmaId) {
        // Para alunos, buscar pelo nome da turma
        const turma = turmas.find(t => t.id === u.turmaId);
        infoMatch = !!(turma && turma.nome.toLowerCase().includes(searchLower));
      } else if (u.tipoUsuario === 'professores') {
        // Para professores, buscar pelo nome das turmas
        const professor = u as Professor;
        if (professor.turmas && professor.turmas.length > 0) {
          infoMatch = professor.turmas.some(turmaId => {
            const turma = turmas.find(t => t.id === turmaId);
            return turma && turma.nome.toLowerCase().includes(searchLower);
          });
        }
      }
      
      return nameMatch || emailMatch || infoMatch;
    });

    if (activeTab === 'alunos' && usuarioLogado.tipo === 'administrador' && turmaFiltro) {
      list = list.filter(a => (a as Aluno).turmaId === turmaFiltro);
    }

    list = list.sort((a, b) => a.nome.localeCompare(b.nome));

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = list.slice(startIndex, startIndex + itemsPerPage);

    return paginated.map(user => (
      <tr key={user.id} className='align-middle'>
        <td style={{ fontWeight: 600 }}>{user.nome}</td>
        <td className="email-cell">{user.email}</td>
        <td>
          <Badge 
            className={`usuario-status-badge ${user.status === 'Ativo' ? 'ativo' : 'inativo'}`}
            style={{
              backgroundColor: user.status === 'Ativo' ? '#22c55e' : '#6c757d',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              borderRadius: '12px',
              padding: '0.22rem 0.5rem',
              fontSize: '0.71rem',
              letterSpacing: '0.1px',
              lineHeight: 1.1,
              marginRight: 4,
              display: 'inline-block'
            }}
          >
            {user.status === 'Ativo' ? <span style={{fontWeight: 900, marginRight: 3}}>✓</span> : null}
            {user.status || 'Ativo'}
          </Badge>
        </td>
        <td style={{ fontWeight: 600 }}>
          {activeTab === 'todos' ? (
            user.tipoUsuario === 'professores' ? 'Professor' :
              user.tipoUsuario === 'alunos' ? 'Aluno' :
                user.tipoUsuario === 'responsaveis' ? 'Responsável' : 'Administrador'
          ) : (
            <>
              {activeTab === 'professores' && renderTurmasBadges((user as Professor).turmas, user.id)}
              {activeTab === 'alunos' && (
                (user as Aluno).turmaId ? (
                  <span style={{ background: '#e0edff', color: '#2563eb', fontWeight: 700, border: 'none', borderRadius: '12px', padding: '0.22rem 0.5rem', fontSize: '0.71rem', letterSpacing: '0.1px', lineHeight: 1.1, display: 'inline-block' }}>{turmas.find(t => t.id === (user as Aluno).turmaId)?.nome}</span>
                ) : null
              )}
              {activeTab === 'responsaveis' && (user as Responsavel).filhos?.map(filhoId => {
                const alunoNome = alunos.find(a => a.id === filhoId)?.nome;
                return alunoNome ? (
                  <span key={filhoId}>{alunoNome}</span>
                ) : null;
              })}
            </>
          )}
        </td>
        {activeTab === 'todos' && (
          <td style={{ fontSize: '0.9rem' }}>
            {user.tipoUsuario === 'professores' && renderTurmasBadges((user as Professor).turmas, user.id)}
            {user.tipoUsuario === 'alunos' && (user as Aluno).turmaId && (
              <span style={{ background: '#e0edff', color: '#2563eb', fontWeight: 700, border: 'none', borderRadius: '12px', padding: '0.22rem 0.5rem', fontSize: '0.71rem', letterSpacing: '0.1px', lineHeight: 1.1, display: 'inline-block' }}>{turmas.find(t => t.id === (user as Aluno).turmaId)?.nome}</span>
            )}
            {user.tipoUsuario === 'responsaveis' && (user as Responsavel).filhos?.map(filhoId => {
              const alunoNome = alunos.find(a => a.id === filhoId)?.nome;
              return alunoNome ? (
                <span key={filhoId}>{alunoNome}</span>
              ) : null;
            })}
          </td>
        )}
        <td>
          <Dropdown align="end">
            <Dropdown.Toggle 
              variant="light" 
              size="sm"
              className="dropdown-toggle-no-caret"
              style={{
                border: 'none',
                background: 'transparent',
                boxShadow: 'none'
              }}
            >
              ...
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => openEdit(user)}>
                <i className="bi bi-pencil me-2"></i> Editar
              </Dropdown.Item>
              <Dropdown.Item onClick={() => handleExcluir(user.id)}>
                <i className="bi bi-trash me-2"></i> Excluir
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </td>
      </tr>
    ));
  }

  return (
    <AppLayout>
      <Container className="my-4">
        <div className="border-gray-200 mb-3">
          <div className="mb-4 px-1">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center gap-2">
                <Person size={32} color="#2563eb" style={{ minWidth: 32, minHeight: 32 }} />
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
                  Usuários
                </h1>
              </div>
              <div>
                <Button
                  variant="primary"
                  onClick={() => {
                    setFormMode('add');
                    setFormDefaults({ tipoUsuario: activeTab === 'todos' ? 'professores' : activeTab });
                    setShowForm(true);
                  }}
                >
                  <PlusCircle className="me-2" size={18} /> Novo Usuário
                </Button>
              </div>
            </div>
            <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
              Gerencie professores, alunos e demais usuários do sistema
            </p>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="row mb-3 g-3">
          {/* Card Total de Usuários */}
          <div className="col-md-3">
            <div className="card shadow-sm card-sm border-left-primary mb-1">
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                <span className="fw-bold" style={{ fontSize: '1rem', color: '#3b4861' }}>Total de Usuários</span>
                <Person size={20} className="text-primary" />
              </div>
              <div className="card-body py-3">
                <h3 className="mb-0 fw-bold" style={{ color: '#2563eb' }}>
                  {professores.length + alunos.length + responsaveis.length + administradores.length}
                </h3>
              </div>
            </div>
          </div>
          {/* Card Total de Professores */}
          <div className="col-md-3">
            <div className="card shadow-sm card-sm border-left-success mb-1">
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                <span className="fw-bold" style={{ fontSize: '1rem', color: '#3b4861' }}>Professores</span>
                <GraduationCap size={20} className="text-success" />
              </div>
              <div className="card-body py-3">
                <h3 className="mb-0 fw-bold" style={{ color: '#22c55e' }}>{professores.length}</h3>
              </div>
            </div>
          </div>
          {/* Card Turmas Ativas */}
          <div className="col-md-3">
            <div className="card shadow-sm card-sm mb-1" style={{ borderLeft: '4px solid #a78bfa' }}>
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                <span className="fw-bold" style={{ fontSize: '1rem', color: '#3b4861' }}>Turmas Ativas</span>
                <Person size={20} style={{ color: '#a78bfa' }} />
              </div>
              <div className="card-body py-3">
                <h3 className="mb-0 fw-bold" style={{ color: '#a78bfa' }}>{turmas.length}</h3>
              </div>
            </div>
          </div>
          {/* Card Novos este mês */}
          <div className="col-md-3">
            <div className="card shadow-sm card-sm mb-1" style={{ borderLeft: '4px solid #ff9800' }}>
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                <span className="fw-bold" style={{ fontSize: '1rem', color: '#3b4861' }}>Novos este mês</span>
                <Plus size={20} style={{ color: '#ff9800' }} />
              </div>
              <div className="card-body py-3">
                <h3 className="mb-0 fw-bold" style={{ color: '#ff9800' }}>
                  {calcularNovosEsteMes()}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Card de filtros avançados */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="row g-3 align-items-center">
              <div className="col-md-3">
                <InputGroup>
                  <FormControl placeholder="Pesquisar..." value={search} onChange={handleSearch} />
                </InputGroup>
              </div>
              <div className="col-md-3">
                <Form.Select value={activeTab} onChange={e => { setActiveTab(e.target.value as any); setCurrentPage(1); }}>
                  <option value="todos">Todos os tipos</option>
                  <option value="professores">Professores</option>
                  <option value="alunos">Alunos</option>
                  <option value="responsaveis">Responsáveis</option>
                  <option value="administradores">Administradores</option>
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Form.Select /* Status */>
                  <option value="">Todos os status</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Form.Select value={turmaFiltro} onChange={e => setTurmaFiltro(e.target.value)}>
                  <option value="">Todas as turmas</option>
                  {turmas.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </Form.Select>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <Spinner animation="border" />
          </div>
        ) : (
          <>
            {/* Versão Desktop */}
            <div className="usuarios-list-desktop d-none d-md-block">
              <Card className="mb-1">
                <Card.Body>
                  <div className="usuarios-table-desktop w-100">
                    <Table responsive hover className="w-100 text-center">
                      <thead className="thead-sticky">
                        <tr>
                          <th className='text-muted text-center'>Nome</th>
                          <th className='text-muted text-center'>E-mail</th>
                          <th className='text-muted text-center'>Status</th>
                          {activeTab === 'todos' ? (
                            <>
                              <th className='text-muted text-center'>Tipo</th>
                              <th className='text-muted text-center'>Info</th>
                            </>
                          ) : (
                            <th className='text-muted text-center'>{activeTab === 'professores' ? 'Turmas' : activeTab === 'alunos' ? 'Turma' : activeTab === 'responsaveis' ? 'Filhos' : '-'}</th>
                          )}
                          <th className='text-muted text-center'>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeTab === 'alunos' && turmaFiltro
                          ? filterList(alunos)
                            .filter(a => a.turmaId === turmaFiltro)
                            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                            .map(user => (
                              <tr key={user.id} className='align-middle linha-agenda'>
                                <td className="text-center"><strong>{user.nome}</strong></td>
                                <td className="text-center"><span className="text-secondary">{user.email}</span></td>
                                <td className="text-center">
                                  <Badge 
                                    className={`usuario-status-badge ${user.status === 'Ativo' ? 'ativo' : 'inativo'}`}
                                    style={{
                                      backgroundColor: user.status === 'Ativo' ? '#22c55e' : '#6c757d',
                                      color: '#fff',
                                      fontWeight: 700,
                                      border: 'none',
                                      borderRadius: '12px',
                                      padding: '0.22rem 0.5rem',
                                      fontSize: '0.71rem',
                                      letterSpacing: '0.1px',
                                      lineHeight: 1.1,
                                      display: 'inline-block'
                                    }}
                                  >
                                    {user.status || 'Ativo'}
                                  </Badge>
                                </td>
                                <td className="text-center">{turmas.find(t => t.id === user.turmaId)?.nome}</td>
                                <td className="text-center">
                                  <Dropdown align="end">
                                    <Dropdown.Toggle
                                      variant="light"
                                      size="sm"
                                      className="dropdown-toggle-no-caret"
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        boxShadow: 'none'
                                      }}
                                    >
                                      <i className="bi bi-three-dots-vertical"></i>
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu>
                                      <Dropdown.Item onClick={() => openEdit(user)} className="d-flex align-items-center gap-2 text-primary">
                                        <i className="bi bi-pencil"></i> Editar
                                      </Dropdown.Item>
                                      <Dropdown.Item onClick={() => handleExcluir(user.id)} className="d-flex align-items-center gap-2 text-danger">
                                        <i className="bi bi-trash"></i> Excluir
                                      </Dropdown.Item>
                                    </Dropdown.Menu>
                                  </Dropdown>
                                </td>
                              </tr>
                            ))
                          : renderRows().length > 0 ? renderRows().map(row => {
                            // Adiciona text-center a todas as células das linhas renderizadas
                            if (row && row.props && row.props.children) {
                              const newChildren = row.props.children.map((cell: any) =>
                                cell && cell.type === 'td'
                                  ? { ...cell, props: { ...cell.props, className: (cell.props.className || '') + ' text-center' } }
                                  : cell
                              );
                              return { ...row, props: { ...row.props, children: newChildren } };
                            }
                            return row;
                          }) : (
                            <tr>
                              <td colSpan={activeTab === 'todos' ? 6 : 5} className="text-center py-4">
                                <div className="agenda-empty-state">
                                  <div className="empty-icon">👥</div>
                                  <h5>Nenhum usuário encontrado</h5>
                                  <p className="text-muted">Tente ajustar os filtros ou adicione um novo usuário.</p>
                                </div>
                              </td>
                            </tr>
                          )}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </div>

            {/* Versão Mobile */}
            <div className="usuarios-mobile-cards d-block d-md-none">
              <div className="usuarios-header-mobile mb-3">
                <h3 className="mb-0">Lista de Usuários</h3>
              </div>

              {getCurrentUsersList().length > 0 ? (
                <div className="usuarios-grid-mobile">
                  {getCurrentUsersList().map(user => (
                    <div key={user.id} className="usuarios-card-mobile">
                      <div className="usuarios-card-header">
                        <div className="usuarios-card-info">
                          <div className="usuarios-card-name">{user.nome}</div>
                          <div className="usuarios-card-email">{user.email}</div>
                          {activeTab === 'todos' && (
                            <div className="usuarios-card-type">
                              <span className="badge bg-light text-dark me-2">
                                {user.tipoUsuario === 'professores' ? 'Professor' :
                                  user.tipoUsuario === 'alunos' ? 'Aluno' :
                                    user.tipoUsuario === 'responsaveis' ? 'Responsável' : 'Administrador'}
                              </span>
                            </div>
                          )}
                        </div>
                        <Badge 
                          className={`usuario-status-badge ${user.status === 'Ativo' ? 'ativo' : 'inativo'} align-self-start`}
                          style={{
                            backgroundColor: user.status === 'Ativo' ? '#22c55e' : '#6c757d',
                            color: '#fff',
                            fontWeight: 700,
                            border: 'none',
                            borderRadius: '12px',
                            padding: '0.22rem 0.5rem',
                            fontSize: '0.71rem',
                            letterSpacing: '0.1px',
                            lineHeight: 1.1,
                            display: 'inline-block'
                          }}
                        >
                          {user.status || 'Ativo'}
                        </Badge>
                      </div>

                      <div className="usuarios-card-body">
                        <div className="usuarios-info-details">
                          {activeTab === 'todos' ? (
                            <>
                              {user.tipoUsuario === 'professores' && (user as Professor).turmas.map(id => turmas.find(t => t.id === id)?.nome || id).join(', ')}
                              {user.tipoUsuario === 'alunos' && turmas.find(t => t.id === (user as Aluno).turmaId)?.nome}
                              {user.tipoUsuario === 'responsaveis' && (user as Responsavel).filhos?.map(filhoId => alunos.find(a => a.id === filhoId)?.nome).join(', ')}
                            </>
                          ) : (
                            <>
                              {activeTab === 'professores' && (user as Professor).turmas.map(id => turmas.find(t => t.id === id)?.nome || id).join(', ')}
                              {activeTab === 'alunos' && turmas.find(t => t.id === (user as Aluno).turmaId)?.nome}
                              {activeTab === 'responsaveis' && (user as Responsavel).filhos?.map(filhoId => alunos.find(a => a.id === filhoId)?.nome).join(', ')}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="usuarios-card-actions">
                        <button
                          className="usuarios-action-btn usuarios-edit-btn"
                          onClick={() => openEdit(user)}
                        >
                          <i className="bi bi-pencil"></i>
                          Editar
                        </button>
                        <button
                          className="usuarios-action-btn usuarios-delete-btn"
                          onClick={() => handleExcluir(user.id)}
                        >
                          <i className="bi bi-trash"></i>
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="usuarios-empty-state">
                  <div className="usuarios-empty-icon">
                    <Person size={48} />
                  </div>
                  <h5 className="usuarios-empty-title">Nenhum usuário encontrado</h5>
                  <p className="usuarios-empty-text">
                    {search || activeTab !== 'todos'
                      ? 'Tente ajustar os filtros de busca.'
                      : 'Comece adicionando seu primeiro usuário.'
                    }
                  </p>
                </div>
              )}
            </div>

            <Paginacao
              paginaAtual={currentPage}
              totalPaginas={Math.ceil(
                (activeTab === 'todos'
                  ? [
                    ...professores.map(p => ({ ...p, tipoUsuario: 'professores' })),
                    ...alunos.map(a => ({ ...a, tipoUsuario: 'alunos' })),
                    ...responsaveis.map(r => ({ ...r, tipoUsuario: 'responsaveis' })),
                    ...administradores.map(adm => ({ ...adm, tipoUsuario: 'administradores' }))
                  ].filter(u => {
                    const searchLower = search.toLowerCase();
                    const nameMatch = u.nome.toLowerCase().includes(searchLower);
                    const emailMatch = u.email.toLowerCase().includes(searchLower);
                    
                    // Buscar também na coluna info
                    let infoMatch = false;
                    
                    if (u.tipoUsuario === 'responsaveis') {
                      const responsavel = u as any;
                      if (responsavel.filhos && responsavel.filhos.length > 0) {
                        infoMatch = responsavel.filhos.some((filhoId: string) => {
                          const aluno = alunos.find(a => a.id === filhoId);
                          return aluno && aluno.nome.toLowerCase().includes(searchLower);
                        });
                      }
                    } else if (u.tipoUsuario === 'alunos' && (u as any).turmaId) {
                      const turma = turmas.find(t => t.id === (u as any).turmaId);
                      infoMatch = !!(turma && turma.nome.toLowerCase().includes(searchLower));
                    } else if (u.tipoUsuario === 'professores') {
                      const professor = u as any;
                      if (professor.turmas && professor.turmas.length > 0) {
                        infoMatch = professor.turmas.some((turmaId: string) => {
                          const turma = turmas.find(t => t.id === turmaId);
                          return turma && turma.nome.toLowerCase().includes(searchLower);
                        });
                      }
                    }
                    
                    return nameMatch || emailMatch || infoMatch;
                  })
                  : activeTab === 'alunos' && turmaFiltro
                    ? filterList(alunos).filter(a => a.turmaId === turmaFiltro)
                    : filterList(
                      activeTab === 'professores'
                        ? professores
                        : activeTab === 'alunos'
                          ? alunos
                          : activeTab === 'responsaveis'
                            ? responsaveis
                            : administradores
                    )
                ).length / itemsPerPage
              )}
              aoMudarPagina={setCurrentPage}
            />
          </>
        )}

        <Modal show={showForm} onHide={() => setShowForm(false)} size="lg" centered>
          <Modal.Header closeButton>
            <Modal.Title>{formMode === 'add' ? 'Adicionar Usuário' : 'Editar Usuário'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <UsuarioForm
              turmas={turmas}
              alunosExistentes={alunosOptions}
              defaultValues={formDefaults}
              formMode={formMode}
              onSubmit={handleSubmit}
              onCancel={() => setShowForm(false)}
            />
          </Modal.Body>
        </Modal>

        <ToastContainer position="bottom-end" className="p-3">
          <Toast bg={toast.variant} show={toast.show} onClose={() => setToast({ ...toast, show: false })} delay={3000} autohide>
            <Toast.Body className="text-white">{toast.message}</Toast.Body>
          </Toast>
        </ToastContainer>
      </Container>
    </AppLayout>
  );
}







