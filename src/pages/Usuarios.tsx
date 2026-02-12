// src/pages/Usuarios.tsx - Atualizado com suporte ao modoAcesso "responsavel"
import { useEffect, useState, ChangeEvent, JSX, useMemo } from 'react';
import AppLayout from '../components/layout/AppLayout';
import {
  Container, Row, Button, Table, Badge, Spinner,
  Modal, InputGroup, FormControl, Toast, ToastContainer, Dropdown, Form, Card,
  Col
} from 'react-bootstrap';
import { PlusCircle, Person } from 'react-bootstrap-icons';
import Paginacao from '../components/common/Paginacao';
// Firestore é acessado apenas através dos serviços/repositórios
import UsuarioForm, { FormValues, AlunoOption } from '../components/usuarios/UsuarioForm';
import { GraduationCap, Download, Users } from 'lucide-react';
import { useAnoLetivoAtual } from '../hooks/useAnoLetivoAtual';

// Models
import { Responsavel } from '../models/Responsavel';
import { Administrador } from '../models/Administrador';
import { Turma as TurmaModel } from '../models/Turma';

// Services
import { ProfessorService } from '../services/data/ProfessorService';
import { AlunoService } from '../services/usuario/AlunoService';
import { ResponsavelService } from '../services/usuario/ResponsavelService';
import { AdministradorService } from '../services/usuario/AdministradorService';
import { UserService, UsuariosService, type AbaUsuarios, type ContextoUsuarios, type FiltrosUsuarios } from '../services/usuario/UserService';
import { turmaService } from '../services/data/TurmaService';
import { isTurmaVirtualizada } from '../utils/turmasHelpers';
import { ProfessorMateriaService } from '../services/data/ProfessorMateriaService';

// PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// XLSX
import * as XLSX from 'xlsx';

interface UsuarioBase { id: string; nome: string; email: string; status: string; dataCriacao?: any; }
interface Professor extends UsuarioBase { turmas: string[]; polivalente?: boolean; }
interface Aluno extends UsuarioBase { turmaId?: string; responsavelId?: string; modoAcesso?: string; }

export default function Usuarios(): JSX.Element {
  const { anoLetivo } = useAnoLetivoAtual();

  // Instanciar services
  const professorService = useMemo(() => new ProfessorService(), []);
  const professorMateriaService = useMemo(() => new ProfessorMateriaService(), []);
  const alunoService = useMemo(() => new AlunoService(), []);
  const responsavelService = useMemo(() => new ResponsavelService(), []);
  const administradorService = useMemo(() => new AdministradorService(), []);
  const userService = useMemo(() => new UserService(), []);
  const [activeTab, setActiveTab] = useState<AbaUsuarios>('todos');
  const [search, setSearch] = useState('');
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [administradores, setAdministradores] = useState<Administrador[]>([]);
  const [turmas, setTurmas] = useState<TurmaModel[]>([]);
  const [alunosOptions, setAlunosOptions] = useState<AlunoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [turmaFiltro, setTurmaFiltro] = useState<string>('');
  const [statusFiltro, setStatusFiltro] = useState<string>('');
  const itemsPerPage = 10;
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [formDefaults, setFormDefaults] = useState<Partial<FormValues>>({});
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'danger' }>({
    show: false, message: '', variant: 'success'
  });
  const [expandedTurmas, setExpandedTurmas] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [turmasProximasCache, setTurmasProximasCache] = useState<TurmaModel[]>([]);
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
  const [statusChangeData, setStatusChangeData] = useState<{
    tipo: 'aluno' | 'responsavel';
    userId: string;
    novoStatus: string;
    relacionados: Array<{ id: string; nome: string; tipo: string }>;
    formData: FormValues;
  } | null>(null);

  // Função para obter turmas (já incluem virtualizadas vindas do service)
  const getTurmasProximas = (): TurmaModel[] => {
    return turmas.filter(t => t.turmaOriginalId);
  };

  // Função para materializar turma virtual
  const materializarTurmaVirtual = async (turmaIdOuObjeto: string | TurmaModel): Promise<string> => {
    const turmasCache = [...turmas, ...turmasProximasCache];
    return await turmaService.materializarTurmaVirtualComDados(turmaIdOuObjeto, turmasCache);
  };

  // Funções de exportação
  // Retorna a lista filtrada completa, sem paginação
  const getFilteredUsersList = () => {
    const contexto: ContextoUsuarios = {
      professores,
      alunos,
      responsaveis,
      administradores,
      turmas,
    };

    const filtros: FiltrosUsuarios = {
      activeTab,
      search,
      statusFiltro,
      turmaFiltro,
    };

    return UsuariosService.obterListaFiltradaCompleta(contexto, filtros);
  };

  const downloadPDF = () => {
    const tipoFiltro = activeTab === 'todos' ? 'Todos os Usuários' :
      activeTab === 'professores' ? 'Professores' :
        activeTab === 'alunos' ? 'Alunos' :
          activeTab === 'responsaveis' ? 'Responsáveis' : 'Administradores';

    const doc = new jsPDF();
    doc.text(`Relatório de Usuários - ${tipoFiltro}`, 14, 15);

    const contexto: ContextoUsuarios = {
      professores,
      alunos,
      responsaveis,
      administradores,
      turmas,
    };

    const todosUsuarios = getFilteredUsersList();
    const { headers, body } = UsuariosService.montarDadosTabelaExportacao(
      todosUsuarios,
      contexto,
      activeTab,
    );

    autoTable(doc, {
      startY: 25,
      head: headers,
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: activeTab === 'todos' ? {
        0: { cellWidth: 35 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 70 }
      } : {
        0: { cellWidth: 40 },
        1: { cellWidth: 50 },
        2: { cellWidth: 25 },
        3: { cellWidth: 75 }
      }
    });

    doc.save(`usuarios-${tipoFiltro.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const downloadExcel = () => {
    const tipoFiltro = activeTab === 'todos' ? 'Todos os Usuários' :
      activeTab === 'professores' ? 'Professores' :
        activeTab === 'alunos' ? 'Alunos' :
          activeTab === 'responsaveis' ? 'Responsáveis' : 'Administradores';

    const contexto: ContextoUsuarios = {
      professores,
      alunos,
      responsaveis,
      administradores,
      turmas,
    };

    const todosUsuarios = getFilteredUsersList();
    const dadosParaExcel = UsuariosService.montarDadosExcel(
      todosUsuarios,
      contexto,
      activeTab,
    );

    // Cria a planilha
    const worksheet = XLSX.utils.json_to_sheet(dadosParaExcel);

    // Define a largura das colunas
    worksheet['!cols'] = activeTab === 'todos' ? [
      { wch: 25 }, // Nome
      { wch: 30 }, // E-mail
      { wch: 15 }, // Status
      { wch: 20 }, // Tipo
      { wch: 40 }  // Info
    ] : [
      { wch: 25 }, // Nome
      { wch: 30 }, // E-mail
      { wch: 15 }, // Status
      { wch: 40 }  // Info
    ];

    // Cria o workbook e adiciona a aba
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Usuários - ${tipoFiltro}`);

    // Salva o arquivo
    XLSX.writeFile(workbook, `usuarios-${tipoFiltro.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExport = (tipo: 'pdf' | 'excel') => {
    setShowExportModal(false);
    if (tipo === 'pdf') {
      downloadPDF();
    } else {
      downloadExcel();
    }
  };
  // Função para migrar usuários existentes sem dataCriacao
  const migrarUsuariosExistentes = async () => {
    // Data padrão para usuários existentes (1 mês atrás para não influenciar estatísticas atuais)
    const dataDefault = new Date();
    dataDefault.setMonth(dataDefault.getMonth() - 1);

    try {
      // Professores
      await Promise.all(
        professores
          .filter(p => !p.dataCriacao)
          .map(p => professorService.atualizar(p.id, { dataCriacao: dataDefault }))
      );

      // Alunos
      await Promise.all(
        alunos
          .filter(a => !a.dataCriacao)
          .map(a => alunoService.atualizar(a.id, { dataCriacao: dataDefault }))
      );

      // Responsáveis
      await Promise.all(
        responsaveis
          .filter(r => !r.dataCriacao)
          .map(r => responsavelService.atualizar(r.id, { dataCriacao: dataDefault } as any))
      );

      // Administradores
      await Promise.all(
        administradores
          .filter(a => !a.dataCriacao)
          .map(a => administradorService.atualizar(a.id, { dataCriacao: dataDefault } as any))
      );

      // Recarregar dados após migração
      window.location.reload();
    } catch (error) {
    }
  };

  const getCurrentUsersList = () => {
    const contexto: ContextoUsuarios = {
      professores,
      alunos,
      responsaveis,
      administradores,
      turmas,
    };

    const filtros: FiltrosUsuarios = {
      activeTab,
      search,
      statusFiltro,
      turmaFiltro,
    };

    return UsuariosService.obterListaPaginada(
      contexto,
      filtros,
      currentPage,
      itemsPerPage,
    );
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Buscar dados usando services
      const [professoresList, alunosList, responsaveisList, administradoresList, todasTurmasList] = await Promise.all([
        professorService.listar(),
        alunoService.listar(),
        responsavelService.listar(),
        administradorService.listar(),
        turmaService.listarTodas(),
      ]);

      setProfessores(professoresList);
      setAlunos(alunosList);
      setResponsaveis(responsaveisList);
      setAdministradores(administradoresList);

      // Usar o método listarComVirtualizacao que já cria as turmas virtualizadas
      const turmasComVirtualizadas = await turmaService.listarComVirtualizacao(anoLetivo.toString());

      // Deduplicate turmas by ID (keep first occurrence)
      const turmasUnicas = turmasComVirtualizadas.filter((turma, index, self) =>
        self.findIndex(t => t.id === turma.id) === index
      );

      setTurmas(turmasUnicas);

      // Não precisa mais do código de virtualização manual
      setTurmasProximasCache([]);

      setLoading(false);
      setAlunosOptions(
        alunosList
          .map(a => {
            const turma = todasTurmasList.find(t => t.id === a.turmaId);
            return {
              id: a.id,
              nome: `${a.nome}${turma ? ` - ${turma.nome}` : ''}`,
            };
          })
          .sort((a, b) => a.nome.localeCompare(b.nome))
      );

      // Verificar se há usuários sem dataCriacao e executar migração se necessário
      const todosUsuarios = [...professoresList, ...alunosList, ...responsaveisList, ...administradoresList];
      const usuariosSemData = todosUsuarios.filter(u => !u.dataCriacao);

      if (usuariosSemData.length > 0) {
        await migrarUsuariosExistentes();
      }
    }
    fetchData();
  }, [anoLetivo, professorService, alunoService, responsavelService, administradorService]);

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
    // Verificar se turmasIds existe e é um array válido
    if (!turmasIds || !Array.isArray(turmasIds) || turmasIds.length === 0) {
      return null;
    }

    // Filtrar apenas turmas do ano letivo atual
    const turmasDoAnoAtual = turmasIds.filter(id => turmas.some(t => t.id === id));
    const isExpanded = expandedTurmas.has(userId);
    const turmasToShow = isExpanded ? turmasDoAnoAtual : turmasDoAnoAtual.slice(0, maxVisible);
    const remainingCount = turmasDoAnoAtual.length - maxVisible;

    return (
      <>
        {turmasToShow.map(id => {
          const turmaNome = turmas.find(t => t.id === id)?.nome;
          if (!turmaNome) return null; // Não renderizar se a turma não for do ano atual
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

  const filterList = <T extends UsuarioBase>(list: T[]) => {
    let filtered = list.filter(u => {
      const searchLower = search.toLowerCase();
      const nameMatch = u.nome.toLowerCase().includes(searchLower);
      const emailMatch = u.email.toLowerCase().includes(searchLower);

      // Buscar também na coluna info (nome do aluno para responsáveis)
      let infoMatch = false;
      if (u.id && responsaveis.find(r => r.id === u.id)) {
        // Para responsáveis, buscar pelo nome dos filhos (alunos)
        const responsavel = u as unknown as Responsavel;
        if (responsavel.filhos && responsavel.filhos.length > 0) {
          infoMatch = responsavel.filhos.some(filhoId => {
            const aluno = alunos.find(a => a.id === filhoId);
            return aluno && aluno.nome.toLowerCase().includes(searchLower);
          });
        }
      }

      return nameMatch || emailMatch || infoMatch;
    });

    // Filtro por status
    if (statusFiltro) {
      filtered = filtered.filter(u => (u.status || 'Ativo') === statusFiltro);
    }

    // Filtro por turma (removida a condição de administrador)
    if (turmaFiltro) {
      if (activeTab === 'alunos') {
        filtered = filtered.filter(a => (a as Aluno).turmaId === turmaFiltro);
      } else if (activeTab === 'professores') {
        // Filtrar professores que lecionam na turma selecionada
        filtered = filtered.filter(p => {
          const professor = p as unknown as Professor;
          return professor.turmas && professor.turmas.includes(turmaFiltro);
        });
      } else if (activeTab === 'todos') {
        // Para a aba "todos", aplicar filtro só para alunos e professores
        filtered = filtered.filter(u => {
          // Verificar se é aluno pela presença na lista de alunos
          const isAluno = alunos.find(a => a.id === u.id);
          if (isAluno) {
            return (u as Aluno).turmaId === turmaFiltro;
          }

          // Verificar se é professor pela presença na lista de professores
          const isProfessor = professores.find(p => p.id === u.id);
          if (isProfessor) {
            const professor = u as unknown as Professor;
            return professor.turmas && professor.turmas.includes(turmaFiltro);
          }

          // Para responsáveis e administradores, não mostrar quando há filtro de turma
          return false;
        });
      }
    }

    return filtered.sort((a, b) => a.nome.localeCompare(b.nome));
  };

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Excluir este usuário?')) return;

    try {
      let collectionName = activeTab;
      if (activeTab === 'todos') {
        // Determinar o tipo do usuário pela sua presença nas diferentes coleções
        if (professores.find(p => p.id === id)) collectionName = 'professores';
        else if (alunos.find(a => a.id === id)) collectionName = 'alunos';
        else if (responsaveis.find(r => r.id === id)) collectionName = 'responsaveis';
        else if (administradores.find(adm => adm.id === id)) collectionName = 'administradores';
      }

      // Chamar service para excluir completamente (coleção específica + users + auth)
      await userService.excluirUsuario(id, collectionName);

      // Atualizar estado local
      if (collectionName === 'professores') setProfessores(prev => prev.filter(u => u.id !== id));
      if (collectionName === 'alunos') setAlunos(prev => prev.filter(u => u.id !== id));
      if (collectionName === 'responsaveis') setResponsaveis(prev => prev.filter(u => u.id !== id));
      if (collectionName === 'administradores') setAdministradores(prev => prev.filter(u => u.id !== id));

      setToast({ show: true, message: 'Usuário excluído com sucesso!', variant: 'success' });
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      setToast({
        show: true,
        message: `Erro ao excluir usuário: ${error.message}`,
        variant: 'danger'
      });
    }
  };

  const openEdit = async (user: UsuarioBase & any) => {
    const tipoUsuario = activeTab === 'todos' ? user.tipoUsuario : activeTab;

    let materiasVinculadas: string[] = [];
    if (tipoUsuario === 'professores') {
      // Buscar matérias vinculadas ao professor
      materiasVinculadas = await professorMateriaService.listarMateriasPorProfessor(user.id);
    }

    const defaults: Partial<FormValues> = {
      tipoUsuario,
      nome: user.nome,
      email: user.email,
      ...(tipoUsuario === 'alunos' && {
        turmaId: user.turmaId,
        modoAcesso: user.modoAcesso || 'aluno'
      }),
      ...(tipoUsuario === 'professores' && { turmas: user.turmas, materias: materiasVinculadas, polivalente: user.polivalente ?? false }),
      ...(tipoUsuario === 'responsaveis' && { filhos: user.filhos }),
      ...(user.id && { id: user.id }),
    };

    (defaults as any).status = user.status || 'Ativo';

    setFormDefaults(defaults);
    setFormMode('edit');
    setShowForm(true);
  };

  const handleSubmit = async (data: FormValues) => {
    try {
      // Validação especial para alunos com modoAcesso = "responsavel"
      if (data.tipoUsuario === 'alunos' && data.modoAcesso === 'responsavel') {
        // Normalizar email para minúsculas
        const emailNormalizado = data.email.toLowerCase().trim();
        // Buscar o responsável deste aluno
        const alunoId = formMode === 'edit' ? (formDefaults as any).id : null;
        const emailAlunoAtual = formMode === 'edit' ? ((formDefaults as any).email || '').toLowerCase().trim() : null;
        const responsavel = responsaveis.find(r =>
          r.filhos && alunoId && r.filhos.includes(alunoId)
        );

        // Buscar usuário na coleção users por e-mail (case-insensitive)
        const usuarioComEmail = await userService.buscarPorEmailCaseInsensitive(emailNormalizado);
        if (usuarioComEmail) {
          // Email já está em uso
          // Permitir se for:
          // 1. O próprio aluno (quando está editando)
          // 2. O responsável do aluno
          // 3. O email é igual ao do aluno editado (mantendo o mesmo email)
          const isProprioAluno = alunoId && usuarioComEmail.id === alunoId;
          const isResponsavel = responsavel && usuarioComEmail.id === responsavel.id;
          const isMesmoEmailAluno = emailAlunoAtual && emailNormalizado === emailAlunoAtual;
          if (!isProprioAluno && !isResponsavel && !isMesmoEmailAluno) {
            setToast({
              show: true,
              message: 'Este e-mail já está em uso por outro usuário. Alunos com acesso via responsável só podem usar o e-mail do seu responsável, manter o próprio ou um e-mail ainda não cadastrado.',
              variant: 'danger'
            });
            return;
          }
        }
      }

      // Verificar mudança de status para Inativo
      if (formMode === 'edit' && (data as any).status === 'Inativo') {
        const usuarioAtual = formDefaults as any;
        const statusAnterior = usuarioAtual.status || 'Ativo';

        // Se está mudando de Ativo para Inativo
        if (statusAnterior === 'Ativo') {
          // Verificar se é aluno
          if (data.tipoUsuario === 'alunos') {
            const alunoAtual = alunos.find(a => a.id === usuarioAtual.id);
            if (alunoAtual) {
              // Buscar responsável do aluno
              const responsavel = responsaveis.find(r => r.filhos && r.filhos.includes(alunoAtual.id));

              if (responsavel) {
                const outrosFilhos = responsavel.filhos!.filter(fid => fid !== alunoAtual.id);
                const relacionados = outrosFilhos.map(fid => {
                  const filho = alunos.find(a => a.id === fid);
                  return { id: fid, nome: filho?.nome || 'Desconhecido', tipo: 'aluno' };
                });
                relacionados.unshift({ id: responsavel.id, nome: responsavel.nome, tipo: 'responsavel' });

                if (relacionados.length > 0) {
                  setStatusChangeData({
                    tipo: 'aluno',
                    userId: usuarioAtual.id,
                    novoStatus: 'Inativo',
                    relacionados,
                    formData: data
                  });
                  setShowStatusConfirmModal(true);
                  return; // Aguardar confirmação
                }
              }
            }
          }

          // Verificar se é responsável
          if (data.tipoUsuario === 'responsaveis') {
            const responsavelAtual = responsaveis.find(r => r.id === usuarioAtual.id);
            if (responsavelAtual && responsavelAtual.filhos && responsavelAtual.filhos.length > 0) {
              const relacionados = responsavelAtual.filhos.map(fid => {
                const filho = alunos.find(a => a.id === fid);
                return { id: fid, nome: filho?.nome || 'Desconhecido', tipo: 'aluno' };
              });

              if (relacionados.length > 0) {
                setStatusChangeData({
                  tipo: 'responsavel',
                  userId: usuarioAtual.id,
                  novoStatus: 'Inativo',
                  relacionados,
                  formData: data
                });
                setShowStatusConfirmModal(true);
                return; // Aguardar confirmação
              }
            }
          }
        }
      }

      // Continuar com o salvamento normal
      await salvarUsuario(data, false);
    } catch (error: any) {
      console.error(error);
      setToast({ show: true, message: error.message || 'Erro ao salvar usuário.', variant: 'danger' });
    }
  };

  const salvarUsuario = async (data: FormValues, atualizarRelacionados: boolean) => {
    try {
      // Materializar turma virtual se necessário (para alunos)
      let turmaIdFinal = data.turmaId;
      if (data.tipoUsuario === 'alunos' && data.turmaId) {
        const turmaObj = [...turmas, ...getTurmasProximas()].find(t => t.id === data.turmaId);
        if (turmaObj && isTurmaVirtualizada(turmaObj)) {
          turmaIdFinal = await materializarTurmaVirtual(turmaObj);
        }
      }

      // Materializar turmas virtuais se necessário (para professores)
      let turmasFinal = data.turmas;
      if (data.tipoUsuario === 'professores' && data.turmas && data.turmas.length > 0) {
        const turmasParaMaterializar = data.turmas.map(turmaId => {
          const turmaObj = turmas.find(t => t.id === turmaId);
          return { turmaId, turmaObj };
        });

        turmasFinal = await Promise.all(
          turmasParaMaterializar.map(async ({ turmaId, turmaObj }) => {
            if (turmaObj && isTurmaVirtualizada(turmaObj)) {
              return await materializarTurmaVirtual(turmaObj);
            }
            return turmaId;
          })
        );
      }

      // Para professores em modo de edição, mesclar turmas do ano atual com turmas de outros anos
      if (formMode === 'edit' && data.tipoUsuario === 'professores') {
        const turmasAtuaisDoUsuario = (formDefaults as any).turmas || [];

        // Filtrar turmas que não estão na lista de turmas do ano atual (são de outros anos)
        const turmasIdDoAnoAtual = turmas.map((t: TurmaModel) => t.id);
        const turmasDeOutrosAnos = turmasAtuaisDoUsuario.filter((turmaId: string) =>
          !turmasIdDoAnoAtual.includes(turmaId)
        );

        // Combinar turmas de outros anos com as turmas do ano atual
        turmasFinal = [...turmasDeOutrosAnos, ...turmasFinal];
      }

      // Normalizar email para lowercase antes de salvar
      const emailNormalizado = data.email.toLowerCase().trim();

      console.log('Salvando usuário com dados:', data);
      const userDataBase = {
        nome: data.nome,
        status: (data as any).status || 'Ativo',
        ...(data.tipoUsuario === 'alunos' && {
          turmaId: turmaIdFinal,
          modoAcesso: data.modoAcesso || 'aluno'
        }),
        ...(data.tipoUsuario === 'professores' && { turmas: turmasFinal, polivalente: !!data.polivalente }),
        ...(data.tipoUsuario === 'responsaveis' && { filhos: data.filhos }),
        ...(formMode === 'add' && { dataCriacao: new Date() }),
      };
      if (formMode === 'edit') {
        // Detectar alteração de e-mail
        const emailAtual = (formDefaults as any).email?.toLowerCase().trim() || '';
        const emailNovo = data.email.toLowerCase().trim();
        let emailAlterado = emailAtual !== emailNovo;

        // Se mudou de 'responsavel' para 'aluno', criar conta de autenticação
        if (data.tipoUsuario === 'alunos' && (data as any).mudouParaAcessoAluno) {
          try {
            await userService.criarApenasAuth({
              uid: (formDefaults as any).id,
              nome: data.nome,
              email: emailNormalizado,
              tipoUsuario: 'alunos',
            });

            // Atualizar o modoAcesso e email na coleção específica (apenas se backend confirmou)
            await alunoService.atualizar((formDefaults as any).id, {
              ...userDataBase,
              modoAcesso: 'aluno',
              email: emailNormalizado
            } as any);

            setToast({
              show: true,
              message: 'Aluno atualizado e conta de acesso criada com sucesso!',
              variant: 'success'
            });
          } catch (error: any) {
            console.error('Erro ao criar conta de autenticação:', error);
            setToast({
              show: true,
              message: `Erro ao criar conta: ${error.message}`,
              variant: 'danger'
            });
            return; // Não prosseguir se houver erro
          }
        }
        // Se mudou de 'aluno' para 'responsavel', remover conta de autenticação
        else if (data.tipoUsuario === 'alunos' && (data as any).mudouParaAcessoResponsavel) {
          try {
            await userService.removerAuth((formDefaults as any).id);

            // Atualizar o modoAcesso na coleção específica
            await alunoService.atualizar((formDefaults as any).id, {
              ...userDataBase,
              modoAcesso: 'responsavel',
            } as any);

            setToast({
              show: true,
              message: 'Aluno atualizado. Acesso agora será feito pelo responsável.',
              variant: 'success'
            });
          } catch (error: any) {
            console.error('Erro ao remover conta de autenticação:', error);
            setToast({
              show: true,
              message: `Erro ao remover conta: ${error.message}`,
              variant: 'danger'
            });
            return; // Não prosseguir se houver erro
          }
        }
        else {
          // Atualização normal sem mudança de modo de acesso
          // Se o email foi alterado, chamar API backend antes de atualizar Firestore
          if (emailAlterado) {
            try {
              await userService.atualizarEmailUsuario({
                uid: (formDefaults as any).id,
                novoEmail: emailNovo,
                tipoUsuario: data.tipoUsuario,
              });
              // Só após sucesso do backend, atualizar registro na coleção específica
              if (data.tipoUsuario === 'professores') {
                await professorService.atualizar((formDefaults as any).id, { ...userDataBase, email: emailNovo } as any);
              } else if (data.tipoUsuario === 'alunos') {
                await alunoService.atualizar((formDefaults as any).id, { ...userDataBase, email: emailNovo } as any);
              } else if (data.tipoUsuario === 'responsaveis') {
                await responsavelService.atualizar((formDefaults as any).id, { ...userDataBase, email: emailNovo } as any);
              } else if (data.tipoUsuario === 'administradores') {
                await administradorService.atualizar((formDefaults as any).id, { ...userDataBase, email: emailNovo } as any);
              }
              setToast({ show: true, message: 'Usuário atualizado com sucesso!', variant: 'success' });
            } catch (error: any) {
              setToast({ show: true, message: error.message || 'Erro ao atualizar e-mail.', variant: 'danger' });
              return;
            }
          } else {
            // Não alterou o email, update normal via services
            if (data.tipoUsuario === 'professores') {
              await professorService.atualizar((formDefaults as any).id, userDataBase as any);
            } else if (data.tipoUsuario === 'alunos') {
              await alunoService.atualizar((formDefaults as any).id, userDataBase as any);
            } else if (data.tipoUsuario === 'responsaveis') {
              await responsavelService.atualizar((formDefaults as any).id, userDataBase as any);
            } else if (data.tipoUsuario === 'administradores') {
              await administradorService.atualizar((formDefaults as any).id, userDataBase as any);
            }
            setToast({ show: true, message: 'Usuário atualizado com sucesso!', variant: 'success' });
          }
          // Atualizar status na coleção users também, apenas se existir
          await userService.atualizarStatusSeExistir(
            (formDefaults as any).id,
            userDataBase.status as 'Ativo' | 'Inativo'
          );
        }
      } else {
        const result = await userService.criarUsuario({
          nome: data.nome,
          email: emailNormalizado,
          tipoUsuario: data.tipoUsuario,
          status: (data as any).status || 'Ativo',
          turmaId: turmaIdFinal,
          filhos: data.filhos,
          turmas: turmasFinal,
          polivalente: data.tipoUsuario === 'professores' ? !!data.polivalente : undefined,
          modoAcesso: data.modoAcesso,
          dataCriacao: new Date().toISOString(),
        });

        let mensagem = "Usuário salvo com sucesso!";
        if (data.tipoUsuario === "alunos" && result.modoAcesso === "responsavel") {
          mensagem = "Aluno cadastrado sem login. O acesso será feito pelo responsável.";
        }

        setToast({ show: true, message: mensagem, variant: 'success' });
      }

      setShowForm(false);
      let novosDados: any[] = [];
      if (data.tipoUsuario === 'professores') {
        novosDados = await professorService.listar();
      } else if (data.tipoUsuario === 'alunos') {
        novosDados = await alunoService.listar();
      } else if (data.tipoUsuario === 'responsaveis') {
        novosDados = await responsavelService.listar();
      } else if (data.tipoUsuario === 'administradores') {
        novosDados = await administradorService.listar();
      }

      // Vinculação professor-turma-matéria
      if (data.tipoUsuario === 'professores' && data.turmas && data.materias && (data.turmas.length > 0) && (data.materias.length > 0)) {
        let professorId = null;
        if (formMode === 'add') {
          const novoProfessor = novosDados.find(p => p.email === emailNormalizado);
          professorId = novoProfessor?.id;
        } else {
          professorId = (formDefaults as any).id;
        }
        if (professorId) {
          // 1. Buscar todos os vínculos atuais do professor
          const vinculosAtuais = await professorMateriaService.listarPorProfessor(professorId);
          // 2. Gerar todas as combinações turma-matéria selecionadas
          const combinacoesSelecionadas = new Set(
            data.turmas.flatMap(turmaId => data.materias.map(materiaId => `${turmaId}__${materiaId}`))
          );
          // 3. Excluir vínculos que não estão mais selecionados
          for (const vinculo of vinculosAtuais) {
            const key = `${vinculo.turmaId}__${vinculo.materiaId}`;
            if (!combinacoesSelecionadas.has(key)) {
              await professorMateriaService.excluir(vinculo.id);
            }
          }
          // 4. Criar vínculos que ainda não existem
          for (const turmaId of data.turmas) {
            for (const materiaId of data.materias) {
              const jaExiste = vinculosAtuais.some(v => v.turmaId === turmaId && v.materiaId === materiaId);
              if (!jaExiste) {
                await professorMateriaService.criar({
                  professorId,
                  turmaId,
                  materiaId
                });
              }
            }
          }
          // 5. Atualizar lista de professores em tempo real
          const professoresAtualizados = await professorService.listar();
          setProfessores(professoresAtualizados);
        }
      }
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

      // Atualizar status de relacionados se solicitado
      if (atualizarRelacionados && statusChangeData) {
        // Atualizar status na coleção users APENAS para quem tiver documento lá
        await Promise.all(
          statusChangeData.relacionados.map(relacionado =>
            userService.atualizarStatusSeExistir(relacionado.id, 'Inativo')
          )
        );

        // Atualizar nas coleções específicas
        for (const relacionado of statusChangeData.relacionados) {
          if (relacionado.tipo === 'aluno') {
            await alunoService.atualizar(relacionado.id, { status: 'Inativo' } as any);
          } else {
            await responsavelService.atualizar(relacionado.id, { status: 'Inativo' } as any);
          }
        }

        // Recarregar dados após atualizar relacionados
        const [alunosAtualizados, responsaveisAtualizados] = await Promise.all([
          alunoService.listar(),
          responsavelService.listar()
        ]);

        setAlunos(alunosAtualizados as any);
        setResponsaveis(responsaveisAtualizados as any);
      }
    } catch (error: any) {
      console.error(error);
      setToast({ show: true, message: error.message || 'Erro ao salvar usuário.', variant: 'danger' });
    }
  };

  const handleConfirmStatusChange = async (atualizarRelacionados: boolean) => {
    setShowStatusConfirmModal(false);
    if (statusChangeData) {
      await salvarUsuario(statusChangeData.formData, atualizarRelacionados);
      setStatusChangeData(null);
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

    // Filtro por status
    if (statusFiltro) {
      list = list.filter(u => (u.status || 'Ativo') === statusFiltro);
    }

    // Filtro por turma
    if (turmaFiltro) {
      if (activeTab === 'alunos') {
        list = list.filter(a => (a as Aluno).turmaId === turmaFiltro);
      } else if (activeTab === 'todos') {
        list = list.filter(u => {
          if (u.tipoUsuario === 'alunos') {
            return (u as Aluno).turmaId === turmaFiltro;
          }
          // Para professores, verificar se lecionam na turma
          if (u.tipoUsuario === 'professores') {
            const professor = u as Professor;
            return professor.turmas && professor.turmas.includes(turmaFiltro);
          }
          // Para outros tipos, não mostrar quando há filtro de turma
          return false;
        });
      }
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
            {user.status === 'Ativo' ? <span style={{ fontWeight: 900, marginRight: 3 }}>✓</span> : null}
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
        <Row className='mb-3'>
          {/* Card Total de Usuários */}
          <Col md={3}>
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
          </Col>
          {/* Card Alunos Ativos */}
          <Col md={3}>
            <div className="card shadow-sm card-sm mb-1" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                <span className="fw-bold" style={{ fontSize: '1rem', color: '#3b4861' }}>Alunos</span>
                <Users size={20} style={{ color: '#f59e0b' }} />
              </div>
              <div className="card-body py-3">
                <h3 className="mb-0 fw-bold" style={{ color: '#f59e0b' }}>
                  {alunos.filter(a => (a.status || 'Ativo') === 'Ativo').length}
                </h3>
              </div>
            </div>
          </Col>
          {/* Card Total de Professores */}
          <Col md={3}>
            <div className="card shadow-sm card-sm border-left-success mb-1">
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                <span className="fw-bold" style={{ fontSize: '1rem', color: '#3b4861' }}>Professores</span>
                <GraduationCap size={20} className="text-success" />
              </div>
              <div className="card-body py-3">
                <h3 className="mb-0 fw-bold" style={{ color: '#22c55e' }}>{professores.length}</h3>
              </div>
            </div>
          </Col>
          {/* Card Turmas Ativas */}
          <Col md={3}>
            <div className="card shadow-sm card-sm mb-1" style={{ borderLeft: '4px solid #a78bfa' }}>
              <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                <span className="fw-bold" style={{ fontSize: '1rem', color: '#3b4861' }}>Turmas Ativas</span>
                <Person size={20} style={{ color: '#a78bfa' }} />
              </div>
              <div className="card-body py-3">
                <h3 className="mb-0 fw-bold" style={{ color: '#a78bfa' }}>{turmas.length}</h3>
              </div>
            </div>
          </Col>
        </Row>
        {/* Card de filtros avançados */}
        <div className="card mb-3">
          <div className="card-body">
            <Row>
              <Col md={3} className='mb-1'>
                <InputGroup>
                  <FormControl placeholder="Pesquisar..." value={search} onChange={handleSearch} />
                </InputGroup>
              </Col>
              <Col md={3} className='mb-1'>
                <Form.Select value={activeTab} onChange={e => { setActiveTab(e.target.value as any); setCurrentPage(1); }}>
                  <option value="todos">Todos os tipos</option>
                  <option value="professores">Professores</option>
                  <option value="alunos">Alunos</option>
                  <option value="responsaveis">Responsáveis</option>
                  <option value="administradores">Administradores</option>
                </Form.Select>
              </Col>
              <Col md={3} className='mb-1'>
                <Form.Select value={statusFiltro} onChange={e => { setStatusFiltro(e.target.value); setCurrentPage(1); }}>
                  <option value="">Todos os status</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </Form.Select>
              </Col>
              <Col md={3} className='mb-1'>
                <Form.Select value={turmaFiltro} onChange={e => { setTurmaFiltro(e.target.value); setCurrentPage(1); }}>
                  <option value="">Todas as turmas</option>
                  {turmas
                    .slice()
                    .sort((a, b) => a.nome.localeCompare(b.nome))
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                </Form.Select>
              </Col>
            </Row>
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
                  <div className="d-flex align-items-center justify-content-between px-2 mb-2">
                    <h3 className="mb-0">
                      Lista de Usuários
                      <span className="text-muted" style={{ fontSize: '1rem', marginLeft: 8, verticalAlign: 'middle' }}>({getFilteredUsersList().length})</span>
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => setShowExportModal(true)}
                      className="d-flex align-items-center justify-content-center gap-2"
                    >
                      <Download size={18} className='me-1' />
                      Exportar
                    </Button>
                  </div>
                  <div className="usuarios-table-desktop w-100">
                    <Table hover className="w-100 text-center">
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
              <Card className="shadow-sm">
                <Card.Body>
                  <div className="usuarios-header-mobile mb-3">
                    <h3 className="mb-0">Lista de Usuários</h3>
                  </div>

                  {getCurrentUsersList().length > 0 ? (
                    <div className="usuarios-grid-mobile">
                      {getCurrentUsersList().map(user => {
                        // Determinar tipo de usuário e cor do badge
                        const getTipoBadge = () => {
                          if (activeTab === 'todos') {
                            const tipos = {
                              professores: { label: 'Professor', bg: '#22c55e', icon: '👨‍🏫' },
                              alunos: { label: 'Aluno', bg: '#3b82f6', icon: '🎓' },
                              responsaveis: { label: 'Responsável', bg: '#f59e0b', icon: '👨‍👩‍👧' },
                              administradores: { label: 'Administrador', bg: '#a855f7', icon: '⚙️' }
                            };
                            return tipos[user.tipoUsuario as keyof typeof tipos];
                          }
                          return null;
                        };

                        const tipoBadge = getTipoBadge();

                        return (
                          <div
                            key={user.id}
                            style={{
                              backgroundColor: '#fff',
                              borderRadius: '12px',
                              padding: '16px',
                              marginBottom: '12px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                              border: '1px solid #e5e7eb'
                            }}
                          >
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: '600', fontSize: '1rem', color: '#111827', marginBottom: '4px', wordBreak: 'break-word' }}>
                                  {user.nome}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px', wordBreak: 'break-word' }}>
                                  {user.email}
                                </div>
                                {tipoBadge && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      backgroundColor: tipoBadge.bg + '20',
                                      color: tipoBadge.bg,
                                      fontWeight: '600',
                                      borderRadius: '8px',
                                      padding: '4px 10px',
                                      fontSize: '0.75rem'
                                    }}
                                  >
                                    <span>{tipoBadge.icon}</span>
                                    {tipoBadge.label}
                                  </span>
                                )}
                              </div>
                              <Badge
                                style={{
                                  backgroundColor: user.status === 'Ativo' ? '#22c55e' : '#6c757d',
                                  color: '#fff',
                                  fontWeight: 700,
                                  border: 'none',
                                  borderRadius: '12px',
                                  padding: '4px 10px',
                                  fontSize: '0.7rem',
                                  flexShrink: 0,
                                  marginLeft: '8px'
                                }}
                              >
                                {user.status || 'Ativo'}
                              </Badge>
                            </div>

                            {/* Info adicional */}
                            <div style={{
                              backgroundColor: '#f9fafb',
                              borderRadius: '8px',
                              padding: '10px',
                              marginBottom: '12px',
                              fontSize: '0.875rem',
                              color: '#374151'
                            }}>
                              {activeTab === 'todos' ? (
                                <>
                                  {user.tipoUsuario === 'professores' && (
                                    <div>
                                      <strong style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Turmas:</strong>
                                      <div style={{ marginTop: '4px' }}>
                                        {(user as Professor).turmas && (user as Professor).turmas.length > 0
                                          ? (user as Professor).turmas.map(id => turmas.find(t => t.id === id)?.nome).filter(Boolean).join(', ')
                                          : <span style={{ color: '#9ca3af' }}>Nenhuma turma</span>
                                        }
                                      </div>
                                    </div>
                                  )}
                                  {user.tipoUsuario === 'alunos' && (
                                    <div>
                                      <strong style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Turma:</strong>
                                      <div style={{ marginTop: '4px' }}>
                                        {turmas.find(t => t.id === (user as Aluno).turmaId)?.nome || <span style={{ color: '#9ca3af' }}>Sem turma</span>}
                                      </div>
                                    </div>
                                  )}
                                  {user.tipoUsuario === 'responsaveis' && (
                                    <div>
                                      <strong style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filhos:</strong>
                                      <div style={{ marginTop: '4px' }}>
                                        {(user as Responsavel).filhos && (user as Responsavel).filhos!.length > 0
                                          ? (user as Responsavel).filhos!.map(filhoId => alunos.find(a => a.id === filhoId)?.nome).filter(Boolean).join(', ')
                                          : <span style={{ color: '#9ca3af' }}>Nenhum filho vinculado</span>
                                        }
                                      </div>
                                    </div>
                                  )}
                                  {user.tipoUsuario === 'administradores' && (
                                    <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                                      Acesso total ao sistema
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  {activeTab === 'professores' && (
                                    <div>
                                      <strong style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Turmas:</strong>
                                      <div style={{ marginTop: '4px' }}>
                                        {(user as Professor).turmas && (user as Professor).turmas.length > 0
                                          ? (user as Professor).turmas.map(id => turmas.find(t => t.id === id)?.nome).filter(Boolean).join(', ')
                                          : <span style={{ color: '#9ca3af' }}>Nenhuma turma</span>
                                        }
                                      </div>
                                    </div>
                                  )}
                                  {activeTab === 'alunos' && (
                                    <div>
                                      <strong style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Turma:</strong>
                                      <div style={{ marginTop: '4px' }}>
                                        {turmas.find(t => t.id === (user as Aluno).turmaId)?.nome || <span style={{ color: '#9ca3af' }}>Sem turma</span>}
                                      </div>
                                    </div>
                                  )}
                                  {activeTab === 'responsaveis' && (
                                    <div>
                                      <strong style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filhos:</strong>
                                      <div style={{ marginTop: '4px' }}>
                                        {(user as Responsavel).filhos && (user as Responsavel).filhos!.length > 0
                                          ? (user as Responsavel).filhos!.map(filhoId => alunos.find(a => a.id === filhoId)?.nome).filter(Boolean).join(', ')
                                          : <span style={{ color: '#9ca3af' }}>Nenhum filho vinculado</span>
                                        }
                                      </div>
                                    </div>
                                  )}
                                  {activeTab === 'administradores' && (
                                    <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                                      Acesso total ao sistema
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => openEdit(user)}
                                style={{
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  padding: '10px',
                                  backgroundColor: '#3b82f6',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontSize: '0.875rem',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseDown={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
                                onMouseUp={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
                              >
                                <i className="bi bi-pencil"></i>
                                Editar
                              </button>
                              <button
                                onClick={() => handleExcluir(user.id)}
                                style={{
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  padding: '10px',
                                  backgroundColor: '#ef4444',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontSize: '0.875rem',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseDown={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
                                onMouseUp={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
                              >
                                <i className="bi bi-trash"></i>
                                Excluir
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>
                        <Person size={48} />
                      </div>
                      <h5 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        Nenhum usuário encontrado
                      </h5>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                        {search || activeTab !== 'todos'
                          ? 'Tente ajustar os filtros de busca.'
                          : 'Comece adicionando seu primeiro usuário.'
                        }
                      </p>
                    </div>
                  )}
                </Card.Body>
              </Card>
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
                  }).filter(u => !statusFiltro || (u.status || 'Ativo') === statusFiltro)
                    .filter(u => !turmaFiltro || u.tipoUsuario !== 'alunos' || (u as any).turmaId === turmaFiltro)
                  : activeTab === 'alunos' && turmaFiltro
                    ? filterList(alunos).filter(a => a.turmaId === turmaFiltro)
                    : filterList(
                      (activeTab === 'professores'
                        ? professores
                        : activeTab === 'alunos'
                          ? alunos
                          : activeTab === 'responsaveis'
                            ? responsaveis
                            : administradores) as UsuarioBase[]
                    )
                ).length / itemsPerPage
              )}
              aoMudarPagina={setCurrentPage}
            />
          </>
        )}

        <Modal show={showForm} onHide={() => setShowForm(false)} centered dialogClassName="modal-narrow">
          <Modal.Header closeButton className='border-bottom-0 pb-1'>
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

        {/* Modal de Exportação */}
        <Modal show={showExportModal} onHide={() => setShowExportModal(false)} centered>
          <Modal.Header closeButton style={{ borderBottom: '0' }}>
            <Modal.Title>Escolha o formato de exportação</Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ borderTop: '0' }}>
            <div className="d-flex align-items-center justify-content-between gap-3">
              <span className="mb-0" style={{ fontSize: 16 }}>Como você gostaria de exportar a lista de usuários?</span>
              <div className="d-flex gap-3">
                <Button
                  variant="outline-primary"
                  onClick={() => handleExport('pdf')}
                  className="d-flex align-items-center justify-content-center"
                >
                  PDF
                </Button>
                <Button
                  variant="outline-success"
                  onClick={() => handleExport('excel')}
                  className="d-flex align-items-center justify-content-center"
                >
                  Excel
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal>

        {/* Modal de Confirmação de Mudança de Status */}
        <Modal show={showStatusConfirmModal} onHide={() => setShowStatusConfirmModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>Confirmar Mudança de Status</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {statusChangeData && (
              <div>
                <p className="mb-3">
                  {statusChangeData.tipo === 'aluno'
                    ? 'Este aluno possui um responsável e outros alunos vinculados.'
                    : 'Este responsável possui alunos vinculados.'
                  }
                </p>
                <div className="bg-light p-3 rounded mb-3">
                  <p className="mb-2"><strong>Relacionados:</strong></p>
                  <ul className="mb-0">
                    {statusChangeData.relacionados.map(rel => (
                      <li key={rel.id}>
                        {rel.nome} ({rel.tipo === 'aluno' ? 'Aluno' : 'Responsável'})
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mb-0">
                  Deseja alterar o status {statusChangeData.tipo === 'aluno' ? 'do responsável e dos outros alunos' : 'dos alunos'} para <strong>Inativo</strong> também?
                </p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => handleConfirmStatusChange(false)}
            >
              Não, apenas este usuário
            </Button>
            <Button
              variant="primary"
              onClick={() => handleConfirmStatusChange(true)}
            >
              Sim, atualizar todos
            </Button>
          </Modal.Footer>
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







