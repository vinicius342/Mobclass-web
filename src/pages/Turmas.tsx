import { useEffect, useState } from 'react';
import { useAnoLetivoAtual } from '../hooks/useAnoLetivoAtual';
import AppLayout from '../components/layout/AppLayout';
import {
  Container, Button, Form, Spinner, ToastContainer, Toast, Card,
  Col,
  Row
} from 'react-bootstrap';
import { PlusCircle } from 'react-bootstrap-icons';
import { getTurmaAlunoNoAnoUtil, calcularMediaFinalUtil, getNotaColorUtil, isTurmaVirtualizada } from '../utils/turmasHelpers';
import { turmaService } from '../services/data/TurmaService';
import type { Turma } from '../models/Turma';
import type { Aluno } from '../models/Aluno';
import type { Nota } from '../models/Nota';
import type { Materia } from '../models/Materia';
import type { Professor } from '../models/Professor';
import { AlunoService } from '../services/usuario/AlunoService';
import { FirebaseAlunoRepository } from '../repositories/aluno/FirebaseAlunoRepository';
import { NotaService } from '../services/data/NotaService';
import { FirebaseNotaRepository } from '../repositories/nota/FirebaseNotaRepository';
import { FirebaseFrequenciaRepository } from '../repositories/frequencia/FirebaseFrequenciaRepository';
import { MateriaService } from '../services/data/MateriaService';
import { FirebaseMateriaRepository } from '../repositories/materia/FirebaseMateriaRepository';
import { ProfessorService } from '../services/data/ProfessorService';
import { FirebaseProfessorRepository } from '../repositories/professor/FirebaseProfessorRepository';
import { useAuth } from '../contexts/AuthContext';
import Paginacao from '../components/common/Paginacao';
import { Users, BookOpen, Clock } from 'lucide-react';
import { Check } from 'lucide-react';
import RematriculaTab from '../components/turmas/RematriculaTab';
import ConfirmacaoAcoesModal from '../components/turmas/ConfirmacaoAcoesModal';
import HistoricoNotasModal from '../components/turmas/HistoricoNotasModal';
import TurmaFormModal from '../components/turmas/TurmaFormModal';
import TurmaDetailsModal from '../components/turmas/TurmaDetailsModal';
import TurmasListDesktop from '../components/turmas/TurmasListDesktop';
import TurmasListMobile from '../components/turmas/TurmasListMobile';
import TransferenciaModal from '../components/turmas/TransferenciaModal';
import { ProfessorMateria } from '../models/ProfessorMateria';
import { ProfessorMateriaService } from '../services/data/ProfessorMateriaService';
import { FirebaseProfessorMateriaRepository } from '../repositories/professor_materia/FirebaseProfessorMateriaRepository';

// Instanciar Services
const alunoRepository = new FirebaseAlunoRepository();
const notaRepository = new FirebaseNotaRepository();
const materiaRepository = new FirebaseMateriaRepository();
const frequenciaRepository = new FirebaseFrequenciaRepository();
const professorRepository = new FirebaseProfessorRepository();
const professorMateriaRepository = new FirebaseProfessorMateriaRepository();

const alunoService = new AlunoService(alunoRepository, notaRepository, frequenciaRepository);
const notaService = new NotaService(notaRepository, materiaRepository);
const materiaService = new MateriaService(materiaRepository);
const professorService = new ProfessorService(professorRepository);
const professorMateriaService = new ProfessorMateriaService(professorMateriaRepository);

export default function Turmas() {
  const { anoLetivo, carregandoAnos, anosDisponiveis } = useAnoLetivoAtual();
  const authContext = useAuth();
  const userData = authContext?.userData;

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmasRematricula, setTurmasRematricula] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [vinculos, setVinculos] = useState<ProfessorMateria[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [turmaDetalhes, setTurmaDetalhes] = useState<Turma | null>(null);
  const [novaTurma, setNovaTurma] = useState('');

  const [turnoFiltro, setTurnoFiltro] = useState('');
  const [turnoModal, setTurnoModal] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const [erro, setErro] = useState('');
  const [turmaFiltro, setTurmaFiltro] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'danger' }>({ show: false, message: '', variant: 'success' });
  const [numAlunosFiltro, setNumAlunosFiltro] = useState('');

  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;

  // Estado para controlar a tab ativa
  const [activeTab, setActiveTab] = useState('gerenciar');

  // Estados para rematrícula de alunos
  const [turmaFiltroRematricula, setTurmaFiltroRematricula] = useState('');
  const [proximaTurma, setProximaTurma] = useState('');
  // Cache síncrono de turmas do próximo ano (reais + virtualizadas) para uso em UI
  const [turmasProximasCache, setTurmasProximasCache] = useState<Turma[]>([]);
  const [anoLetivoRematricula, setAnoLetivoRematricula] = useState<number>(anoLetivo); // Filtro local que sobrepõe o contexto
  const [statusPromocao, setStatusPromocao] = useState<Record<string, 'promovido' | 'reprovado' | null>>({});
  const [alunosTransferencia, setAlunosTransferencia] = useState<Record<string, string>>({});
  const [acaoFinalizada, setAcaoFinalizada] = useState<Record<string, 'promovido' | 'reprovado' | 'transferido'>>({});

  // Estado para modal de histórico de notas
  const [showHistorico, setShowHistorico] = useState(false);
  const [historicoAluno, setHistoricoAluno] = useState<{
    nome: string,
    notas: Nota[],
    dadosBoletim?: any
  } | null>(null);

  // Estado para status dos alunos (cache para página atual)
  const [statusAlunos, setStatusAlunos] = useState<Map<string, string>>(new Map());

  // Estado para modal de confirmação de ações
  const [showModalConfirmacao, setShowModalConfirmacao] = useState(false);
  const [resumoDestinos, setResumoDestinos] = useState<{
    promovidos: { alunoId: string; turmaDestino: string }[];
    reprovados: { alunoId: string; turmaDestino: string }[];
    transferidos: { alunoId: string; turmaDestino: string }[];
  }>({ promovidos: [], reprovados: [], transferidos: [] });

  // Estado para modal de transferência individual
  const [showModalTransferencia, setShowModalTransferencia] = useState(false);
  const [alunoTransferencia, setAlunoTransferencia] = useState<Aluno | null>(null);
  const [turmaDestinoTransferencia, setTurmaDestinoTransferencia] = useState<string>('');
  const [processandoTransferencia, setProcessandoTransferencia] = useState(false);

  // useEffect 1: Carregar dados e sincronizar ano letivo quando userData ou anoLetivo mudarem
  useEffect(() => {
    if (!userData || carregandoAnos) return;
    fetchData();
    setAnoLetivoRematricula(anoLetivo);
  }, [userData, carregandoAnos, anoLetivo]);

  // Carregar turmas do ano selecionado na Rematrícula
  useEffect(() => {
    const carregarTurmasRematricula = async () => {
      if (!userData || carregandoAnos) return;
      try {
        const isAdmin = userData && (userData as any).tipo === 'administradores';
        const todasTurmas = await turmaService.listarComVirtualizacao(anoLetivoRematricula.toString());

        if (isAdmin) {
          setTurmasRematricula(todasTurmas.sort((a, b) => a.nome.localeCompare(b.nome)));
        } else {
          const turmaIds = ((userData as any)?.turmas || []) as string[];
          const turmasProfessor = turmaIds.length > 0
            ? todasTurmas.filter(t => {
              if (!t.turmaOriginalId) return turmaIds.includes(t.id);
              return turmaIds.includes(t.turmaOriginalId);
            })
            : [];
          setTurmasRematricula(turmasProfessor.sort((a, b) => a.nome.localeCompare(b.nome)));
        }
      } catch (error) {
        console.error('Erro ao carregar turmas da rematrícula:', error);
      }
    };
    carregarTurmasRematricula();
  }, [anoLetivoRematricula, userData, carregandoAnos]);

  // useEffect 2: Focus no input do modal quando abrir
  useEffect(() => {
    if (showModal) {
      setTimeout(() => {
        document.getElementById('input-nome-turma')?.focus();
      }, 100);
    }
  }, [showModal]);

  // useEffect 3: Calcular status, médias e ações finalizadas dos alunos filtrados
  useEffect(() => {
    const processarAlunosFiltrados = async () => {
      const alunosFiltrados = getAlunosFiltrados();

      if (alunosFiltrados.length === 0) return;

      // Calcular status dos alunos
      calcularStatusAlunosPaginaAtual(alunosFiltrados, anoLetivoRematricula);

      // Carregar ações finalizadas do histórico
      const anoAtualStr = anoLetivoRematricula.toString();
      const novasAcoesFinalizadas: Record<string, 'promovido' | 'reprovado' | 'transferido'> = {};

      alunos.forEach(aluno => {
        if (aluno.historicoStatus && aluno.historicoStatus[anoAtualStr]) {
          novasAcoesFinalizadas[aluno.id] = aluno.historicoStatus[anoAtualStr];
        }
      });

      setAcaoFinalizada(novasAcoesFinalizadas);

      // Carregar médias (apenas se houver turma selecionada)
      if (turmaFiltroRematricula) {
        const novasMedias: Record<string, number | null> = {};
        for (const aluno of alunosFiltrados) {
          novasMedias[aluno.id] = await notaService.calcularMediaFinalAluno(aluno, anoLetivoRematricula);
        }
        setMediasAlunos(novasMedias);
      }
    };

    if (alunos.length > 0) {
      processarAlunosFiltrados();
    }
  }, [alunos, turmaFiltroRematricula, anoLetivoRematricula]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Carregar dados principais com dataLoaders
      const isAdmin = userData && userData.tipo === 'administradores';

      // Carregamentos em paralelo conforme perfil
      if (isAdmin) {
        const [turmasDoAno, alunosList, todasMaterias, todosProfessores, todosVinculos] = await Promise.all([
          turmaService.listarComVirtualizacao(anoLetivo.toString()),
          alunoRepository.findAll(),
          materiaService.listar(),
          professorService.listar(),
          professorMateriaService.listar()
        ]);

        setTurmas(turmasDoAno.sort((a, b) => a.nome.localeCompare(b.nome)));
        setAlunos(alunosList);
        setProfessores(todosProfessores);
        setMaterias(todasMaterias);
        setVinculos(todosVinculos);
      } else {
        const turmaIds = (userData?.turmas || []) as string[];

        const [todasTurmas, alunosList, todosProfessores, todasMaterias, todosVinculos] = await Promise.all([
          turmaService.listarComVirtualizacao(anoLetivo.toString()),
          alunoRepository.findAll(),
          professorService.listar(),
          materiaService.listar(),
          professorMateriaService.listar()
        ]);

        // Filtrar apenas turmas do professor (incluindo virtualizadas)
        const turmasProfessor = turmaIds.length > 0
          ? todasTurmas.filter(t => {
            // Para turmas reais, verificar se o ID está na lista
            if (!t.turmaOriginalId) {
              return turmaIds.includes(t.id);
            }
            // Para turmas virtualizadas, verificar se a turma original está na lista
            return turmaIds.includes(t.turmaOriginalId);
          })
          : [];

        setTurmas(turmasProfessor.sort((a, b) => a.nome.localeCompare(b.nome)));
        setAlunos(alunosList);
        setProfessores(todosProfessores);
        setMaterias(todasMaterias);
        setVinculos(todosVinculos);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
    setLoading(false);
  };

  const openModal = (turma?: Turma) => {
    if (turma) {
      setEditId(turma.id);
      setNovaTurma(turma.nome);
      setTurnoModal(turma.turno);
    } else {
      setEditId(null);
      setNovaTurma('');
      setTurnoModal('Manhã');
    }
    setErro('');
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSalvarTurma = async () => {
    if (!novaTurma.trim()) return setErro('Nome da turma é obrigatório.');
    if (!anoLetivo) return setErro('Ano letivo é obrigatório.');
    if (!turnoModal.trim()) return setErro('Turno é obrigatório.');

    const payload = { nome: novaTurma.trim(), anoLetivo: anoLetivo.toString(), turno: turnoModal.trim() };

    try {
      if (editId) {
        await turmaService.atualizar(editId, payload);
        setToast({ show: true, message: 'Turma atualizada com sucesso.', variant: 'success' });
      } else {
        await turmaService.criar(payload);
        setToast({ show: true, message: 'Turma cadastrada com sucesso.', variant: 'success' });
      }
      closeModal();
      fetchData();
    } catch (error) {
      console.error(error);
      setToast({ show: true, message: 'Erro ao salvar turma.', variant: 'danger' });
    }
  };

  const handleExcluirTurma = async (id: string) => {
    // Verificar se é uma turma virtualizada
    const turma = turmas.find(t => t.id === id);

    if (turma?.turmaOriginalId) {
      // É uma turma virtual - desativar virtualização da turma original
      if (!window.confirm('Deseja desativar a virtualização desta turma?')) return;

      try {
        await turmaService.atualizar(turma.turmaOriginalId, {
          isVirtual: false
        });
        setToast({ show: true, message: 'Virtualização desativada.', variant: 'success' });
        fetchData();
      } catch (error) {
        console.error(error);
        setToast({ show: true, message: 'Erro ao desativar virtualização.', variant: 'danger' });
      }
    } else {
      // É uma turma real - excluir normalmente
      if (!window.confirm('Deseja realmente excluir esta turma?')) return;

      try {
        await turmaService.excluir(id);
        setToast({ show: true, message: 'Turma excluída.', variant: 'success' });
        fetchData();
      } catch (error) {
        console.error(error);
        setToast({ show: true, message: 'Erro ao excluir turma.', variant: 'danger' });
      }
    }
  };

  const totalAlunos = (turmaId: string) => alunos.filter(a => getTurmaAlunoNoAnoUtil(a, anoLetivo) === turmaId).length;

  // Utilitário extraído em src/utils/turmasHelpers.ts: getTurmaAlunoNoAnoUtil

  // Filtragem combinada
  const turmasFiltradas = turmas.filter(t => {
    // Filtro ano letivo do contexto
    const matchAno = t.anoLetivo === anoLetivo.toString();
    // Busca por nome
    const matchBusca = turmaFiltro === '' || t.nome.toLowerCase().includes(turmaFiltro.toLowerCase());
    // Filtro turno
    const matchTurno = turnoFiltro === '' || t.turno === turnoFiltro;
    // Filtro número de alunos
    const total = totalAlunos(t.id);
    let matchNumAlunos = true;
    if (numAlunosFiltro === 'ate19') matchNumAlunos = total <= 19;
    else if (numAlunosFiltro === '20a30') matchNumAlunos = total >= 20 && total <= 30;
    else if (numAlunosFiltro === 'mais30') matchNumAlunos = total > 30;

    return matchAno && matchBusca && matchTurno && matchNumAlunos;
  });

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const turmasPaginadas = turmasFiltradas.slice(inicio, inicio + itensPorPagina);

  const getTurnoStyle = (turno: string) => {
    switch (turno.toLowerCase()) {
      case 'manhã':
        return { bg: '#fed7aa', color: '#ea580c' }; // laranja suave
      case 'tarde':
        return { bg: '#fecaca', color: '#9a3412' }; // vermelho claro
      case 'noite':
        return { bg: '#dbeafe', color: '#1e40af' }; // azul claro
      default:
        return { bg: '#f3f4f6', color: '#6b7280' }; // cinza
    }
  };

  // Função para obter estilo do status do aluno (similar aos turnos)
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return { bg: '#dcfce7', color: '#166534' };
      case 'Reprovado':
        return { bg: '#fecaca', color: '#dc2626' };
      case 'Em Andamento':
        return { bg: '#fef3c7', color: '#d97706' };
      case 'promovido':
        return { bg: '#dcfce7', color: '#166534' };
      case 'reprovado':
        return { bg: '#fecaca', color: '#e43838ff' };
      case 'transferido':
        return { bg: '#dbeafe', color: '#1e40af' };
      default:
        return { bg: '#f3f4f6', color: '#6b7280' };
    }
  };

  const handleVerDetalhes = (turma: Turma) => {
    setTurmaDetalhes(turma);
    setShowDetalhesModal(true);
  };

  const closeDetalhesModal = () => {
    setShowDetalhesModal(false);
    setTurmaDetalhes(null);
  };

  const getProfessoresDaTurma = (turmaId: string, turmaObj?: Turma) => {
    // Se for turma virtualizada, buscar vínculos pela turmaOriginalId
    let targetTurmaId = turmaId;
    if (turmaObj && isTurmaVirtualizada(turmaObj)) {
      targetTurmaId = turmaObj.turmaOriginalId!;
    } else if (turmaId.startsWith('virtual_')) {
      const turma = turmas.find(t => t.id === turmaId);
      targetTurmaId = turma?.turmaOriginalId || turmaId;
    }

    return vinculos
      .filter(v => v.turmaId === targetTurmaId)
      .map(v => {
        const professor = professores.find(p => p.id === v.professorId);
        const materia = materias.find(m => m.id === v.materiaId);
        return {
          professor: professor?.nome || 'Professor não encontrado',
          materia: materia?.nome || 'Matéria não encontrada'
        };
      })
      .sort((a, b) => a.professor.localeCompare(b.professor));
  };

  const getAlunosDaTurma = (turmaId: string) => {
    // Para turmas virtualizadas, não mostra alunos (usam turmaOriginalId)
    if (turmaId.startsWith('virtual_')) {
      return [];
    }
    return alunos
      .filter(a => getTurmaAlunoNoAnoUtil(a, anoLetivo) === turmaId)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  };

  const handleMaterializarTurma = async (turma: Turma) => {
    if (!isTurmaVirtualizada(turma)) return;

    if (!window.confirm(
      `Deseja materializar a turma "${turma.nome}" para ${anoLetivo}?\n\n` +
      'Esta ação irá:\n' +
      '• Criar a turma real no ano atual\n' +
      '• Copiar os vínculos professor-matéria\n' +
      '• Marcar a turma original como não virtualizável\n\n' +
      'Os alunos precisarão ser rematriculados manualmente.'
    )) return;

    try {
      // Criar turma real no ano atual
      const novaTurmaId = await turmaService.criar({
        nome: turma.nome,
        anoLetivo: anoLetivo.toString(),
        turno: turma.turno
      });

      // Copiar vínculos professor-matéria da turma original usando service
      await professorMateriaService.copiarVinculos(turma.turmaOriginalId!, novaTurmaId);

      // Marcar turma original como não virtualizável
      await turmaService.atualizar(turma.turmaOriginalId!, {
        isVirtual: false
      });

      setToast({
        show: true,
        message: `Turma "${turma.nome}" materializada com sucesso!`,
        variant: 'success'
      });

      fetchData();

    } catch (error) {
      console.error('Erro ao materializar turma:', error);
      setToast({
        show: true,
        message: 'Erro ao materializar turma',
        variant: 'danger'
      });
    }
  };

  // Função para filtrar alunos na tab de rematrícula
  const getAlunosFiltrados = () => {
    return alunos.filter(aluno => {
      // Filtro por turma (usando histórico do ano letivo selecionado na rematrícula)
      const matchTurma = turmaFiltroRematricula === '' ||
        getTurmaAlunoNoAnoUtil(aluno, anoLetivoRematricula) === turmaFiltroRematricula;
      return matchTurma;
    });
  };

  // Utilitário extraído em src/utils/turmasHelpers.ts: calcularMediaFinalUtil

  // Utilitário extraído em src/utils/turmasHelpers.ts: getNotaColorUtil

  // Função para calcular status de todos os alunos da página atual
  const calcularStatusAlunosPaginaAtual = async (alunosVisiveis: Aluno[], anoParaCalculo: number = anoLetivo) => {
    const novosStatus = new Map<string, string>();

    // Calcular status em paralelo para melhor performance
    const promessas = alunosVisiveis.map(async (aluno) => {
      const status = await alunoService.calcularStatusAluno(aluno, anoParaCalculo);
      return { alunoId: aluno.id, status };
    });

    const resultados = await Promise.all(promessas);

    resultados.forEach(({ alunoId, status }) => {
      novosStatus.set(alunoId, status);
    });

    setStatusAlunos(novosStatus);
  };

  // Função para obter o badge do status
  const getSituacaoBadge = (alunoId: string) => {
    const status = statusAlunos.get(alunoId) || 'Em Andamento';
    const statusStyle = getStatusStyle(status);

    return (
      <span
        className="badge badge-turno px-2 py-1"
        style={{
          backgroundColor: statusStyle.bg,
          color: statusStyle.color,
          fontWeight: '500'
        }}
      >
        {status}
      </span>
    );
  };

  // Atualizar cache de turmas próximas quando filtros/ano mudarem
  useEffect(() => {
    const atualizarCache = async () => {
      if (!turmaFiltroRematricula) {
        setTurmasProximasCache([]);
        return;
      }
      const anoAtualStr = anoLetivoRematricula.toString();
      const lista = await turmaService.obterProximoAnoComVirtualizacao(anoAtualStr);
      setTurmasProximasCache(lista);
    };
    atualizarCache();
  }, [turmaFiltroRematricula, anoLetivoRematricula, turmas]);

  // Função síncrona para obter turmas do próximo ano a partir do cache
  const getTurmasProximas = (): Turma[] => {
    return turmasProximasCache;
  };

  // Estado para armazenar médias dos alunos
  const [mediasAlunos, setMediasAlunos] = useState<Record<string, number | null>>({});

  // (Médias são carregadas no useEffect consolidado acima junto com status e ações finalizadas)

  // Função auxiliar para materializar turma virtual
  const materializarTurmaVirtual = async (turmaIdOuObjeto: string | Turma): Promise<string> => {
    // Criar cache combinado de turmas reais + próximas para passar ao service
    const turmasCache = [...turmas, ...getTurmasProximas()];
    
    // Usar TurmaService para materializar
    return await turmaService.materializarTurmaVirtualComDados(turmaIdOuObjeto, turmasCache);
  };

  // Função para abrir modal de confirmação
  const handleAbrirModalConfirmacao = async () => {
    const alunosComAcao = Object.keys(statusPromocao).filter(
      alunoId => statusPromocao[alunoId] !== null || alunosTransferencia[alunoId]
    );

    if (alunosComAcao.length === 0) {
      setToast({ show: true, message: 'Nenhuma ação selecionada', variant: 'danger' });
      return;
    }

    // Verificar se próxima turma está selecionada (exceto para reprovados)
    const temPromovido = alunosComAcao.some(id => statusPromocao[id] === 'promovido');
    const temTransferido = Object.keys(alunosTransferencia).length > 0;

    if ((temPromovido || temTransferido) && !proximaTurma) {
      setToast({ show: true, message: 'Selecione a próxima turma antes de confirmar', variant: 'danger' });
      return;
    }

    // VALIDAÇÃO via service: promoção deve ser para série superior
    if (temPromovido && proximaTurma && turmaFiltroRematricula) {
      const turmaAtual = turmasRematricula.find(t => t.id === turmaFiltroRematricula);

      // Buscar turma próxima (real ou virtual do cache)
      let turmaProxima = turmasRematricula.find(t => t.id === proximaTurma);
      if (!turmaProxima) {
        const turmasProximas = getTurmasProximas();
        turmaProxima = turmasProximas.find((t: Turma) => t.id === proximaTurma);
      }

      if (turmaAtual && turmaProxima) {
        const validacao = turmaService.validarPromocao(turmaAtual, turmaProxima);
        if (!validacao.ok) {
          setToast({ show: true, message: validacao.motivo || 'Promoção inválida', variant: 'danger' });
          return;
        }
      }
    }

    // Calcular resumo de destinos
    const promovidos: { alunoId: string; turmaDestino: string }[] = [];
    const reprovados: { alunoId: string; turmaDestino: string }[] = [];
    const transferidos: { alunoId: string; turmaDestino: string }[] = [];

    // Variáveis de ano não são mais necessárias aqui após centralização no service

    for (const alunoId of alunosComAcao) {
      const aluno = alunos.find(a => a.id === alunoId);
      if (!aluno) continue;

      // Promovidos
      if (statusPromocao[alunoId] === 'promovido' && proximaTurma) {
        const turmaAtualAluno = turmasRematricula.find(t => t.id === getTurmaAlunoNoAnoUtil(aluno, anoLetivoRematricula));
        const destinoPromo = turmaAtualAluno
          ? await turmaService.resolverDestinoPromocao(turmaAtualAluno, anoLetivoRematricula.toString(), proximaTurma)
          : null;

        promovidos.push({
          alunoId: aluno.id,
          turmaDestino: destinoPromo?.nome || 'Desconhecida'
        });
      }

      // Reprovados
      if (statusPromocao[alunoId] === 'reprovado') {
        const turmaAtualAluno = turmasRematricula.find(t => t.id === getTurmaAlunoNoAnoUtil(aluno, anoLetivoRematricula));
        const nomeAtualAluno = turmaAtualAluno?.nome || '';

        // Resolver destino usando o TurmaService para evitar inconsistências
        const destino = turmaAtualAluno
          ? await turmaService.resolverDestinoReprovacao(turmaAtualAluno, anoLetivoRematricula.toString())
          : undefined;

        console.log('🔍 DEBUG Reprovação (service):', {
          aluno: aluno.nome,
          turmaAtual: nomeAtualAluno,
          destino: destino?.nome
        });

        reprovados.push({
          alunoId: aluno.id,
          turmaDestino: destino?.nome || 'Desconhecida'
        });
      }

      // Transferidos
      if (alunosTransferencia[alunoId]) {
        const turmaDestino = turmasRematricula.find(t => t.id === alunosTransferencia[alunoId]);
        transferidos.push({
          alunoId: aluno.id,
          turmaDestino: turmaDestino?.nome || 'Desconhecida'
        });
      }
    }

    setResumoDestinos({ promovidos, reprovados, transferidos });

    setShowModalConfirmacao(true);
  };



  // Função para confirmar ações de promoção, reprovação e transferência
  const handleConfirmarAcoes = async () => {
    try {
      setShowModalConfirmacao(false);

      const alunosComAcao = Object.keys(statusPromocao).filter(
        alunoId => statusPromocao[alunoId] !== null || alunosTransferencia[alunoId]
      );

      if (alunosComAcao.length === 0) {
        return;
      }

      const anoProximoStr = (anoLetivoRematricula + 1).toString();

      // Processar cada aluno
      for (const alunoId of alunosComAcao) {
        const aluno = alunos.find(a => a.id === alunoId);
        if (!aluno) {
          continue;
        }

        // Se for transferência
        if (alunosTransferencia[alunoId]) {
          const turmaDestinoIdOriginal = alunosTransferencia[alunoId];

          // MATERIALIZAR TURMA VIRTUAL SE NECESSÁRIO
          const turmaDestinoId = await materializarTurmaVirtual(turmaDestinoIdOriginal);

          const turmaDestino = turmasRematricula.find(t => t.id === turmaDestinoIdOriginal);

          if (turmaDestino) {
            const turmaAtualAluno = turmasRematricula.find(t => t.id === getTurmaAlunoNoAnoUtil(aluno, anoLetivoRematricula));
            const valid = turmaAtualAluno ? turmaService.validarTransferencia(turmaAtualAluno, turmaDestino) : { ok: true };
            if (!valid.ok) {
              setToast({ show: true, message: `Aluno ${aluno.nome}: ${valid.motivo}`, variant: 'danger' });
              continue;
            }

            // IMPORTANTE: Preservar a turma atual no histórico do ano atual
            const turmaAtualId = getTurmaAlunoNoAnoUtil(aluno, anoLetivoRematricula);

            // Usar AlunoService para transferir
            await alunoService.transferirAluno(
              alunoId,
              anoLetivoRematricula.toString(),
              turmaDestino.anoLetivo,
              turmaDestinoId
            );

            // COPIAR NOTAS E FREQUÊNCIAS DA TURMA ANTIGA PARA A NOVA
            await alunoService.copiarDadosAcademicos(aluno.id, turmaAtualId, turmaDestinoId);

            setAcaoFinalizada(prev => ({ ...prev, [alunoId]: 'transferido' }));
          }
        }
        // Se for promoção
        else if (statusPromocao[alunoId] === 'promovido') {
          if (!proximaTurma) {
            continue;
          }

          // Resolver destino de promoção via service e validar
          const turmaAtualAluno = turmasRematricula.find(t => t.id === getTurmaAlunoNoAnoUtil(aluno, anoLetivoRematricula));
          const turmaDestinoObj = turmaAtualAluno
            ? await turmaService.resolverDestinoPromocao(turmaAtualAluno, anoLetivoRematricula.toString(), proximaTurma)
            : null;

          if (!turmaDestinoObj) {
            setToast({ show: true, message: `Promoção inválida para ${aluno.nome}`, variant: 'danger' });
            continue;
          }

          // MATERIALIZAR TURMA VIRTUAL SE NECESSÁRIO (passando objeto)
          const turmaDestinoId = await materializarTurmaVirtual(turmaDestinoObj);

          if (turmaDestinoObj) {
            // Usar AlunoService para promover
            await alunoService.promoverAluno(
              alunoId,
              anoLetivoRematricula.toString(),
              anoProximoStr,
              turmaDestinoId
            );

            setAcaoFinalizada(prev => ({ ...prev, [alunoId]: 'promovido' }));
          }
        }
        // Se for reprovação
        else if (statusPromocao[alunoId] === 'reprovado') {
          // Para reprovados: usar o TurmaService para resolver destino
          const turmaAtualAluno = turmas.find(t => t.id === getTurmaAlunoNoAnoUtil(aluno, anoLetivoRematricula));
          if (!turmaAtualAluno) {
            setToast({ show: true, message: `Turma atual não encontrada para ${aluno.nome}`, variant: 'danger' });
            continue;
          }

          const turmaDestinoObj = await turmaService.resolverDestinoReprovacao(turmaAtualAluno, anoLetivoRematricula.toString());
          if (!turmaDestinoObj) {
            setToast({ show: true, message: `Nenhuma turma da mesma série encontrada para ${aluno.nome}`, variant: 'danger' });
            continue;
          }

          // MATERIALIZAR TURMA VIRTUAL SE NECESSÁRIO (passar objeto completo)
          const turmaDestinoIdFinal = await materializarTurmaVirtual(turmaDestinoObj);

          // Usar AlunoService para reprovar
          await alunoService.reprovarAluno(
            alunoId,
            anoLetivoRematricula.toString(),
            anoProximoStr,
            turmaDestinoIdFinal
          );

          setAcaoFinalizada(prev => ({ ...prev, [alunoId]: 'reprovado' }));
        }
      }

      setToast({
        show: true,
        message: `${alunosComAcao.length} aluno(s) processado(s) com sucesso!`,
        variant: 'success'
      });

      // Limpar seleções
      setStatusPromocao({});
      setAlunosTransferencia({});
      setProximaTurma('');

      // Recarregar dados
      await fetchData();

    } catch (error) {
      console.error('❌ ERRO ao confirmar ações:', error);
      console.error('Detalhes do erro:', error);
      setToast({ show: true, message: 'Erro ao processar ações', variant: 'danger' });
    }
  };

  // Função para abrir modal de histórico de notas
  const handleAbrirBoletim = async (aluno: Aluno) => {
    try {
      const boletim = await notaService.gerarBoletimAluno(aluno, anoLetivoRematricula);

      if (!boletim) {
        setHistoricoAluno({ nome: aluno.nome, notas: [] });
      } else {
        setHistoricoAluno({
          nome: aluno.nome,
          notas: [],
          dadosBoletim: boletim
        });
      }

      setShowHistorico(true);
    } catch (error) {
      console.error('Erro ao buscar histórico de notas:', error);
      setToast({ show: true, message: 'Erro ao carregar boletim', variant: 'danger' });
    }
  };

  // Função para abrir modal de transferência individual
  const handleAbrirModalTransferencia = (aluno: Aluno) => {
    setAlunoTransferencia(aluno);
    setTurmaDestinoTransferencia('');
    setShowModalTransferencia(true);
  };

  // Função para fechar modal de transferência
  const handleFecharModalTransferencia = () => {
    setShowModalTransferencia(false);
    setAlunoTransferencia(null);
    setTurmaDestinoTransferencia('');
  };

  // Função para confirmar transferência individual
  const handleConfirmarTransferenciaIndividual = async () => {
    if (!alunoTransferencia || !turmaDestinoTransferencia) {
      setToast({ show: true, message: 'Selecione uma turma de destino', variant: 'danger' });
      return;
    }

    setProcessandoTransferencia(true);

    try {
      // MATERIALIZAR TURMA VIRTUAL SE NECESSÁRIO
      const turmaDestinoId = await materializarTurmaVirtual(turmaDestinoTransferencia);

      const turmaDestino = turmasRematricula.find(t => t.id === turmaDestinoTransferencia);
      if (!turmaDestino) {
        setToast({ show: true, message: 'Turma de destino não encontrada', variant: 'danger' });
        setProcessandoTransferencia(false);
        return;
      }

      // Validar via TurmaService
      const turmaAtualAluno = turmasRematricula.find(
        t => t.id === getTurmaAlunoNoAnoUtil(alunoTransferencia, anoLetivoRematricula)
      );
      const valid = turmaAtualAluno ? turmaService.validarTransferencia(turmaAtualAluno, turmaDestino) : { ok: true };
      if (!valid.ok) {
        setToast({ show: true, message: valid.motivo || 'Transferência inválida', variant: 'danger' });
        setProcessandoTransferencia(false);
        return;
      }

      // Preservar origem para cópia de notas/frequências
      const turmaOrigemId = getTurmaAlunoNoAnoUtil(alunoTransferencia, anoLetivoRematricula);

      // Atualizar histórico via AlunoService
      await alunoService.transferirAluno(
        alunoTransferencia.id,
        anoLetivoRematricula.toString(),
        turmaDestino.anoLetivo,
        turmaDestinoId
      );

      // Copiar notas e frequências
      await alunoService.copiarDadosAcademicos(alunoTransferencia.id, turmaOrigemId, turmaDestinoId);

      setToast({ show: true, message: `${alunoTransferencia.nome} transferido com sucesso!`, variant: 'success' });

      // Atualizar a lista de alunos
      await fetchData();

      handleFecharModalTransferencia();
    } catch (error) {
      console.error('❌ Erro ao transferir aluno:', error);
      setToast({ show: true, message: 'Erro ao transferir aluno', variant: 'danger' });
    } finally {
      setProcessandoTransferencia(false);
    }
  };

  // Função para aprovar todos os alunos
  const handleAprovarTodos = () => {
    const alunosFiltrados = getAlunosFiltrados();
    const novosStatus: Record<string, 'promovido' | 'reprovado' | null> = {};

    alunosFiltrados.forEach(aluno => {
      // Permitir marcar se não tem ação finalizada OU se foi transferido
      if (!acaoFinalizada[aluno.id] || acaoFinalizada[aluno.id] === 'transferido') {
        novosStatus[aluno.id] = 'promovido';
      }
    });

    setStatusPromocao(prev => ({ ...prev, ...novosStatus }));

    // Limpar transferências
    const novaTransferencia = { ...alunosTransferencia };
    Object.keys(novosStatus).forEach(id => delete novaTransferencia[id]);
    setAlunosTransferencia(novaTransferencia);

    setToast({ show: true, message: 'Todos os alunos marcados como promovidos', variant: 'success' });
  };

  // Função para reprovar todos os alunos
  const handleReprovarTodos = () => {
    const alunosFiltrados = getAlunosFiltrados();
    const novosStatus: Record<string, 'promovido' | 'reprovado' | null> = {};

    alunosFiltrados.forEach(aluno => {
      // Permitir marcar se não tem ação finalizada OU se foi transferido
      if (!acaoFinalizada[aluno.id] || acaoFinalizada[aluno.id] === 'transferido') {
        novosStatus[aluno.id] = 'reprovado';
      }
    });

    setStatusPromocao(prev => ({ ...prev, ...novosStatus }));

    // Limpar transferências
    const novaTransferencia = { ...alunosTransferencia };
    Object.keys(novosStatus).forEach(id => delete novaTransferencia[id]);
    setAlunosTransferencia(novaTransferencia);

    setToast({ show: true, message: 'Todos os alunos marcados como reprovados', variant: 'success' });
  };

  return (
    <AppLayout>
      <Container className="my-4">
        <div className="border-gray-200 mb-3">
          <div className="mb-4 px-1">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <div className="d-flex align-items-center gap-2">
                <Users size={32} color="#2563eb" style={{ minWidth: 32, minHeight: 32 }} />
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
                  Gestão de Turmas
                </h1>
              </div>
            </div>
            <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
              Gerencie as turmas da escola
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="container px-0">
          <div className="d-flex py-3">
            <div className="custom-tabs-container w-100">
              <button
                className={`custom-tab ${activeTab === 'gerenciar' ? 'active' : ''}`}
                onClick={() => setActiveTab('gerenciar')}
                type="button"
                style={{ flex: 1 }}
              >
                Gerenciar Turmas
              </button>
              <button
                className={`custom-tab ${activeTab === 'rematricula' ? 'active' : ''}`}
                onClick={() => setActiveTab('rematricula')}
                type="button"
                style={{ flex: 1 }}
              >
                Promoção de Turmas
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container py-0 px-0">
          {/* Tab de Gerenciar Turmas */}
          {activeTab === 'gerenciar' && (
            <>
              {/* Cards de resumo acima dos filtros */}
              <Row className='mb-3'>
                {/* Card Total de Turmas */}
                <Col md={4}>
                  <Card className="shadow-sm card-sm border-left-primary mb-1">
                    <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                      <span className="fw-bold" style={{ fontSize: '1.1rem', color: '#3b4861' }}>Total de Turmas</span>
                      <BookOpen size={20} className="text-primary" />
                    </div>
                    <Card.Body className="py-3">
                      <h3 className="mb-0 fw-bold" style={{ color: '#2563eb' }}>{turmasFiltradas.length}</h3>
                    </Card.Body>
                  </Card>
                </Col>
                {/* Card Média de Alunos */}
                <Col md={4}>
                  <Card className="shadow-sm card-sm border-left-success mb-1">
                    <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                      <span className="fw-bold" style={{ fontSize: '1.1rem', color: '#3b4861' }}>Média de Alunos</span>
                      <Users size={20} className="text-success" />
                    </div>
                    <Card.Body className="py-3">
                      <h3 className="mb-0 fw-bold" style={{ color: '#22c55e' }}>{turmasFiltradas.length > 0 ? Math.round(turmasFiltradas.reduce((acc, t) => acc + totalAlunos(t.id), 0) / turmasFiltradas.length) : 0}</h3>
                    </Card.Body>
                  </Card>
                </Col>
                {/* Card Turnos Ativos */}
                <Col md={4}>
                  <Card className="shadow-sm card-sm border-left-purple mb-1" style={{ borderLeft: '4px solid #a78bfa' }}>
                    <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                      <span className="fw-bold" style={{ fontSize: '1.1rem', color: '#3b4861' }}>Turnos Ativos</span>
                      <span className="d-flex align-items-center gap-2">
                        <Clock size={20} color="#a78bfa" />
                      </span>
                    </div>
                    <Card.Body className="py-3">
                      <h3 className="mb-0 fw-bold" style={{ color: '#a78bfa' }}>{Array.from(new Set(turmasFiltradas.map(t => t.turno))).length}</h3>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Filtros em um único card */}
              <Card className="mb-4">
                <Card.Body>
                  <Row>
                    <Col md={3} className='mb-1'>
                      <Form.Control
                        type="text"
                        placeholder="Buscar turma..."
                        value={turmaFiltro}
                        onChange={e => { setTurmaFiltro(e.target.value); setPaginaAtual(1); }}
                      />
                    </Col>
                    {/* Filtro de ano letivo removido pois agora é global pelo context */}
                    <Col md={3} className='mb-1'>
                      <Form.Select value={turnoFiltro} onChange={e => { setTurnoFiltro(e.target.value); setPaginaAtual(1); }}>
                        <option value="">Todos os turnos</option>
                        {[...new Set(turmas.map(t => t.turno))].sort().map(turno => (
                          <option key={turno} value={turno}>{turno}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={3} className='mb-1'>
                      <Form.Select value={numAlunosFiltro} onChange={e => { setNumAlunosFiltro(e.target.value); setPaginaAtual(1); }}>
                        <option value="">Nº de alunos</option>
                        <option value="ate19">Até 19</option>
                        <option value="20a30">20 a 30</option>
                        <option value="mais30">Mais de 30</option>
                      </Form.Select>
                    </Col>
                    <Col md={3} className='mb-1'>
                      <Button
                        className='w-100'
                        variant="primary" onClick={() => openModal()}>
                        <PlusCircle className="me-2" size={18} /> Nova Turma
                      </Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {loading ? (
                <div className="d-flex justify-content-center align-items-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : (
                <>
                  <TurmasListDesktop
                    turmasPaginadas={turmasPaginadas}
                    totalAlunos={totalAlunos}
                    getTurnoStyle={getTurnoStyle}
                    handleVerDetalhes={handleVerDetalhes}
                    openModal={openModal}
                    handleExcluirTurma={handleExcluirTurma}
                  />

                  <TurmasListMobile
                    turmasPaginadas={turmasPaginadas}
                    totalAlunos={totalAlunos}
                    getTurnoStyle={getTurnoStyle}
                    handleVerDetalhes={handleVerDetalhes}
                    handleMaterializarTurma={handleMaterializarTurma}
                    openModal={openModal}
                    handleExcluirTurma={handleExcluirTurma}
                  />

                  <Paginacao
                    paginaAtual={paginaAtual}
                    totalPaginas={Math.ceil(turmasFiltradas.length / itensPorPagina)}
                    aoMudarPagina={setPaginaAtual}
                  />
                </>
              )}
            </>
          )}

          {/* Tab de Rematrícula de Alunos */}
          {activeTab === 'rematricula' && (
            <RematriculaTab
              anoLetivoRematricula={anoLetivoRematricula}
              setAnoLetivoRematricula={setAnoLetivoRematricula}
              anosDisponiveis={anosDisponiveis}
              turmaFiltroRematricula={turmaFiltroRematricula}
              setTurmaFiltroRematricula={setTurmaFiltroRematricula}
              proximaTurma={proximaTurma}
              setProximaTurma={setProximaTurma}
              turmas={turmasRematricula}
              getTurmasProximas={getTurmasProximas}
              getAlunosFiltrados={getAlunosFiltrados}
              statusPromocao={statusPromocao}
              setStatusPromocao={setStatusPromocao}
              alunosTransferencia={alunosTransferencia}
              setAlunosTransferencia={setAlunosTransferencia}
              handleAprovarTodos={handleAprovarTodos}
              handleReprovarTodos={handleReprovarTodos}
              loading={loading}
              mediasAlunos={mediasAlunos}
              getSituacaoBadge={getSituacaoBadge}
              handleAbrirModalTransferencia={handleAbrirModalTransferencia}
              handleAbrirBoletim={handleAbrirBoletim}
              acaoFinalizada={acaoFinalizada}
              getStatusStyle={getStatusStyle}
            />
          )}

          <TurmaFormModal
            show={showModal}
            onHide={closeModal}
            editId={editId}
            novaTurma={novaTurma}
            setNovaTurma={setNovaTurma}
            anoLetivo={anoLetivo}
            turnoModal={turnoModal}
            setTurnoModal={setTurnoModal}
            erro={erro}
            onSave={handleSalvarTurma}
          />



          {/* Modal de Detalhes da Turma */}
          <TurmaDetailsModal
            show={showDetalhesModal}
            onHide={closeDetalhesModal}
            turmaDetalhes={turmaDetalhes}
            anoLetivo={anoLetivo}
            getTurnoStyle={getTurnoStyle}
            getProfessoresDaTurma={getProfessoresDaTurma}
            getAlunosDaTurma={getAlunosDaTurma}
          />

          <HistoricoNotasModal
            show={showHistorico}
            onHide={() => setShowHistorico(false)}
            historicoAluno={historicoAluno}
            setShowHistorico={setShowHistorico}
            getNotaColorUtil={getNotaColorUtil}
            calcularMediaFinalUtil={calcularMediaFinalUtil}
          />
        </div>

        <ConfirmacaoAcoesModal
          show={showModalConfirmacao}
          onHide={() => setShowModalConfirmacao(false)}
          turmaNomeAtual={turmasRematricula.find(t => t.id === turmaFiltroRematricula)?.nome}
          resumoDestinos={resumoDestinos}
          onConfirm={handleConfirmarAcoes}
        />
        <TransferenciaModal
          show={showModalTransferencia}
          onHide={handleFecharModalTransferencia}
          alunoTransferencia={alunoTransferencia}
          turmas={turmas}
          anoLetivoRematricula={anoLetivoRematricula}
          mediasAlunos={mediasAlunos}
          getStatusBadge={getSituacaoBadge}
          turmaDestinoTransferencia={turmaDestinoTransferencia}
          setTurmaDestinoTransferencia={setTurmaDestinoTransferencia}
          processandoTransferencia={processandoTransferencia}
          onConfirm={handleConfirmarTransferenciaIndividual}
        />

        {/* Botão flutuante de confirmar - só aparece na aba de rematrícula */}
        {activeTab === 'rematricula' && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleAbrirModalConfirmacao}
            style={{
              position: 'fixed',
              bottom: '2rem',
              right: '2rem',
              zIndex: 1000,
              borderRadius: '8px',
              padding: '0.5rem 1.25rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: '600'
            }}
            disabled={
              Object.keys(statusPromocao).filter(id => statusPromocao[id] !== null).length === 0 &&
              Object.keys(alunosTransferencia).length === 0
            }
          >
            <Check size={16} />
            Confirmar
          </Button>
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
