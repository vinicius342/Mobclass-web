import { useEffect, useState } from 'react';
import { useAnoLetivoAtual } from '../hooks/useAnoLetivoAtual';
import AppLayout from '../components/layout/AppLayout';
import {
  Container, Button, Form, Spinner, ToastContainer, Toast, Card,
  Col,
  Row
} from 'react-bootstrap';
import { PlusCircle } from 'react-bootstrap-icons';
import {
  collection, getDocs, addDoc, updateDoc, doc, query, where,
} from 'firebase/firestore';
import { db } from '../services/firebase/firebase';
import { loadAdminData, loadProfessorData, loadProfessores } from '../services/data/dataLoaders';
import { getTurmaAlunoNoAnoUtil, calcularMediaFinalUtil, getNotaColorUtil, isTurmaVirtualizada } from '../utils/turmasHelpers';
import { turmaService } from '../services/turma/TurmaService';
import type { Turma } from '../models/Turma';
import type { Aluno } from '../models/Aluno';
import { AlunoService } from '../services/usuario/AlunoService';
import { FirebaseAlunoRepository } from '../repositories/FirebaseAlunoRepository';
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

// Lista auxiliar de turmas reais do próximo ano
// (usada para montar o select de Próxima Turma corretamente)
// Será preenchida no fetchData

interface Professor {
  id: string;
  nome: string;
}
interface Materia {
  id: string;
  nome: string;
}
interface Vinculo {
  id: string;
  professorId: string;
  materiaId: string;
  turmaId: string;
}
interface Nota {
  id: string;
  turmaId: string;
  materiaId: string;
  bimestre: string;
  notaParcial: number;
  notaGlobal: number;
  notaParticipacao: number;
  notaRecuperacao?: number;
  alunoUid: string;
  nomeAluno: string;
  dataLancamento: string;
}

// Instanciar AlunoService
const alunoRepository = new FirebaseAlunoRepository();
const alunoService = new AlunoService(alunoRepository);

export default function Turmas() {
  const { anoLetivo, carregandoAnos, anosDisponiveis } = useAnoLetivoAtual();
  const authContext = useAuth();
  const userData = authContext?.userData;

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmasRematricula, setTurmasRematricula] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [turmaDetalhes, setTurmaDetalhes] = useState<Turma | null>(null);
  const [novaTurma, setNovaTurma] = useState('');
  // Removido estado local de anoLetivo, usar apenas o do context
  // Separar estado do turno para filtro e para o modal
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
          novasMedias[aluno.id] = await calcularMediaFinalAluno(aluno.id, anoLetivoRematricula);
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
        const [adminData, turmasDoAno, alunosSnap] = await Promise.all([
          loadAdminData(anoLetivo),
          turmaService.listarComVirtualizacao(anoLetivo.toString()),
          getDocs(collection(db, 'alunos'))
        ]);

        setTurmas(turmasDoAno.sort((a, b) => a.nome.localeCompare(b.nome)));
        setAlunos(alunosSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        setProfessores(adminData.professores);
        setMaterias(adminData.materias);
        setVinculos(adminData.vinculos);
      } else {
        const turmaIds = (userData?.turmas || []) as string[];

        const [profData, todasTurmas, alunosSnap, professoresList] = await Promise.all([
          loadProfessorData(userData!.uid, anoLetivo),
          turmaService.listarComVirtualizacao(anoLetivo.toString()),
          getDocs(collection(db, 'alunos')),
          loadProfessores() // para mapear nomes nas listagens de vínculos
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
        setAlunos(alunosSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        setProfessores(professoresList);
        setMaterias(profData.materias);
        setVinculos(profData.vinculos);
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
      const novaTurmaData = {
        nome: turma.nome,
        anoLetivo: anoLetivo.toString(),
        turno: turma.turno
      };

      const novaTurmaRef = await addDoc(collection(db, 'turmas'), novaTurmaData);

      // Copiar vínculos professor-matéria da turma original
      const vinculosOriginais = vinculos.filter(v => v.turmaId === turma.turmaOriginalId);

      for (const vinculo of vinculosOriginais) {
        await addDoc(collection(db, 'professores_materias'), {
          professorId: vinculo.professorId,
          materiaId: vinculo.materiaId,
          turmaId: novaTurmaRef.id
        });
      }

      // Marcar turma original como não virtualizável
      await updateDoc(doc(db, 'turmas', turma.turmaOriginalId!), {
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

  // Função para calcular status do aluno baseado nas notas finais
  const calcularStatusAluno = async (aluno: Aluno, anoParaCalculo: number = anoLetivo): Promise<string> => {
    try {
      const alunoUidParaBusca = aluno.id;

      // Obter a turma do aluno no ano letivo usando o histórico
      const turmaIdNoAno = getTurmaAlunoNoAnoUtil(aluno, anoParaCalculo);

      // Buscar todas as notas do aluno na turma do ano letivo atual
      const notasQuery = query(
        collection(db, 'notas'),
        where('alunoUid', '==', alunoUidParaBusca),
        where('turmaId', '==', turmaIdNoAno)
      );

      const notasSnap = await getDocs(notasQuery);
      const notasData = notasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Nota[];

      if (notasData.length === 0) {
        return 'Em Andamento'; // Sem notas = em andamento
      }

      // Agrupar notas por matéria e bimestre
      const notasPorMateriaBimestre: { [materia: string]: { [bimestre: string]: Nota } } = {};

      notasData.forEach(nota => {
        if (!notasPorMateriaBimestre[nota.materiaId]) {
          notasPorMateriaBimestre[nota.materiaId] = {};
        }
        notasPorMateriaBimestre[nota.materiaId][nota.bimestre] = nota;
      });

      // Verificar se tem notas dos 4 bimestres em pelo menos uma matéria
      const bimestresEsperados = ['1º', '2º', '3º', '4º'];
      let temTodasNotasDoAno = false;

      Object.values(notasPorMateriaBimestre).forEach(bimestres => {
        const bimestresPresentes = Object.keys(bimestres);
        const temTodosBimestres = bimestresEsperados.every(b => bimestresPresentes.includes(b));

        if (temTodosBimestres) {
          temTodasNotasDoAno = true;
        }
      });

      // Se não tem notas dos 4 bimestres, está "Em Andamento"
      if (!temTodasNotasDoAno) {
        return 'Em Andamento';
      }

      // Verificar se tem notas finais válidas em todas as matérias/bimestres
      let todasMediasFinais: number[] = [];
      let temNotaIncompleta = false;

      Object.values(notasPorMateriaBimestre).forEach(bimestres => {
        Object.values(bimestres).forEach(nota => {
          // Verificar se tem todas as 3 notas básicas OU nota de recuperação
          const temTresNotas =
            typeof nota.notaParcial === 'number' &&
            typeof nota.notaGlobal === 'number' &&
            typeof nota.notaParticipacao === 'number';

          const temRecuperacao = typeof nota.notaRecuperacao === 'number';

          if (temTresNotas || temRecuperacao) {
            // Calcular média final
            const mediaFinal = calcularMediaFinalUtil(nota);
            todasMediasFinais.push(mediaFinal);
          } else {
            temNotaIncompleta = true;
          }
        });
      });

      // Se tem nota incompleta, status é "Em Andamento"
      if (temNotaIncompleta) {
        return 'Em Andamento';
      }

      // Se não tem nenhuma média final calculada, também é "Em Andamento"
      if (todasMediasFinais.length === 0) {
        return 'Em Andamento';
      }

      // Calcular média geral do aluno
      const mediaGeral = todasMediasFinais.reduce((sum, nota) => sum + nota, 0) / todasMediasFinais.length;

      // Retornar status baseado na média geral
      return mediaGeral >= 6 ? 'Aprovado' : 'Reprovado';

    } catch (error) {
      console.error('Erro ao calcular status do aluno:', error);
      return 'Em Andamento';
    }
  };

  // Função para calcular status de todos os alunos da página atual
  const calcularStatusAlunosPaginaAtual = async (alunosVisiveis: Aluno[], anoParaCalculo: number = anoLetivo) => {
    const novosStatus = new Map<string, string>();

    // Calcular status em paralelo para melhor performance
    const promessas = alunosVisiveis.map(async (aluno) => {
      const status = await calcularStatusAluno(aluno, anoParaCalculo);
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

  // Função para calcular média final do aluno (soma de todas as médias finais / total de matérias)
  const calcularMediaFinalAluno = async (alunoId: string, anoParaCalculo: number = anoLetivo): Promise<number | null> => {
    try {
      const aluno = alunos.find(a => a.id === alunoId);
      if (!aluno) return null;

      const alunoUidParaBusca = aluno.id;
      const turmaIdNoAno = getTurmaAlunoNoAnoUtil(aluno, anoParaCalculo);

      // Buscar todas as notas do aluno na turma do ano letivo atual
      const notasSnap = await getDocs(query(
        collection(db, 'notas'),
        where('alunoUid', '==', alunoUidParaBusca),
        where('turmaId', '==', turmaIdNoAno)
      ));

      if (notasSnap.empty) return null;

      // Organizar notas por matéria e bimestre
      const notasPorMateria: Record<string, number[]> = {};
      notasSnap.docs.forEach(docSnap => {
        const data = docSnap.data() as Nota;
        const materiaId = data.materiaId;

        // Verificar se a nota tem dados válidos antes de calcular
        const temTresNotas =
          typeof data.notaParcial === 'number' &&
          typeof data.notaGlobal === 'number' &&
          typeof data.notaParticipacao === 'number';

        const temRecuperacao = typeof data.notaRecuperacao === 'number';

        // Só calcular média se tiver notas válidas
        if (temTresNotas || temRecuperacao) {
          const mediaFinal = calcularMediaFinalUtil(data);
          if (!notasPorMateria[materiaId]) notasPorMateria[materiaId] = [];
          if (mediaFinal !== null && mediaFinal !== undefined && !isNaN(mediaFinal)) {
            notasPorMateria[materiaId].push(mediaFinal);
          }
        }
      });

      // Calcular média final de cada matéria (média dos bimestres)
      const mediasFinaisMaterias: number[] = Object.values(notasPorMateria)
        .map(notas => notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : null)
        .filter((v): v is number => v !== null && !isNaN(v));

      if (mediasFinaisMaterias.length === 0) return null;

      // Média final do aluno = média das médias finais das matérias
      return parseFloat((mediasFinaisMaterias.reduce((a, b) => a + b, 0) / mediasFinaisMaterias.length).toFixed(1));
    } catch (error) {
      console.error('Erro ao calcular média final do aluno:', error);
      return null;
    }
  };

  // Estado para armazenar médias dos alunos
  const [mediasAlunos, setMediasAlunos] = useState<Record<string, number | null>>({});

  // (Médias são carregadas no useEffect consolidado acima junto com status e ações finalizadas)

  // Função auxiliar para materializar turma virtual
  const materializarTurmaVirtual = async (turmaIdOuObjeto: string | Turma): Promise<string> => {
    // Aceitar tanto ID quanto objeto turma
    let turmaVirtual: Turma | undefined;

    if (typeof turmaIdOuObjeto === 'string') {
      // Buscar primeiro nas turmas reais
      turmaVirtual = turmas.find(t => t.id === turmaIdOuObjeto);

      // Se não encontrou, buscar nas turmas virtualizadas geradas
      if (!turmaVirtual) {
        const turmasProximas = await getTurmasProximas();
        turmaVirtual = turmasProximas.find(t => t.id === turmaIdOuObjeto);
      }
    } else {
      turmaVirtual = turmaIdOuObjeto;
    }

    const turmaId = typeof turmaIdOuObjeto === 'string' ? turmaIdOuObjeto : turmaIdOuObjeto.id;

    if (!turmaVirtual) {
      return turmaId;
    }

    // Se não é virtual, retornar o próprio ID
    if (!isTurmaVirtualizada(turmaVirtual)) {
      return turmaId;
    }

    // Verificar se já existe uma turma real com o mesmo nome no ano atual
    const turmasReaisQuery = query(
      collection(db, 'turmas'),
      where('nome', '==', turmaVirtual.nome),
      where('anoLetivo', '==', turmaVirtual.anoLetivo)
    );

    const turmasReaisSnap = await getDocs(turmasReaisQuery);

    if (turmasReaisSnap.empty) {
      // Materializar a turma virtual usando o service
      const turmaRealId = await turmaService.materializarTurma(turmaVirtual);

      // Copiar vínculos professor-matéria da turma original
      const vinculosOriginaisQuery = query(
        collection(db, 'professores_materias'),
        where('turmaId', '==', turmaVirtual.turmaOriginalId)
      );

      const vinculosOriginaisSnap = await getDocs(vinculosOriginaisQuery);

      for (const vinculoDoc of vinculosOriginaisSnap.docs) {
        const vinculoData = vinculoDoc.data();
        await addDoc(collection(db, 'professores_materias'), {
          professorId: vinculoData.professorId,
          materiaId: vinculoData.materiaId,
          turmaId: turmaRealId
        });
      }

      // NOVO: Copiar documentos da agenda para o novo turmaId
      const agendasOriginaisQuery = query(
        collection(db, 'agenda'),
        where('turmaId', '==', turmaVirtual.turmaOriginalId)
      );

      const agendasOriginaisSnap = await getDocs(agendasOriginaisQuery);

      for (const agendaDoc of agendasOriginaisSnap.docs) {
        const agendaData = agendaDoc.data();
        await addDoc(collection(db, 'agenda'), {
          ...agendaData,
          turmaId: turmaRealId
        });
      }

      return turmaRealId;
    } else {
      // Turma real já existe, usar ela
      const turmaRealId = turmasReaisSnap.docs[0].id;
      return turmaRealId;
    }
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

  // Função para copiar notas e frequências de uma turma para outra
  const copiarNotasEFrequencias = async (aluno: Aluno, turmaOrigemId: string, turmaDestinoId: string) => {
    try {
      const alunoUidParaBusca = aluno.id;

      // 1. COPIAR NOTAS
      const notasQuery = query(
        collection(db, 'notas'),
        where('alunoUid', '==', alunoUidParaBusca),
        where('turmaId', '==', turmaOrigemId)
      );

      const notasSnap = await getDocs(notasQuery);

      for (const notaDoc of notasSnap.docs) {
        const notaData = notaDoc.data();

        // Criar nova nota com o turmaId da turma de destino
        const novaNota = {
          alunoUid: notaData.alunoUid,
          bimestre: notaData.bimestre,
          dataLancamento: notaData.dataLancamento,
          materiaId: notaData.materiaId,
          notaGlobal: notaData.notaGlobal,
          notaParcial: notaData.notaParcial,
          notaParticipacao: notaData.notaParticipacao,
          notaRecuperacao: notaData.notaRecuperacao,
          turmaId: turmaDestinoId, // Nova turma
          nomeAluno: notaData.nomeAluno || aluno.nome
        };

        await addDoc(collection(db, 'notas'), novaNota);
      }

      // 2. COPIAR FREQUÊNCIAS
      const frequenciasQuery = query(
        collection(db, 'frequencias'),
        where('alunoId', '==', aluno.id),
        where('turmaId', '==', turmaOrigemId)
      );

      const frequenciasSnap = await getDocs(frequenciasQuery);

      for (const freqDoc of frequenciasSnap.docs) {
        const freqData = freqDoc.data();

        // Criar nova frequência com o turmaId da turma de destino
        const novaFrequencia = {
          alunoId: freqData.alunoId,
          data: freqData.data,
          materiaId: freqData.materiaId,
          presenca: freqData.presenca,
          turmaId: turmaDestinoId // Nova turma
        };

        await addDoc(collection(db, 'frequencias'), novaFrequencia);
      }

      console.log(`✅ Notas e frequências copiadas para ${aluno.nome} - ${notasSnap.size} notas, ${frequenciasSnap.size} frequências`);

    } catch (error) {
      console.error('❌ Erro ao copiar notas e frequências:', error);
      // Não bloquear a transferência por erro na cópia
    }
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
            await copiarNotasEFrequencias(aluno, turmaAtualId, turmaDestinoId);

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
      // Usar o ID do aluno
      const alunoUidParaBusca = aluno.id;

      // Obter a turma do aluno no ano letivo selecionado (rematrícula) usando o histórico
      const turmaIdNoAno = getTurmaAlunoNoAnoUtil(aluno, anoLetivoRematricula);

      // Buscar as notas do aluno na turma do ano letivo atual
      const notasSnap = await getDocs(query(
        collection(db, 'notas'),
        where('alunoUid', '==', alunoUidParaBusca),
        where('turmaId', '==', turmaIdNoAno)
      ));

      if (notasSnap.docs.length === 0) {
        // Vamos tentar procurar por uid ou nome

        setHistoricoAluno({ nome: aluno.nome, notas: [] });
        setShowHistorico(true);
        return;
      }

      // Buscar todas as matérias para obter os nomes
      const materiasSnap = await getDocs(collection(db, 'materias'));
      const materiasMap = new Map();
      materiasSnap.docs.forEach(doc => {
        materiasMap.set(doc.id, doc.data().nome);
      });

      // Organizar notas por matéria e bimestre para criar matriz do boletim
      const notasPorMateriaBimestre: any = {};
      const materiasEncontradas = new Set();

      notasSnap.docs.forEach(docSnap => {
        const data = docSnap.data() as any;
        const materiaId = data.materiaId;
        const bimestre = data.bimestre;
        const nomeMateria = materiasMap.get(materiaId) || data.materiaId;

        materiasEncontradas.add(nomeMateria);

        if (!notasPorMateriaBimestre[bimestre]) {
          notasPorMateriaBimestre[bimestre] = {};
        }

        // Calcular média final
        const notaParcial = data.notaParcial;
        const notaGlobal = data.notaGlobal;
        const notaParticipacao = data.notaParticipacao;
        const notaRecuperacao = data.notaRecuperacao;

        let mediaFinal = null;

        // Verificar se tem todas as 3 notas básicas OU nota de recuperação (igual ao badge)
        const temTresNotas =
          typeof notaParcial === 'number' &&
          typeof notaGlobal === 'number' &&
          typeof notaParticipacao === 'number';

        const temRecuperacao = typeof notaRecuperacao === 'number';

        if (temTresNotas || temRecuperacao) {
          // Usar a mesma função do badge que já compara corretamente
          mediaFinal = calcularMediaFinalUtil(data);
        }

        notasPorMateriaBimestre[bimestre][nomeMateria] = {
          mediaFinal: mediaFinal
        };
      });


      // Preparar dados para o modal no formato de boletim
      const dadosBoletim = {
        materias: Array.from(materiasEncontradas).sort(),
        bimestres: ['1º', '2º', '3º', '4º'],
        notas: notasPorMateriaBimestre
      };

      setHistoricoAluno({
        nome: aluno.nome,
        notas: [], // Manter vazio, usaremos dadosBoletim
        dadosBoletim: dadosBoletim
      });
      setShowHistorico(true);
    } catch (error) {
      console.error('Erro ao buscar histórico de notas:', error);
      setToast({ show: true, message: 'Erro ao carregar histórico de notas', variant: 'danger' });
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
      await copiarNotasEFrequencias(alunoTransferencia, turmaOrigemId, turmaDestinoId);

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
