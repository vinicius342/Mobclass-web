import { useEffect, useState } from 'react';
import { useAnoLetivoAtual } from '../hooks/useAnoLetivoAtual';
import AppLayout from '../components/AppLayout';
import {
  Container, Table, Button, Modal, Form, Spinner, ToastContainer, Toast, Dropdown, Card
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { PlusCircle } from 'react-bootstrap-icons';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, documentId, getDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import Paginacao from '../components/Paginacao';
import { Users, BookOpen, User, Eye, Clock, CheckCircle2, Ghost, ArrowRight, ArrowLeftRight, CheckSquare, XSquare, BookText } from 'lucide-react';
import { Edit, Trash2, Check, X } from 'lucide-react';

interface Turma {
  id: string;
  nome: string;
  anoLetivo: string;
  turno: string;
  isVirtual?: boolean; // Para identificar se pode ser virtualizada (false impede virtualização)
  isVirtualizada?: boolean; // Para identificar turmas virtualizadas do ano anterior
  turmaOriginalId?: string; // ID da turma original quando virtualizada
}
interface Aluno {
  id: string;
  nome: string;
  turmaId: string;
  email?: string;
  uid?: string; // UID do Firebase Auth
  historicoTurmas?: { [anoLetivo: string]: string }; // Histórico de turmas por ano letivo
  historicoStatus?: { [anoLetivo: string]: 'promovido' | 'reprovado' | 'transferido' }; // Status de cada ano
}
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

export default function Turmas() {
  const { anoLetivo, carregandoAnos } = useAnoLetivoAtual();
  const authContext = useAuth();
  const userData = authContext?.userData;

  const [turmas, setTurmas] = useState<Turma[]>([]);
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

  // Estado para modal de rematrícula
  const [showRematricula, setShowRematricula] = useState(false);
  const [alunoRematricula, setAlunoRematricula] = useState<Aluno | null>(null);
  const [turmasDisponiveis, setTurmasDisponiveis] = useState<Turma[]>([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState<string>('');
  const [processandoRematricula, setProcessandoRematricula] = useState(false);

  // Estado para modal de confirmação de ações
  const [showModalConfirmacao, setShowModalConfirmacao] = useState(false);
  const [resumoDestinos, setResumoDestinos] = useState<{
    promovidos: { alunoNome: string; turmaDestino: string }[];
    reprovados: { alunoNome: string; turmaDestino: string }[];
    transferidos: { alunoNome: string; turmaDestino: string }[];
  }>({ promovidos: [], reprovados: [], transferidos: [] });

  // Estado para modal de transferência individual
  const [showModalTransferencia, setShowModalTransferencia] = useState(false);
  const [alunoTransferencia, setAlunoTransferencia] = useState<Aluno | null>(null);
  const [turmaDestinoTransferencia, setTurmaDestinoTransferencia] = useState<string>('');

  useEffect(() => {
    if (!userData || carregandoAnos) return;
    fetchData();
  }, [userData, carregandoAnos, anoLetivo]);

  // Sincronizar anoLetivoRematricula quando o contexto mudar
  useEffect(() => {
    setAnoLetivoRematricula(anoLetivo);
  }, [anoLetivo]);

  useEffect(() => {
    if (showModal) {
      setTimeout(() => {
        document.getElementById('input-nome-turma')?.focus();
      }, 100);
    }
  }, [showModal]);

  // Calcular status dos alunos quando a lista de alunos filtrados muda
  useEffect(() => {
    const alunosFiltrados = getAlunosFiltrados();
    if (alunosFiltrados.length > 0) {
      calcularStatusAlunosPaginaAtual(alunosFiltrados, anoLetivoRematricula);
    }
  }, [alunos, turmaFiltroRematricula, anoLetivoRematricula]);

  // Carregar ações finalizadas do Firebase
  useEffect(() => {
    const carregarAcoesFinalizadas = () => {
      const anoAtualStr = anoLetivo.toString();
      const novasAcoesFinalizadas: Record<string, 'promovido' | 'reprovado' | 'transferido'> = {};

      alunos.forEach(aluno => {
        if (aluno.historicoStatus && aluno.historicoStatus[anoAtualStr]) {
          novasAcoesFinalizadas[aluno.id] = aluno.historicoStatus[anoAtualStr];
        }
      });

      setAcaoFinalizada(novasAcoesFinalizadas);
    };

    if (alunos.length > 0) {
      carregarAcoesFinalizadas();
    }
  }, [alunos, anoLetivo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const anoAtual = anoLetivo.toString();
      const anoAnterior = (anoLetivo - 1).toString();

      // Buscar turmas do ano atual
      let turmasAtuaisSnap;
      if (userData && userData.tipo === 'administradores') {
        turmasAtuaisSnap = await getDocs(query(collection(db, 'turmas'), where('anoLetivo', '==', anoAtual)));
      } else {
        const turmaIds = userData?.turmas || [];
        if (turmaIds.length > 0) {
          const turmaQuery = query(
            collection(db, 'turmas'),
            where(documentId(), 'in', turmaIds),
            where('anoLetivo', '==', anoAtual)
          );
          turmasAtuaisSnap = await getDocs(turmaQuery);
        } else {
          turmasAtuaisSnap = { docs: [] };
        }
      }

      // Buscar turmas do ano anterior para virtualização
      let turmasAnoAnteriorSnap;
      if (userData && userData.tipo === 'administradores') {
        turmasAnoAnteriorSnap = await getDocs(query(collection(db, 'turmas'), where('anoLetivo', '==', anoAnterior)));
      } else {
        const turmaIds = userData?.turmas || [];
        if (turmaIds.length > 0) {
          const turmaQuery = query(
            collection(db, 'turmas'),
            where(documentId(), 'in', turmaIds),
            where('anoLetivo', '==', anoAnterior)
          );
          turmasAnoAnteriorSnap = await getDocs(turmaQuery);
        } else {
          turmasAnoAnteriorSnap = { docs: [] };
        }
      }

      // Buscar TODAS as turmas para popular o filtro de ano letivo na rematrícula
      let todasTurmasSnap;
      if (userData && userData.tipo === 'administradores') {
        todasTurmasSnap = await getDocs(collection(db, 'turmas'));
      } else {
        const turmaIds = userData?.turmas || [];
        if (turmaIds.length > 0) {
          const turmaQuery = query(
            collection(db, 'turmas'),
            where(documentId(), 'in', turmaIds)
          );
          todasTurmasSnap = await getDocs(turmaQuery);
        } else {
          todasTurmasSnap = { docs: [] };
        }
      }

      // Buscar dados adicionais
      const [alunosSnap, professoresSnap, materiasSnap, vinculosSnap] = await Promise.all([
        getDocs(collection(db, 'alunos')),
        getDocs(collection(db, 'professores')),
        getDocs(collection(db, 'materias')),
        getDocs(collection(db, 'professores_materias'))
      ]);

      // Processar turmas do ano atual
      const turmasAtuais = turmasAtuaisSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      // Processar turmas do ano anterior
      const turmasAnteriores = turmasAnoAnteriorSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      // Processar todas as turmas
      const todasTurmas = todasTurmasSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Turma[];

      // Verificar quais turmas do ano anterior podem ser virtualizadas
      const turmasVirtualizadas: Turma[] = [];

      for (const turmaAnterior of turmasAnteriores) {
        // Só virtualiza se isVirtual não for false E se não existe uma turma atual com o mesmo nome
        const podeVirtualizar = turmaAnterior.isVirtual !== false;
        const jaExisteAtual = turmasAtuais.some(t => t.nome === turmaAnterior.nome);

        if (podeVirtualizar && !jaExisteAtual) {
          turmasVirtualizadas.push({
            ...turmaAnterior,
            id: `virtual_${turmaAnterior.id}`, // ID único para turma virtualizada
            anoLetivo: anoAtual, // Mostra no ano atual
            isVirtualizada: true,
            turmaOriginalId: turmaAnterior.id
          });
        }
      }

      // Combinar todas as turmas reais + virtualizadas
      const turmasFinais = [...todasTurmas, ...turmasVirtualizadas].sort((a, b) => a.nome.localeCompare(b.nome));

      setTurmas(turmasFinais);
      setAlunos(alunosSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setProfessores(professoresSnap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
      setMaterias(materiasSnap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
      setVinculos(vinculosSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));

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
        await updateDoc(doc(db, 'turmas', editId), payload);
        setToast({ show: true, message: 'Turma atualizada com sucesso.', variant: 'success' });
      } else {
        await addDoc(collection(db, 'turmas'), payload);
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

    if (turma?.isVirtualizada && turma?.turmaOriginalId) {
      // É uma turma virtual - desativar virtualização da turma original
      if (!window.confirm('Deseja desativar a virtualização desta turma?')) return;

      try {
        await updateDoc(doc(db, 'turmas', turma.turmaOriginalId), {
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
        await deleteDoc(doc(db, 'turmas', id));
        setToast({ show: true, message: 'Turma excluída.', variant: 'success' });
        fetchData();
      } catch (error) {
        console.error(error);
        setToast({ show: true, message: 'Erro ao excluir turma.', variant: 'danger' });
      }
    }
  };

  const totalAlunos = (turmaId: string) => alunos.filter(a => getTurmaAlunoNoAno(a, anoLetivo) === turmaId).length;

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
        return { bg: '#dcfce7', color: '#166534' }; // verde suave
      case 'Reprovado':
        return { bg: '#fecaca', color: '#dc2626' }; // vermelho suave
      case 'Em Andamento':
        return { bg: '#fef3c7', color: '#d97706' }; // amarelo suave
      default:
        return { bg: '#f3f4f6', color: '#6b7280' }; // cinza
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
    if (turmaObj && turmaObj.isVirtualizada && turmaObj.turmaOriginalId) {
      targetTurmaId = turmaObj.turmaOriginalId;
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
      .filter(a => getTurmaAlunoNoAno(a, anoLetivo) === turmaId)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  };

  const handleMaterializarTurma = async (turma: Turma) => {
    if (!turma.isVirtualizada || !turma.turmaOriginalId) return;

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
      await updateDoc(doc(db, 'turmas', turma.turmaOriginalId), {
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
        getTurmaAlunoNoAno(aluno, anoLetivoRematricula) === turmaFiltroRematricula;
      return matchTurma;
    });
  };

  // Função para calcular média final das notas
  const calcularMediaFinal = (nota: Nota) => {
    const { notaParcial, notaGlobal, notaParticipacao, notaRecuperacao } = nota;
    let media = 0;
    let count = 0;
    if (typeof notaParcial === 'number') { media += notaParcial; count++; }
    if (typeof notaGlobal === 'number') { media += notaGlobal; count++; }
    if (typeof notaParticipacao === 'number') { media += notaParticipacao; count++; }
    if (count > 0) media = media / count;
    if (typeof notaRecuperacao === 'number') {
      media = Math.max(media, notaRecuperacao);
    }
    return Math.round(media * 100) / 100;
  };

  // Função para obter cor da nota
  const getNotaColor = (valor: number | undefined) => {
    if (typeof valor !== 'number') return '';
    if (valor >= 9) return 'text-success';
    if (valor >= 6) return 'text-warning';
    return 'text-danger';
  };

  // Função para calcular status do aluno baseado nas notas finais
  const calcularStatusAluno = async (aluno: Aluno, anoParaCalculo: number = anoLetivo): Promise<string> => {
    try {
      const alunoUidParaBusca = aluno.uid || aluno.id;

      // Obter a turma do aluno no ano letivo usando o histórico
      const turmaIdNoAno = getTurmaAlunoNoAno(aluno, anoParaCalculo);

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
            const mediaFinal = calcularMediaFinal(nota);
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
  const getStatusBadge = (alunoId: string) => {
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

  // Função para extrair número da série (sem sufixo)
  const extrairNumeroSerie = (nomeTurma: string): number => {
    // Extrair apenas o número da série (1, 2, 3, 6, 7, 8, 9)
    const match = nomeTurma.match(/^(\d+)/);
    if (match) {
      const numero = parseInt(match[1]);
      return numero;
    }

    return 0;
  };

  // Função para obter turmas do próximo ano (reais + virtualizadas)
  const getTurmasProximas = (): Turma[] => {
    if (!turmaFiltroRematricula) return [];

    const anoAtualNum = parseInt(anoLetivoRematricula.toString());
    const anoProximoNum = anoAtualNum + 1;
    const anoProximoStr = anoProximoNum.toString();
    const anoAtualStr = anoLetivoRematricula.toString();

    // Turmas reais do próximo ano (aquelas que têm anoLetivo do próximo ano e NÃO são virtualizadas localmente)
    const turmasReaisProximoAno = turmas.filter(t =>
      t.anoLetivo === anoProximoStr && t.isVirtualizada !== true
    );

    // Turmas do ano atual que podem ser virtualizadas para o próximo ano
    const turmasAtuais = turmas.filter(t =>
      t.anoLetivo === anoAtualStr && t.isVirtualizada !== true
    );

    const turmasVirtualizadasProximoAno: Turma[] = [];

    for (const turmaAtual of turmasAtuais) {
      // Pode virtualizar se isVirtual não for false E se não existe turma real com mesmo nome no próximo ano
      const podeVirtualizar = turmaAtual.isVirtual !== false;
      const jaExisteNoProximoAno = turmasReaisProximoAno.some(t => t.nome === turmaAtual.nome);

      if (podeVirtualizar && !jaExisteNoProximoAno) {
        turmasVirtualizadasProximoAno.push({
          ...turmaAtual,
          id: `virtual_proximo_${turmaAtual.id}`,
          anoLetivo: anoProximoStr,
          isVirtualizada: true,
          turmaOriginalId: turmaAtual.id
        });
      }
    }

    // Combinar turmas reais + virtualizadas e ordenar
    const resultado = [...turmasReaisProximoAno, ...turmasVirtualizadasProximoAno]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));

    return resultado;
  };

  // Função para obter turmas do ano atual (para transferência)
  const getTurmasAnoAtual = (): Turma[] => {
    const anoAtualStr = anoLetivoRematricula.toString();

    // Filtrar turmas do ano atual (reais, não virtualizadas)
    const turmasAnoAtual = turmas.filter(t =>
      t.anoLetivo === anoAtualStr && t.isVirtualizada !== true
    );

    return turmasAnoAtual.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  };

  // Função para extrair série completa (com sufixo)
  const extrairSerieDaTurma = (nomeTurma: string): string => {
    // Exemplos: "1º A", "2º B", "3º C", "6ª Ano B" -> extrai "1º", "2º", "3º", "6ª"
    const patterns = [
      /^(\d+º)/,     // 1º, 2º, 3º
      /^(\d+ª)/,     // 6ª, 7ª, 8ª, 9ª
      /^(\d+)/       // Fallback: apenas o número
    ];

    for (const pattern of patterns) {
      const match = nomeTurma.match(pattern);
      if (match) {
        const serie = match[1];
        return serie;
      }
    }

    return '';
  };

  // Função para calcular média final do aluno (soma de todas as médias finais / total de matérias)
  const calcularMediaFinalAluno = async (alunoId: string, anoParaCalculo: number = anoLetivo): Promise<number | null> => {
    try {
      const aluno = alunos.find(a => a.id === alunoId);
      if (!aluno) return null;

      const alunoUidParaBusca = aluno.uid || aluno.id;
      const turmaIdNoAno = getTurmaAlunoNoAno(aluno, anoParaCalculo);

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
          const mediaFinal = calcularMediaFinal(data);
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

  // Buscar médias dos alunos quando a lista muda
  useEffect(() => {
    const carregarMedias = async () => {
      const alunosFiltrados = getAlunosFiltrados();
      const novasMedias: Record<string, number | null> = {};

      for (const aluno of alunosFiltrados) {
        novasMedias[aluno.id] = await calcularMediaFinalAluno(aluno.id, anoLetivoRematricula);
      }

      setMediasAlunos(novasMedias);
    };

    if (turmaFiltroRematricula) {
      carregarMedias();
    }
  }, [turmaFiltroRematricula, alunos, anoLetivoRematricula]);

  // Função para executar a rematrícula
  const executarRematricula = async () => {
    if (!alunoRematricula || !turmaSelecionada) {
      alert('Selecione uma turma para rematrícula');
      return;
    }

    setProcessandoRematricula(true);

    try {
      let turmaFinalId = turmaSelecionada;

      // Verificar se a turma selecionada é virtual
      const turmaVirtual = turmasDisponiveis.find(t => t.id === turmaSelecionada);

      if (turmaVirtual?.isVirtualizada && turmaVirtual.turmaOriginalId) {
        // Verificar se já existe uma turma real com o mesmo nome no ano atual
        const turmasReaisQuery = query(
          collection(db, 'turmas'),
          where('nome', '==', turmaVirtual.nome),
          where('anoLetivo', '==', turmaVirtual.anoLetivo)
        );

        const turmasReaisSnap = await getDocs(turmasReaisQuery);

        if (turmasReaisSnap.empty) {
          // Materializar a turma virtual

          const novaTurmaData = {
            nome: turmaVirtual.nome,
            anoLetivo: turmaVirtual.anoLetivo,
            turno: turmaVirtual.turno
          };

          const novaTurmaRef = await addDoc(collection(db, 'turmas'), novaTurmaData);
          turmaFinalId = novaTurmaRef.id;

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
              turmaId: turmaFinalId
            });
          }

          // Marcar turma original como não virtualizável
          await updateDoc(doc(db, 'turmas', turmaVirtual.turmaOriginalId), {
            isVirtual: false
          });
        } else {
          // Turma real já existe, usar ela
          turmaFinalId = turmasReaisSnap.docs[0].id;
        }
      }

      // Atualizar o documento do aluno com a nova turmaId
      const alunoRef = doc(db, 'alunos', alunoRematricula.id);

      // Buscar dados atuais do aluno para preservar histórico
      const alunoDoc = await getDoc(alunoRef);
      const alunoData = alunoDoc.data();

      // Criar ou atualizar histórico de turmas
      const historicoTurmas = alunoData?.historicoTurmas || {};

      // IMPORTANTE: Preservar a turma atual no histórico do ano letivo atual
      const anoLetivoAtualStr = anoLetivo.toString();
      if (!historicoTurmas[anoLetivoAtualStr]) {
        // Se ainda não tem histórico do ano atual, salvar a turma atual
        historicoTurmas[anoLetivoAtualStr] = alunoData?.turmaId || alunoRematricula.turmaId;
      }

      // Adicionar a nova turma no histórico do ano letivo de destino
      const anoLetivoTurmaDestino = (turmaVirtual?.anoLetivo || (anoLetivo + 1)).toString();
      historicoTurmas[anoLetivoTurmaDestino] = turmaFinalId;

      // Atualizar documento do aluno
      await updateDoc(alunoRef, {
        turmaId: turmaFinalId, // Manter compatibilidade (turma mais recente)
        historicoTurmas: historicoTurmas, // Histórico completo por ano letivo
        ultimaAtualizacao: new Date()
      });

      // Fechar modal e atualizar dados
      setShowRematricula(false);
      setAlunoRematricula(null);
      setTurmaSelecionada('');

      // Recarregar dados
      await fetchData();

      alert('Rematrícula realizada com sucesso!');

    } catch (error) {
      console.error('Erro ao executar rematrícula:', error);
      alert('Erro ao executar rematrícula');
    } finally {
      setProcessandoRematricula(false);
    }
  };

  // Função para fechar modal de rematrícula
  const fecharModalRematricula = () => {
    setShowRematricula(false);
    setAlunoRematricula(null);
    setTurmaSelecionada('');
    setTurmasDisponiveis([]);
  };

  // Função auxiliar para materializar turma virtual
  const materializarTurmaVirtual = async (turmaIdOuObjeto: string | Turma): Promise<string> => {
    // Aceitar tanto ID quanto objeto turma
    const turmaVirtual = typeof turmaIdOuObjeto === 'string'
      ? turmas.find(t => t.id === turmaIdOuObjeto)
      : turmaIdOuObjeto;

    const turmaId = typeof turmaIdOuObjeto === 'string' ? turmaIdOuObjeto : turmaIdOuObjeto.id;

    console.log(`🔄 Verificando se turma ${turmaId} precisa ser materializada...`);

    if (!turmaVirtual) {
      console.log(`❌ Turma ${turmaId} não encontrada`);
      return turmaId;
    }

    // Se não é virtual, retornar o próprio ID
    if (!turmaVirtual.isVirtualizada || !turmaVirtual.turmaOriginalId) {
      console.log(`ℹ️ Turma ${turmaVirtual.nome} não é virtual - usando diretamente`);
      return turmaId;
    }

    console.log(`🔄 Turma ${turmaVirtual.nome} é VIRTUAL - materializando...`);

    // Verificar se já existe uma turma real com o mesmo nome no ano atual
    const turmasReaisQuery = query(
      collection(db, 'turmas'),
      where('nome', '==', turmaVirtual.nome),
      where('anoLetivo', '==', turmaVirtual.anoLetivo)
    );

    const turmasReaisSnap = await getDocs(turmasReaisQuery);

    if (turmasReaisSnap.empty) {
      // Materializar a turma virtual
      console.log(`📝 Criando turma real: ${turmaVirtual.nome}`);

      const novaTurmaData = {
        nome: turmaVirtual.nome,
        anoLetivo: turmaVirtual.anoLetivo,
        turno: turmaVirtual.turno
      };

      const novaTurmaRef = await addDoc(collection(db, 'turmas'), novaTurmaData);
      const turmaRealId = novaTurmaRef.id;

      console.log(`✅ Turma real criada com ID: ${turmaRealId}`);

      // Copiar vínculos professor-matéria da turma original
      console.log(`🔗 Copiando vínculos da turma original: ${turmaVirtual.turmaOriginalId}`);

      const vinculosOriginaisQuery = query(
        collection(db, 'professores_materias'),
        where('turmaId', '==', turmaVirtual.turmaOriginalId)
      );

      const vinculosOriginaisSnap = await getDocs(vinculosOriginaisQuery);
      console.log(`📋 Vínculos encontrados: ${vinculosOriginaisSnap.docs.length}`);

      for (const vinculoDoc of vinculosOriginaisSnap.docs) {
        const vinculoData = vinculoDoc.data();
        await addDoc(collection(db, 'professores_materias'), {
          professorId: vinculoData.professorId,
          materiaId: vinculoData.materiaId,
          turmaId: turmaRealId
        });
      }

      console.log(`✅ Vínculos copiados com sucesso`);

      // NOVO: Copiar documentos da agenda para o novo turmaId
      console.log(`📚 Copiando aulas (agenda) para o novo turmaId: ${turmaRealId}`);
      
      const agendasOriginaisQuery = query(
        collection(db, 'agenda'),
        where('turmaId', '==', turmaVirtual.turmaOriginalId)
      );

      const agendasOriginaisSnap = await getDocs(agendasOriginaisQuery);
      console.log(`📋 Aulas encontradas: ${agendasOriginaisSnap.docs.length}`);

      for (const agendaDoc of agendasOriginaisSnap.docs) {
        const agendaData = agendaDoc.data();
        await addDoc(collection(db, 'agenda'), {
          ...agendaData,
          turmaId: turmaRealId
        });
      }

      console.log(`✅ Aulas copiadas com sucesso`);

      // Marcar turma original como não virtualizável
      await updateDoc(doc(db, 'turmas', turmaVirtual.turmaOriginalId), {
        isVirtual: false
      });

      console.log(`✅ Turma original marcada como não virtualizável`);

      return turmaRealId;
    } else {
      // Turma real já existe, usar ela
      const turmaRealId = turmasReaisSnap.docs[0].id;
      console.log(`✅ Turma real já existe com ID: ${turmaRealId}`);
      return turmaRealId;
    }
  };

  // Função para abrir modal de confirmação
  const handleAbrirModalConfirmacao = () => {
    console.log('🔘 BOTÃO CONFIRMAR AÇÕES CLICADO');

    const alunosComAcao = Object.keys(statusPromocao).filter(
      alunoId => statusPromocao[alunoId] !== null || alunosTransferencia[alunoId]
    );

    console.log('📋 Verificando ações selecionadas...');
    console.log('   statusPromocao:', statusPromocao);
    console.log('   alunosTransferencia:', alunosTransferencia);
    console.log('   alunosComAcao:', alunosComAcao);
    console.log('   proximaTurma:', proximaTurma);

    if (alunosComAcao.length === 0) {
      console.log('⚠️ Nenhuma ação selecionada - mostrando toast');
      setToast({ show: true, message: 'Nenhuma ação selecionada', variant: 'danger' });
      return;
    }

    // Verificar se próxima turma está selecionada (exceto para reprovados)
    const temPromovido = alunosComAcao.some(id => statusPromocao[id] === 'promovido');
    const temTransferido = Object.keys(alunosTransferencia).length > 0;

    console.log('🔍 Validações:');
    console.log('   temPromovido:', temPromovido);
    console.log('   temTransferido:', temTransferido);

    if ((temPromovido || temTransferido) && !proximaTurma) {
      console.log('⚠️ Próxima turma não selecionada - mostrando toast');
      setToast({ show: true, message: 'Selecione a próxima turma antes de confirmar', variant: 'danger' });
      return;
    }

    // NOVA VALIDAÇÃO: Se tem promovido, validar que próxima turma é maior que a atual
    if (temPromovido && proximaTurma && turmaFiltroRematricula) {
      const turmaAtual = turmas.find(t => t.id === turmaFiltroRematricula);

      // Buscar turma próxima (pode ser real ou virtual gerada dinamicamente)
      let turmaProxima = turmas.find(t => t.id === proximaTurma);

      // Se não encontrou, pode ser uma turma virtual - buscar nas turmas geradas
      if (!turmaProxima) {
        const turmasProximas = getTurmasProximas();
        turmaProxima = turmasProximas.find(t => t.id === proximaTurma);
      }

      console.log('🔍 Validando série da próxima turma:');
      console.log('   turmaAtual:', turmaAtual?.nome, '- Ano:', turmaAtual?.anoLetivo);
      console.log('   turmaProxima:', turmaProxima?.nome, '- Ano:', turmaProxima?.anoLetivo, '- Virtual:', turmaProxima?.isVirtualizada);

      if (turmaAtual && turmaProxima) {
        const serieAtual = extrairNumeroSerie(turmaAtual.nome);
        const serieProxima = extrairNumeroSerie(turmaProxima.nome);

        console.log('   serieAtual:', serieAtual);
        console.log('   serieProxima:', serieProxima);

        // VALIDAÇÃO: Para promover, a série da próxima turma DEVE ser maior
        if (serieProxima <= serieAtual) {
          console.log('⚠️ Bloqueando: série próxima não é superior à atual');
          setToast({
            show: true,
            message: 'Para promover alunos, a próxima turma deve ser de uma série superior à atual',
            variant: 'danger'
          });
          return;
        }

        console.log('✅ Validação de série passou - série próxima é superior');
      }
    }

    // Calcular resumo de destinos
    const promovidos: { alunoNome: string; turmaDestino: string }[] = [];
    const reprovados: { alunoNome: string; turmaDestino: string }[] = [];
    const transferidos: { alunoNome: string; turmaDestino: string }[] = [];

    const anoProximoStr = (anoLetivoRematricula + 1).toString();
    const anoAtualStr = anoLetivoRematricula.toString();

    alunosComAcao.forEach(alunoId => {
      const aluno = alunos.find(a => a.id === alunoId);
      if (!aluno) return;

      // Promovidos
      if (statusPromocao[alunoId] === 'promovido' && proximaTurma) {
        const turmaDestino = turmas.find(t => t.id === proximaTurma);
        promovidos.push({
          alunoNome: aluno.nome,
          turmaDestino: turmaDestino?.nome || 'Desconhecida'
        });
      }

      // Reprovados
      if (statusPromocao[alunoId] === 'reprovado') {
        const turmaAtualAluno = turmas.find(t => t.id === getTurmaAlunoNoAno(aluno, anoLetivo));
        const nomeAtualAluno = turmaAtualAluno?.nome || '';

        // Gerar turmas virtualizadas (mesmo código da confirmação)
        const turmasReaisProximoAno = turmas.filter(t => t.anoLetivo === anoProximoStr && t.isVirtualizada !== true);
        const turmasAtuais = turmas.filter(t => t.anoLetivo === anoAtualStr && t.isVirtualizada !== true);

        const turmasVirtualizadasProximoAno: Turma[] = [];
        for (const turmaAtual of turmasAtuais) {
          const podeVirtualizar = turmaAtual.isVirtual !== false;
          const jaExisteNoProximoAno = turmasReaisProximoAno.some(t => t.nome === turmaAtual.nome);

          if (podeVirtualizar && !jaExisteNoProximoAno) {
            turmasVirtualizadasProximoAno.push({
              ...turmaAtual,
              id: `virtual_proximo_${turmaAtual.id}`,
              anoLetivo: anoProximoStr,
              isVirtualizada: true,
              turmaOriginalId: turmaAtual.id
            });
          }
        }

        const todasTurmasProximoAno = [...turmasReaisProximoAno, ...turmasVirtualizadasProximoAno];
        const serieAtual = extrairNumeroSerie(turmaAtualAluno?.nome || '');
        const turmasMesmaSerie = todasTurmasProximoAno.filter(t => extrairNumeroSerie(t.nome) === serieAtual);
        const turmaDestino = turmasMesmaSerie.find(t => t.nome === nomeAtualAluno) || turmasMesmaSerie[0];

        reprovados.push({
          alunoNome: aluno.nome,
          turmaDestino: turmaDestino?.nome || 'Desconhecida'
        });
      }

      // Transferidos
      if (alunosTransferencia[alunoId]) {
        const turmaDestino = turmas.find(t => t.id === alunosTransferencia[alunoId]);
        transferidos.push({
          alunoNome: aluno.nome,
          turmaDestino: turmaDestino?.nome || 'Desconhecida'
        });
      }
    });

    setResumoDestinos({ promovidos, reprovados, transferidos });

    console.log('✅ Todas validações passaram - abrindo modal de confirmação');
    setShowModalConfirmacao(true);
  };  // Função para confirmar ações de promoção, reprovação e transferência
  const handleConfirmarAcoes = async () => {
    try {
      console.log('🚀 INICIANDO handleConfirmarAcoes');
      setShowModalConfirmacao(false);

      const alunosComAcao = Object.keys(statusPromocao).filter(
        alunoId => statusPromocao[alunoId] !== null || alunosTransferencia[alunoId]
      );

      console.log('📋 Alunos com ação:', alunosComAcao);
      console.log('📊 statusPromocao:', statusPromocao);
      console.log('🔄 alunosTransferencia:', alunosTransferencia);
      console.log('🎯 proximaTurma:', proximaTurma);

      if (alunosComAcao.length === 0) {
        console.log('⚠️ Nenhum aluno com ação definida');
        return;
      }

      const anoAtualStr = anoLetivo.toString();
      const anoProximoStr = (anoLetivo + 1).toString();
      console.log(`📅 Ano atual: ${anoAtualStr}, Ano próximo: ${anoProximoStr}`);

      // Processar cada aluno
      for (const alunoId of alunosComAcao) {
        console.log(`\n🔍 ====== PROCESSANDO ALUNO ${alunoId} ======`);

        const aluno = alunos.find(a => a.id === alunoId);
        if (!aluno) {
          console.log(`❌ Aluno ${alunoId} não encontrado na lista`);
          continue;
        }

        console.log(`👤 Aluno encontrado: ${aluno.nome}`);

        const alunoRef = doc(db, 'alunos', alunoId);
        const alunoDoc = await getDoc(alunoRef);

        if (!alunoDoc.exists()) {
          console.log(`❌ Documento do aluno ${alunoId} não existe no Firestore`);
          continue;
        }

        console.log(`✅ Documento do aluno existe no Firestore`);

        const alunoData = alunoDoc.data();
        console.log(`📄 Dados atuais do aluno:`, alunoData);

        const historicoTurmas = alunoData?.historicoTurmas || {};
        const historicoStatus = alunoData?.historicoStatus || {};

        console.log(`📚 Histórico de turmas atual:`, historicoTurmas);
        console.log(`📊 Histórico de status atual:`, historicoStatus);


        // Se for transferência
        if (alunosTransferencia[alunoId]) {
          console.log(`🔄 TRANSFERÊNCIA detectada para aluno ${alunoId}`);
          const turmaDestinoIdOriginal = alunosTransferencia[alunoId];
          console.log(`🎯 Turma destino ID (original): ${turmaDestinoIdOriginal}`);

          // MATERIALIZAR TURMA VIRTUAL SE NECESSÁRIO
          const turmaDestinoId = await materializarTurmaVirtual(turmaDestinoIdOriginal);
          console.log(`🎯 Turma destino ID (após materialização): ${turmaDestinoId}`);

          const turmaDestino = turmas.find(t => t.id === turmaDestinoIdOriginal);

          if (turmaDestino) {
            console.log(`✅ Turma destino encontrada: ${turmaDestino.nome}`);
            console.log(`   isVirtualizada: ${turmaDestino.isVirtualizada}`);

            const turmaAtualAluno = turmas.find(t => t.id === getTurmaAlunoNoAno(aluno, anoLetivo));
            const serieAtual = extrairNumeroSerie(turmaAtualAluno?.nome || '');
            const serieDestino = extrairNumeroSerie(turmaDestino.nome);

            console.log(`📊 Série atual: ${serieAtual}, Série destino: ${serieDestino}`);

            // Verificar se é série superior (não permitido para transferência)
            if (serieDestino > serieAtual + 1) {
              console.log(`❌ Transferência bloqueada: série destino muito superior`);
              setToast({ show: true, message: `Aluno ${aluno.nome} não pode ser transferido para série superior`, variant: 'danger' });
              continue;
            }

            // IMPORTANTE: Preservar a turma atual no histórico do ano atual
            const turmaAtualId = getTurmaAlunoNoAno(aluno, anoLetivo);
            console.log(`📚 Turma atual do aluno: ${turmaAtualId}`);

            if (!historicoTurmas[anoAtualStr]) {
              historicoTurmas[anoAtualStr] = turmaAtualId;
              console.log(`✅ Salvando turma atual no histórico de ${anoAtualStr}`);
            } else {
              console.log(`ℹ️ Histórico de ${anoAtualStr} já existe`);
            }

            // Adicionar a turma de destino no histórico do ano da turma de destino (USAR TURMA MATERIALIZADA)
            historicoTurmas[turmaDestino.anoLetivo] = turmaDestinoId;
            historicoStatus[anoAtualStr] = 'transferido';

            console.log(`📚 Histórico de turmas atualizado:`, historicoTurmas);
            console.log(`📊 Histórico de status atualizado:`, historicoStatus);

            const updateData = {
              turmaId: turmaDestinoId, // USAR TURMA MATERIALIZADA
              historicoTurmas: historicoTurmas,
              historicoStatus: historicoStatus,
              ultimaAtualizacao: new Date()
            };

            console.log(`💾 Dados que serão salvos no Firestore:`, updateData);

            await updateDoc(alunoRef, updateData);

            console.log(`✅ Documento atualizado no Firestore com sucesso!`);

            setAcaoFinalizada(prev => ({ ...prev, [alunoId]: 'transferido' }));
          } else {
            console.log(`❌ Turma destino não encontrada`);
          }
        }
        // Se for promoção
        else if (statusPromocao[alunoId] === 'promovido') {
          console.log(`✅ PROMOÇÃO detectada para aluno ${alunoId}`);
          console.log(`🎯 Próxima turma ID (original): ${proximaTurma}`);

          if (!proximaTurma) {
            console.log(`❌ Próxima turma não selecionada - abortando promoção`);
            continue;
          }

          // MATERIALIZAR TURMA VIRTUAL SE NECESSÁRIO
          const turmaDestinoId = await materializarTurmaVirtual(proximaTurma);
          console.log(`🎯 Turma destino ID (após materialização): ${turmaDestinoId}`);

          const turmaDestino = turmas.find(t => t.id === proximaTurma);
          if (turmaDestino) {
            console.log(`✅ Turma destino encontrada: ${turmaDestino.nome}`);
            console.log(`   isVirtualizada: ${turmaDestino.isVirtualizada}`);

            // IMPORTANTE: Preservar a turma atual no histórico do ano atual
            const turmaAtualId = getTurmaAlunoNoAno(aluno, anoLetivo);
            console.log(`📚 Turma atual do aluno: ${turmaAtualId}`);

            if (!historicoTurmas[anoAtualStr]) {
              historicoTurmas[anoAtualStr] = turmaAtualId;
              console.log(`✅ Salvando turma atual no histórico de ${anoAtualStr}`);
            } else {
              console.log(`ℹ️ Histórico de ${anoAtualStr} já existe:`, historicoTurmas[anoAtualStr]);
            }

            // Adicionar a nova turma no histórico do ano seguinte (USAR TURMA MATERIALIZADA)
            historicoTurmas[anoProximoStr] = turmaDestinoId;
            historicoStatus[anoAtualStr] = 'promovido';

            console.log(`📚 Histórico de turmas atualizado:`, historicoTurmas);
            console.log(`📊 Histórico de status atualizado:`, historicoStatus);

            const updateData = {
              turmaId: turmaDestinoId, // USAR TURMA MATERIALIZADA
              historicoTurmas: historicoTurmas,
              historicoStatus: historicoStatus,
              ultimaAtualizacao: new Date()
            };

            console.log(`💾 Dados que serão salvos no Firestore:`, updateData);

            await updateDoc(alunoRef, updateData);

            console.log(`✅ Documento atualizado no Firestore com sucesso!`);

            setAcaoFinalizada(prev => ({ ...prev, [alunoId]: 'promovido' }));
          } else {
            console.log(`❌ Turma destino não encontrada para ID ${proximaTurma}`);
          }
        }
        // Se for reprovação
        else if (statusPromocao[alunoId] === 'reprovado') {
          console.log(`❌ REPROVAÇÃO detectada para aluno ${alunoId}`);

          // Para reprovados: sempre buscar turma da mesma série no ano seguinte
          const turmaAtualAluno = turmas.find(t => t.id === getTurmaAlunoNoAno(aluno, anoLetivo));
          const serieAtual = extrairNumeroSerie(turmaAtualAluno?.nome || '');
          console.log(`📊 Turma atual: ${turmaAtualAluno?.nome}, Série: ${serieAtual}`);

          // GERAR TURMAS VIRTUALIZADAS PARA O ANO SEGUINTE
          const turmasReaisProximoAno = turmas.filter(t =>
            t.anoLetivo === anoProximoStr && t.isVirtualizada !== true
          );

          const turmasAtuais = turmas.filter(t =>
            t.anoLetivo === anoAtualStr && t.isVirtualizada !== true
          );

          const turmasVirtualizadasProximoAno: Turma[] = [];

          for (const turmaAtual of turmasAtuais) {
            const podeVirtualizar = turmaAtual.isVirtual !== false;
            const jaExisteNoProximoAno = turmasReaisProximoAno.some(t => t.nome === turmaAtual.nome);

            if (podeVirtualizar && !jaExisteNoProximoAno) {
              turmasVirtualizadasProximoAno.push({
                ...turmaAtual,
                id: `virtual_proximo_${turmaAtual.id}`,
                anoLetivo: anoProximoStr,
                isVirtualizada: true,
                turmaOriginalId: turmaAtual.id
              });
            }
          }

          // Combinar turmas reais + virtualizadas do próximo ano
          const todasTurmasProximoAno = [...turmasReaisProximoAno, ...turmasVirtualizadasProximoAno];

          // Buscar turma da mesma série no ano seguinte (incluindo virtuais)
          const turmasMesmaSerie = todasTurmasProximoAno.filter(t =>
            extrairNumeroSerie(t.nome) === serieAtual
          );
          console.log(`🔍 Turmas da mesma série encontradas:`, turmasMesmaSerie.map(t => `${t.nome} (${t.isVirtualizada ? 'Virtual' : 'Real'})`));

          if (turmasMesmaSerie.length === 0) {
            console.log(`❌ Nenhuma turma destino encontrada para reprovado`);
            setToast({ show: true, message: `Nenhuma turma da mesma série encontrada para ${aluno.nome}`, variant: 'danger' });
            continue;
          }

          // Buscar turma com MESMO NOME exato, senão qualquer uma da mesma série
          const nomeAtualAluno = turmaAtualAluno?.nome || '';
          const turmaDestino = turmasMesmaSerie.find(t => t.nome === nomeAtualAluno) || turmasMesmaSerie[0];

          console.log(`✅ Usando turma: ${turmaDestino.nome} (${turmaDestino.isVirtualizada ? 'Virtual - será materializada' : 'Real'})`);

          // MATERIALIZAR TURMA VIRTUAL SE NECESSÁRIO (passar objeto completo)
          console.log(`🎯 Turma destino ID (antes de materializar): ${turmaDestino.id}`);
          const turmaDestinoIdFinal = await materializarTurmaVirtual(turmaDestino);
          console.log(`🎯 Turma destino ID (após materialização): ${turmaDestinoIdFinal}`);

          // IMPORTANTE: Preservar a turma atual no histórico do ano atual
          const turmaAtualId = getTurmaAlunoNoAno(aluno, anoLetivo);
          console.log(`📚 Turma atual do aluno: ${turmaAtualId}`);

          if (!historicoTurmas[anoAtualStr]) {
            historicoTurmas[anoAtualStr] = turmaAtualId;
            console.log(`✅ Salvando turma atual no histórico de ${anoAtualStr}`);
          } else {
            console.log(`ℹ️ Histórico de ${anoAtualStr} já existe`);
          }

          // Adicionar a turma de destino no histórico do ano seguinte (USAR TURMA MATERIALIZADA)
          historicoTurmas[anoProximoStr] = turmaDestinoIdFinal;
          historicoStatus[anoAtualStr] = 'reprovado';

          console.log(`📚 Histórico de turmas atualizado:`, historicoTurmas);
          console.log(`📊 Histórico de status atualizado:`, historicoStatus);

          const updateData = {
            turmaId: turmaDestinoIdFinal, // USAR TURMA MATERIALIZADA
            historicoTurmas: historicoTurmas,
            historicoStatus: historicoStatus,
            ultimaAtualizacao: new Date()
          };

          console.log(`💾 Dados que serão salvos no Firestore:`, updateData);

          await updateDoc(alunoRef, updateData);

          console.log(`✅ Documento atualizado no Firestore com sucesso!`);

          setAcaoFinalizada(prev => ({ ...prev, [alunoId]: 'reprovado' }));
        }
      }

      console.log(`\n🎉 ====== PROCESSAMENTO CONCLUÍDO ======`);
      console.log(`✅ Total de alunos processados: ${alunosComAcao.length}`);

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
      // Usar o UID do aluno (campo uid) em vez do ID do documento
      const alunoUidParaBusca = aluno.uid || aluno.id;

      // Obter a turma do aluno no ano letivo selecionado (rematrícula) usando o histórico
      const turmaIdNoAno = getTurmaAlunoNoAno(aluno, anoLetivoRematricula);

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
          mediaFinal = calcularMediaFinal(data);
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
  const handleConfirmarTransferenciaIndividual = () => {
    if (!alunoTransferencia || !turmaDestinoTransferencia) {
      setToast({ show: true, message: 'Selecione uma turma de destino', variant: 'danger' });
      return;
    }

    // Adicionar ao estado de transferências
    setAlunosTransferencia(prev => ({
      ...prev,
      [alunoTransferencia.id]: turmaDestinoTransferencia
    }));

    // Limpar status de promoção/reprovação caso exista
    setStatusPromocao(prev => ({ ...prev, [alunoTransferencia.id]: null }));

    setToast({ show: true, message: `${alunoTransferencia.nome} marcado para transferência`, variant: 'success' });
    handleFecharModalTransferencia();
  };

  // Função para aprovar todos os alunos
  const handleAprovarTodos = () => {
    const alunosFiltrados = getAlunosFiltrados();
    const novosStatus: Record<string, 'promovido' | 'reprovado' | null> = {};

    alunosFiltrados.forEach(aluno => {
      if (!acaoFinalizada[aluno.id]) {
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
      if (!acaoFinalizada[aluno.id]) {
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
              <div className="row mb-3 g-3">
                {/* Card Total de Turmas */}
                <div className="col-md-4">
                  <Card className="shadow-sm card-sm border-left-primary mb-1">
                    <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                      <span className="fw-bold" style={{ fontSize: '1.1rem', color: '#3b4861' }}>Total de Turmas</span>
                      <BookOpen size={20} className="text-primary" />
                    </div>
                    <Card.Body className="py-3">
                      <h3 className="mb-0 fw-bold" style={{ color: '#2563eb' }}>{turmasFiltradas.length}</h3>
                    </Card.Body>
                  </Card>
                </div>
                {/* Card Média de Alunos */}
                <div className="col-md-4">
                  <Card className="shadow-sm card-sm border-left-success mb-1">
                    <div className="bg-white px-3 py-2 d-flex align-items-center justify-content-between gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                      <span className="fw-bold" style={{ fontSize: '1.1rem', color: '#3b4861' }}>Média de Alunos</span>
                      <Users size={20} className="text-success" />
                    </div>
                    <Card.Body className="py-3">
                      <h3 className="mb-0 fw-bold" style={{ color: '#22c55e' }}>{turmasFiltradas.length > 0 ? Math.round(turmasFiltradas.reduce((acc, t) => acc + totalAlunos(t.id), 0) / turmasFiltradas.length) : 0}</h3>
                    </Card.Body>
                  </Card>
                </div>
                {/* Card Turnos Ativos */}
                <div className="col-md-4">
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
                </div>
              </div>

              {/* Filtros em um único card */}
              <Card className="mb-4">
                <Card.Body>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <Form.Control
                        type="text"
                        placeholder="Buscar turma..."
                        value={turmaFiltro}
                        onChange={e => { setTurmaFiltro(e.target.value); setPaginaAtual(1); }}
                      />
                    </div>
                    {/* Filtro de ano letivo removido pois agora é global pelo context */}
                    <div className="col-md-3">
                      <Form.Select value={turnoFiltro} onChange={e => { setTurnoFiltro(e.target.value); setPaginaAtual(1); }}>
                        <option value="">Todos os turnos</option>
                        {[...new Set(turmas.map(t => t.turno))].sort().map(turno => (
                          <option key={turno} value={turno}>{turno}</option>
                        ))}
                      </Form.Select>
                    </div>
                    <div className="col-md-3">
                      <Form.Select value={numAlunosFiltro} onChange={e => { setNumAlunosFiltro(e.target.value); setPaginaAtual(1); }}>
                        <option value="">Nº de alunos</option>
                        <option value="ate19">Até 19</option>
                        <option value="20a30">20 a 30</option>
                        <option value="mais30">Mais de 30</option>
                      </Form.Select>
                    </div>
                    <div className="col-md-2">
                      <Button variant="primary" onClick={() => openModal()}>
                        <PlusCircle className="me-2" size={18} /> Nova Turma
                      </Button>
                    </div>
                  </div>
                </Card.Body>
              </Card>

              {loading ? (
                <div className="d-flex justify-content-center align-items-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : (
                <>
                  {/* Versão Desktop */}
                  <div className="turmas-list-desktop d-none d-md-block">
                    <Card className="mb-1">
                      <Card.Body>
                        <div className="agenda-table-desktop w-100">
                          <Table hover className="w-100">
                            <thead className="thead-sticky">
                              <tr style={{ textAlign: 'center' }}>
                                <th className='text-muted'>Turma</th>
                                <th className='text-muted'>Status</th>
                                <th className='text-muted'>Turno</th>
                                <th className='text-muted'>Total de Alunos</th>
                                <th className='text-muted'>Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {turmasPaginadas.length > 0 ? turmasPaginadas.map(t => {
                                const turnoStyle = getTurnoStyle(t.turno);

                                return (
                                  <tr key={t.id} className='align-middle linha-agenda' style={{ textAlign: 'center' }}>
                                    <td>
                                      <div className="d-flex align-items-center justify-content-center gap-2">
                                        <strong>{t.nome}</strong>
                                      </div>
                                    </td>
                                    <td>
                                      <span className="badge bg-success text-white px-2 py-1">
                                        <CheckCircle2 size={14} className="me-1" />
                                        Ativa
                                      </span>
                                    </td>
                                    <td>
                                      <span
                                        className="badge badge-turno px-2 py-1"
                                        style={{
                                          backgroundColor: turnoStyle.bg,
                                          color: turnoStyle.color
                                        }}
                                      >
                                        {t.turno}
                                      </span>
                                    </td>
                                    <td>
                                      <span className="fw-semibold" style={{ fontWeight: 600, fontSize: '1rem', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                        <Users size={18} style={{ marginRight: 4, verticalAlign: 'middle', color: '#6c757d' }} />
                                        {t.isVirtualizada ? '-' : totalAlunos(t.id)}
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
                                          <Dropdown.Item onClick={() => handleVerDetalhes(t)} className="d-flex align-items-center gap-2">
                                            <Eye size={16} /> Detalhes
                                          </Dropdown.Item>
                                          {t.isVirtualizada ? (
                                            <>
                                              {/* <Dropdown.Item onClick={() => handleMaterializarTurma(t)} className="d-flex align-items-center gap-2 text-success">
                                                <CheckCircle2 size={16} className="text-success" /> Materializar
                                              </Dropdown.Item> */}
                                              <Dropdown.Item onClick={() => handleExcluirTurma(t.id)} className="d-flex align-items-center gap-2 text-danger">
                                                <Trash2 size={16} /> Excluir
                                              </Dropdown.Item>
                                            </>
                                          ) : (
                                            <>
                                              <Dropdown.Item onClick={() => openModal(t)} className="d-flex align-items-center gap-2 text-primary">
                                                <Edit size={16} className="text-primary" /> Editar
                                              </Dropdown.Item>
                                              <Dropdown.Item onClick={() => handleExcluirTurma(t.id)} className="d-flex align-items-center gap-2 text-danger">
                                                <Trash2 size={16} /> Excluir
                                              </Dropdown.Item>
                                            </>
                                          )}
                                        </Dropdown.Menu>
                                      </Dropdown>
                                    </td>
                                  </tr>
                                );
                              }) : (
                                <tr>
                                  <td colSpan={5} className="text-center py-4">
                                    <div className="agenda-empty-state">
                                      <div className="empty-icon">🏫</div>
                                      <h5>Nenhuma turma encontrada</h5>
                                      <p className="text-muted">Tente ajustar os filtros ou adicione uma nova turma.</p>
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
                  <div className="turmas-mobile-cards d-block d-md-none">
                    <div className="turmas-header-mobile mb-3">
                      <h3 className="mb-0">Turmas</h3>
                    </div>

                    {turmasPaginadas.length > 0 ? (
                      <div className="turmas-grid-mobile">
                        {turmasPaginadas.map(t => {
                          const turnoStyle = getTurnoStyle(t.turno);
                          return (
                            <div key={t.id} className="turmas-card-mobile">
                              <div className="turmas-card-header">
                                <div className="turmas-card-info">
                                  <div className="turmas-card-title d-flex align-items-center gap-2">
                                    {t.nome}
                                    {t.isVirtualizada && (
                                      <Ghost size={14} className="text-info" />
                                    )}
                                  </div>
                                  <div className="turmas-card-ano d-flex align-items-center gap-2">
                                    Ano: {t.anoLetivo}
                                    {t.isVirtualizada ? (
                                      <span className="badge bg-info text-white" style={{ fontSize: '0.7rem' }}>Virtual</span>
                                    ) : (
                                      <span className="badge bg-success text-white" style={{ fontSize: '0.7rem' }}>Ativa</span>
                                    )}
                                  </div>
                                </div>
                                <span
                                  className="badge px-2 py-1"
                                  style={{
                                    backgroundColor: turnoStyle.bg,
                                    color: turnoStyle.color,
                                    fontSize: '0.8rem'
                                  }}
                                >
                                  {t.turno}
                                </span>
                              </div>

                              <div className="turmas-card-body">
                                <div className="turmas-alunos-info">
                                  <Users size={18} className="text-muted me-2" />
                                  <span className="fw-semibold">
                                    {t.isVirtualizada ? 'Sem alunos (virtual)' : `${totalAlunos(t.id)} alunos`}
                                  </span>
                                </div>
                              </div>

                              <div className="turmas-card-actions">
                                <button
                                  className="turmas-action-btn turmas-detalhes-btn"
                                  onClick={() => handleVerDetalhes(t)}
                                >
                                  <Eye size={16} />
                                  Detalhes
                                </button>
                                {t.isVirtualizada ? (
                                  <button
                                    className="turmas-action-btn turmas-edit-btn"
                                    onClick={() => handleMaterializarTurma(t)}
                                    style={{ backgroundColor: '#22c55e', borderColor: '#22c55e' }}
                                  >
                                    <CheckCircle2 size={16} />
                                    Materializar
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      className="turmas-action-btn turmas-edit-btn"
                                      onClick={() => openModal(t)}
                                    >
                                      <Edit size={16} />
                                      Editar
                                    </button>
                                    <button
                                      className="turmas-action-btn turmas-delete-btn"
                                      onClick={() => handleExcluirTurma(t.id)}
                                    >
                                      <Trash2 size={16} />
                                      Excluir
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="turmas-empty-state">
                        <div className="turmas-empty-icon">
                          <Users size={48} />
                        </div>
                        <h5 className="turmas-empty-title">Nenhuma turma encontrada</h5>
                        <p className="turmas-empty-text">
                          {turmaFiltro || anoLetivo || turnoFiltro || numAlunosFiltro
                            ? 'Tente ajustar os filtros de busca.'
                            : 'Comece adicionando sua primeira turma.'
                          }
                        </p>
                      </div>
                    )}
                  </div>

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
            <>
              {/* Filtros para Rematrícula */}
              <Card className="mb-4">
                <Card.Body>
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <ArrowLeftRight size={20} className="" />
                    <h5 className="mb-0">Seleção de Turma</h5>
                  </div>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <Form.Label
                        className='filter-label'
                      >
                        Ano Letivo
                      </Form.Label>
                      <Form.Select
                        value={anoLetivoRematricula}
                        onChange={e => {
                          setAnoLetivoRematricula(parseInt(e.target.value));
                          setTurmaFiltroRematricula('');
                          setProximaTurma('');
                        }}
                      >
                        {/* Mostrar apenas anos que têm turmas cadastradas */}
                        {[...new Set(turmas.filter(t => !t.isVirtualizada).map(t => parseInt(t.anoLetivo)))]
                          .sort((a, b) => a - b)
                          .map(ano => (
                            <option key={ano} value={ano}>{ano}</option>
                          ))}
                      </Form.Select>
                    </div>
                    <div className="col-md-4">
                      <Form.Label
                        className='filter-label'
                      >
                        Turma Atual
                      </Form.Label>
                      <Form.Select value={turmaFiltroRematricula} onChange={e => {
                        setTurmaFiltroRematricula(e.target.value);
                        setProximaTurma('');
                      }}>
                        <option value="">Selecione a turma atual</option>
                        {turmas.filter(t => !t.isVirtualizada && t.anoLetivo === anoLetivoRematricula.toString()).map(turma => (
                          <option key={turma.id} value={turma.id}>{turma.nome}</option>
                        ))}
                      </Form.Select>
                    </div>
                    <div className="col-md-4">
                      <Form.Label className="d-flex align-items-center gap-2 filter-label">
                        <ArrowRight size={16} className="text-primary" />
                        Próxima Turma
                      </Form.Label>
                      <Form.Select
                        value={proximaTurma}
                        onChange={e => setProximaTurma(e.target.value)}
                        disabled={!turmaFiltroRematricula}
                      >
                        <option value="">
                          {turmaFiltroRematricula && getTurmasProximas().length === 0
                            ? `Nenhuma turma cadastrada para ${parseInt(anoLetivoRematricula.toString()) + 1}`
                            : 'Selecione a próxima turma'}
                        </option>
                        {getTurmasProximas().map(turma => {
                          return (
                            <option key={turma.id} value={turma.id}>
                              {turma.nome} - ({parseInt(anoLetivoRematricula.toString()) + 1})
                            </option>
                          );
                        })}
                      </Form.Select>
                      {turmaFiltroRematricula && getTurmasProximas().length === 0 && (
                        <Form.Text className="text-warning d-flex align-items-center gap-1 mt-1">
                          <FontAwesomeIcon icon={faCircleExclamation} />
                          Crie turmas para {parseInt(anoLetivoRematricula.toString()) + 1} em "Gerenciar Turmas"
                        </Form.Text>
                      )}
                    </div>
                  </div>
                </Card.Body>
              </Card>

              {/* Card informativo quando nenhuma turma está selecionada */}
              {!turmaFiltroRematricula && (
                <Card className="shadow-sm mb-4">
                  <Card.Body>
                    <div className="text-center text-muted py-5">
                      <FontAwesomeIcon icon={faCircleExclamation} size="2x" className="mb-3" />
                      <div>Selecione uma turma para visualizar os alunos disponíveis para rematrícula.</div>
                    </div>
                  </Card.Body>
                </Card>
              )}

              {/* Lista de Alunos só aparece após seleção de turma */}
              {turmaFiltroRematricula && (
                <>
                  {/* Cards informativos */}
                  <div className="row mb-3 g-3">
                    {/* Card Total de Alunos */}
                    <div className="col-md-6 col-lg-3">
                      <Card className="shadow-sm card-sm border-left-primary mb-1">
                        <Card.Body className="py-3 px-3">
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <div className="text-muted small" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Total</div>
                            <Users size={16} style={{ color: '#2563eb', opacity: 0.7 }} />
                          </div>
                          <h4 className="mb-0 fw-bold" style={{ color: '#2563eb' }}>{getAlunosFiltrados().length}</h4>
                        </Card.Body>
                      </Card>
                    </div>

                    {/* Card Aprovados */}
                    <div className="col-md-6 col-lg-3">
                      <Card className="shadow-sm card-sm border-left-success mb-1">
                        <Card.Body className="py-3 px-3">
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <div className="text-muted small" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Aprovados</div>
                            <CheckCircle2 size={16} style={{ color: '#22c55e', opacity: 0.7 }} />
                          </div>
                          <h4 className="mb-0 fw-bold" style={{ color: '#22c55e' }}>
                            {Object.values(statusPromocao).filter(s => s === 'promovido').length}
                          </h4>
                        </Card.Body>
                      </Card>
                    </div>

                    {/* Card Reprovados */}
                    <div className="col-md-6 col-lg-3">
                      <Card className="shadow-sm card-sm mb-1" style={{ borderLeft: '4px solid #ef4444' }}>
                        <Card.Body className="py-3 px-3">
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <div className="text-muted small" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Reprovados</div>
                            <X size={16} style={{ color: '#ef4444', opacity: 0.7 }} />
                          </div>
                          <h4 className="mb-0 fw-bold" style={{ color: '#ef4444' }}>
                            {Object.values(statusPromocao).filter(s => s === 'reprovado').length}
                          </h4>
                        </Card.Body>
                      </Card>
                    </div>

                    {/* Card Transferidos */}
                    <div className="col-md-6 col-lg-3">
                      <Card className="shadow-sm card-sm mb-1" style={{ borderLeft: '4px solid #3b82f6' }}>
                        <Card.Body className="py-3 px-3">
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <div className="text-muted small" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Transferidos</div>
                            <ArrowLeftRight size={16} style={{ color: '#3b82f6', opacity: 0.7 }} />
                          </div>
                          <h4 className="mb-0 fw-bold" style={{ color: '#3b82f6' }}>
                            {Object.keys(alunosTransferencia).length}
                          </h4>
                        </Card.Body>
                      </Card>
                    </div>
                  </div>

                  <Card className="mb-4">
                    <Card.Body className="pb-0">
                      <div className="d-flex align-items-center justify-content-between px-2 mb-2">
                        <h3 className="mb-0 d-flex align-items-center gap-2">
                          Lista de Alunos - {turmas.find(t => t.id === turmaFiltroRematricula)?.nome}
                        </h3>
                        <div className="d-flex gap-2">
                          <Button
                            variant="outline-success"
                            size="sm"
                            onClick={handleAprovarTodos}
                            className="d-flex align-items-center gap-1 btn-aprovar-todos"
                          >
                            <Check size={16} />
                            Aprovar Todos
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={handleReprovarTodos}
                            className="d-flex align-items-center gap-1 btn-reprovar-todos"
                          >
                            <X size={16} />
                            Reprovar Todos
                          </Button>
                        </div>
                      </div>
                    </Card.Body>
                    <Card.Body className="pt-0">
                      {loading ? (
                        <div className="d-flex justify-content-center align-items-center py-5">
                          <Spinner animation="border" />
                        </div>
                      ) : (
                        <Table hover className="mb-0">
                          <thead className="thead-sticky">
                            <tr style={{ textAlign: 'center' }}>
                              <th className='text-muted' style={{ width: '35%' }}>Aluno</th>
                              <th className='text-muted'>Média Final</th>
                              <th className='text-muted'>Situação</th>
                              <th className='text-muted'>Ações</th>
                              <th className='text-muted'>Boletim</th>
                            </tr>
                          </thead>
                          <tbody className=''>
                            {getAlunosFiltrados().length > 0 ? getAlunosFiltrados().map(aluno => {
                              const mediaFinal = mediasAlunos[aluno.id];
                              const corMedia = mediaFinal !== null && mediaFinal !== undefined
                                ? mediaFinal >= 7 ? 'text-success' : mediaFinal >= 5 ? 'text-warning' : 'text-danger'
                                : 'text-muted';

                              return (
                                <tr key={aluno.id} className='align-middle linha-agenda' style={{ textAlign: 'center', height: '70px' }}>
                                  <td style={{ textAlign: 'left' }}>
                                    <div className="d-flex align-items-center gap-2">
                                      <div className="user-icon-circle-frequencia">
                                        <User size={24} color="#fff" />
                                      </div>
                                      <strong>{aluno.nome}</strong>
                                    </div>
                                  </td>
                                  <td>
                                    <span className={`fw-bold ${corMedia}`} style={{ fontSize: '1.1rem' }}>
                                      {mediaFinal !== null && mediaFinal !== undefined ? mediaFinal.toFixed(1) : '-'}
                                    </span>
                                  </td>
                                  <td>
                                    {getStatusBadge(aluno.id)}
                                  </td>
                                  <td>
                                    {acaoFinalizada[aluno.id] ? (
                                      // Mostrar badge quando ação foi finalizada
                                      <div className="d-flex justify-content-center">
                                        {acaoFinalizada[aluno.id] === 'promovido' && (
                                          <span className="badge bg-success px-3 py-2" style={{ fontSize: '0.85rem' }}>
                                            <Check size={14} className="me-1" />
                                            Promovido
                                          </span>
                                        )}
                                        {acaoFinalizada[aluno.id] === 'reprovado' && (
                                          <span className="badge bg-danger px-3 py-2" style={{ fontSize: '0.85rem' }}>
                                            <X size={14} className="me-1" />
                                            Reprovado
                                          </span>
                                        )}
                                        {acaoFinalizada[aluno.id] === 'transferido' && (
                                          <span className="badge bg-primary px-3 py-2" style={{ fontSize: '0.85rem' }}>
                                            <ArrowRight size={14} className="me-1" />
                                            Transferido
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      // Mostrar botões quando ação não foi finalizada
                                      <div className="d-flex gap-2 justify-content-center">
                                        <Button
                                          className='btn-acao-aprovado'
                                          size="sm"
                                          onClick={() => {
                                            setStatusPromocao(prev => {
                                              // Se já está promovido, desseleciona
                                              if (prev[aluno.id] === 'promovido') {
                                                const { [aluno.id]: _, ...rest } = prev;
                                                return rest;
                                              }
                                              // Senão, marca como promovido
                                              return { ...prev, [aluno.id]: 'promovido' };
                                            });
                                            // Limpar transferência se estava selecionada
                                            if (alunosTransferencia[aluno.id]) {
                                              const novaTransferencia = { ...alunosTransferencia };
                                              delete novaTransferencia[aluno.id];
                                              setAlunosTransferencia(novaTransferencia);
                                            }
                                          }}
                                          title="Aprovar"
                                          style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px',
                                            fontWeight: '500',
                                            backgroundColor: statusPromocao[aluno.id] === 'promovido' ? '#22c55e' : 'white',
                                            color: statusPromocao[aluno.id] === 'promovido' ? 'white' : 'black',
                                            border: '1px solid #cbd5e1',
                                            height: '32px',
                                            minWidth: '32px'
                                          }}
                                        >
                                          <Check size={16} strokeWidth={2.5} />
                                        </Button>
                                        <Button
                                          className='btn-acao-reprovado'
                                          size="sm"
                                          onClick={() => {
                                            setStatusPromocao(prev => {
                                              // Se já está reprovado, desseleciona
                                              if (prev[aluno.id] === 'reprovado') {
                                                const { [aluno.id]: _, ...rest } = prev;
                                                return rest;
                                              }
                                              // Senão, marca como reprovado
                                              return { ...prev, [aluno.id]: 'reprovado' };
                                            });
                                            // Limpar transferência se estava selecionada
                                            if (alunosTransferencia[aluno.id]) {
                                              const novaTransferencia = { ...alunosTransferencia };
                                              delete novaTransferencia[aluno.id];
                                              setAlunosTransferencia(novaTransferencia);
                                            }
                                          }}
                                          title="Reprovar"
                                          style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px',
                                            fontWeight: '500',
                                            backgroundColor: statusPromocao[aluno.id] === 'reprovado' ? '#ef4444' : 'white',
                                            color: statusPromocao[aluno.id] === 'reprovado' ? 'white' : 'black',
                                            border: '1px solid #cbd5e1',
                                            height: '32px',
                                            minWidth: '32px'
                                          }}
                                        >
                                          <X size={16} strokeWidth={2.5} />
                                        </Button>
                                        <Button
                                          className="btn-acao-transferencia d-flex align-items-center gap-1"
                                          size="sm"
                                          onClick={() => handleAbrirModalTransferencia(aluno)}
                                          title="Transferir"
                                          style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px',
                                            fontWeight: '500',
                                            backgroundColor: alunosTransferencia[aluno.id] ? '#3b82f6' : 'white',
                                            color: alunosTransferencia[aluno.id] ? 'white' : 'black',
                                            border: '1px solid #cbd5e1',
                                            height: '32px',
                                            minWidth: '32px'
                                          }}
                                        >
                                          <ArrowLeftRight size={18} strokeWidth={2.5} />
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      className="d-flex align-items-center gap-1"
                                      onClick={() => handleAbrirBoletim(aluno)}
                                      style={{
                                        margin: '0 auto',
                                        color: 'black',
                                        background: 'white',
                                        border: '1px solid #cbd5e1',
                                      }}
                                      title="Ver Boletim"
                                    >
                                      <BookText size={16} />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            }) : (
                              <tr>
                                <td colSpan={5} className="text-center py-4">
                                  <div className="agenda-empty-state">
                                    <div className="empty-icon">👥</div>
                                    <h5>Nenhum aluno encontrado</h5>
                                    <p className="text-muted">Tente ajustar os filtros ou verifique se há alunos cadastrados.</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </Table>
                      )}
                    </Card.Body>
                  </Card>
                </>
              )}
            </>
          )}

          <Modal show={showModal} onHide={closeModal} centered>
            <Modal.Header closeButton>
              <Modal.Title>{editId ? 'Editar Turma' : 'Nova Turma'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Nome da Turma</Form.Label>
                  <Form.Control id="input-nome-turma" type="text" value={novaTurma} onChange={e => setNovaTurma(e.target.value)} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Ano Letivo</Form.Label>
                  <Form.Control type="number" value={anoLetivo} readOnly disabled />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Turno</Form.Label>
                  <Form.Select value={turnoModal} onChange={e => setTurnoModal(e.target.value)}>
                    <option>Manhã</option>
                    <option>Tarde</option>
                  </Form.Select>
                </Form.Group>
                {erro && <div className="text-danger mt-2">{erro}</div>}
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
              <Button variant="primary" onClick={handleSalvarTurma}>Salvar</Button>
            </Modal.Footer>
          </Modal>



          {/* Modal de Detalhes da Turma */}
          <Modal show={showDetalhesModal} onHide={closeDetalhesModal} centered size="lg">
            <Modal.Header closeButton>
              <Modal.Title className="d-flex align-items-center gap-2">
                <Users size={24} color="#2563eb" />
                Detalhes da Turma - {turmaDetalhes?.nome}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {turmaDetalhes && (
                <div className="row g-4">
                  {/* Card de Informações Gerais */}
                  <div className="col-12">
                    <Card className="shadow-sm">
                      <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                        <BookOpen size={20} className="me-2 text-primary" />
                        <span className="fw-bold" style={{ fontSize: '1.1rem', color: '#1e293b' }}>Informações Gerais</span>
                      </div>
                      <Card.Body>
                        <div className="row">
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label fw-semibold text-muted">Ano Letivo</label>
                              <p className="mb-0">{turmaDetalhes.anoLetivo}</p>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label fw-semibold text-muted">Turno</label>
                              <div>
                                <span
                                  className="badge px-2 py-1"
                                  style={{
                                    backgroundColor: getTurnoStyle(turmaDetalhes.turno).bg,
                                    color: getTurnoStyle(turmaDetalhes.turno).color
                                  }}
                                >
                                  {turmaDetalhes.turno}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label fw-semibold text-muted">Status</label>
                              <div>
                                <span className="badge bg-success px-2 py-1">
                                  <CheckCircle2 size={12} className="me-1" />
                                  Ativa
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </div>

                  {/* Card de Professores em cima do card de alunos */}
                  <div className="col-md-12">
                    <Card className="shadow-sm">
                      <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                        <User size={20} className="me-2 text-primary" />
                        <span className="fw-bold" style={{ fontSize: '1.1rem', color: '#1e293b' }}>
                          Professores
                          {turmaDetalhes.isVirtualizada && (
                            <span className="text-muted ms-2" style={{ fontSize: '0.9rem', fontWeight: 'normal' }}>
                              (do ano anterior)
                            </span>
                          )}
                        </span>
                        <span className="badge bg-primary ms-2" style={{ fontSize: '0.95rem' }}>{getProfessoresDaTurma(turmaDetalhes.id, turmaDetalhes).length}</span>
                      </div>
                      <Card.Body className="p-2">
                        {getProfessoresDaTurma(turmaDetalhes.id, turmaDetalhes).length > 0 ? (
                          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            <div className="row g-2">
                              {getProfessoresDaTurma(turmaDetalhes.id, turmaDetalhes).map((item, index) => (
                                <div key={index} className="col-12 col-md-6">
                                  <Card className={`mb-2 card-sm ${turmaDetalhes.isVirtualizada ? 'border-left-info' : 'border-left-primary'}`}>
                                    <Card.Body className="py-2 px-3">
                                      <div className="d-flex align-items-center">
                                        <User size={16} className={`me-2 ${turmaDetalhes.isVirtualizada ? 'text-info' : 'text-primary'}`} />
                                        <div className="flex-grow-1">
                                          <h6 className="mb-1 fw-semibold text-dark">
                                            {item.professor}
                                            {turmaDetalhes.isVirtualizada && (
                                              <span className="ms-2" style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                                📅 {anoLetivo - 1}
                                              </span>
                                            )}
                                          </h6>
                                          <p className="mb-0 text-muted small">{item.materia}</p>
                                        </div>
                                      </div>
                                    </Card.Body>
                                  </Card>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-muted py-3">
                            <User size={32} className="mb-2 opacity-50" />
                            <p className="mb-0">Nenhum professor vinculado</p>
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </div>

                  {/* Card de Alunos abaixo do card de professores */}
                  <div className="col-md-12">
                    <Card className="shadow-sm h-100">
                      <div className="bg-white border-bottom px-3 py-2 d-flex align-items-center gap-2" style={{ borderRadius: '12px 12px 0 0' }}>
                        <Users size={20} className="me-2 text-success" />
                        <span className="fw-bold" style={{ fontSize: '1.1rem', color: '#1e293b' }}>Alunos Matriculados</span>
                        <span className="badge bg-success ms-2" style={{ fontSize: '0.95rem' }}>{getAlunosDaTurma(turmaDetalhes.id).length}</span>
                      </div>
                      <Card.Body className="p-2">
                        {getAlunosDaTurma(turmaDetalhes.id).length > 0 ? (
                          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            <div className="row g-2">
                              {getAlunosDaTurma(turmaDetalhes.id).map((aluno) => (
                                <div key={aluno.id} className="col-12 col-md-6">
                                  <Card className="mb-2 card-sm border-left-success">
                                    <Card.Body className="py-2 px-3">
                                      <div className="d-flex align-items-center">
                                        <Users size={16} className="me-2 text-success" />
                                        <div className="flex-grow-1">
                                          <h6 className="mb-1 fw-semibold text-dark">{aluno.nome}</h6>
                                          <p className="mb-0 text-muted small">
                                            {aluno.email || 'Email não cadastrado'}
                                          </p>
                                        </div>
                                      </div>
                                    </Card.Body>
                                  </Card>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-muted py-3">
                            <Users size={32} className="mb-2 opacity-50" />
                            <p className="mb-0">Nenhum aluno matriculado</p>
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </div>
                </div>
              )}
            </Modal.Body>
          </Modal>

          {/* Modal de Histórico de Notas */}
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
              {/* Versão Desktop */}
              <div className="d-none d-md-block" style={{ overflowX: 'auto' }}>
                {historicoAluno?.dadosBoletim ? (
                  <Table
                    bordered
                    size="sm"
                    className="mb-0"
                    style={{
                      minWidth: 600,
                      fontSize: '1rem',
                      textAlign: 'center',
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: '#fff'
                    }}
                  >
                    <thead className="fw-bold text-muted align-middle" style={{ background: '#f8f9fa' }}>
                      <tr>
                        <th style={{ width: '20%' }}>Matéria</th>
                        {historicoAluno.dadosBoletim.bimestres.map((bimestre: string) => (
                          <th key={bimestre} style={{ minWidth: '100px' }}>{bimestre} Bim</th>
                        ))}
                        <th style={{ minWidth: '100px', background: '#e9ecef' }}>Média Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoAluno.dadosBoletim.materias.map((materia: string) => {
                        // Calcular média final da matéria (média dos 4 bimestres)
                        const notasBimestres = historicoAluno.dadosBoletim.bimestres
                          .map((bim: string) => historicoAluno.dadosBoletim.notas[bim]?.[materia]?.mediaFinal)
                          .filter((n: number | null | undefined) => n !== null && n !== undefined);

                        const mediaFinalMateria = notasBimestres.length > 0
                          ? (notasBimestres.reduce((sum: number, n: number) => sum + n, 0) / notasBimestres.length).toFixed(1)
                          : null;

                        const getNotaColor = (valor: number | null | undefined) => {
                          if (valor === null || valor === undefined) return 'text-muted';
                          if (valor >= 7) return 'text-success';
                          if (valor >= 5) return 'text-warning';
                          return 'text-danger';
                        };

                        return (
                          <tr key={materia}>
                            <td style={{ fontWeight: 600, background: '#f8f9fa', textAlign: 'center', paddingLeft: 0 }}>{materia}</td>
                            {historicoAluno.dadosBoletim.bimestres.map((bimestre: string) => {
                              const nota = historicoAluno.dadosBoletim.notas[bimestre]?.[materia];
                              const mediaFinal = nota?.mediaFinal;

                              return (
                                <td
                                  key={bimestre}
                                  className={`fw-bold ${getNotaColor(mediaFinal)}`}
                                  style={{
                                    fontSize: '1rem',
                                    padding: '6px 4px',
                                    textAlign: 'center',
                                    verticalAlign: 'middle'
                                  }}
                                >
                                  {mediaFinal !== null && mediaFinal !== undefined ? mediaFinal : '-'}
                                </td>
                              );
                            })}
                            <td
                              className={`fw-bold ${getNotaColor(mediaFinalMateria ? parseFloat(mediaFinalMateria) : null)}`}
                              style={{
                                fontSize: '1.1rem',
                                padding: '6px 4px',
                                background: '#e9ecef',
                                textAlign: 'center',
                                verticalAlign: 'middle'
                              }}
                            >
                              {mediaFinalMateria !== null ? mediaFinalMateria : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                ) : (
                  <div className="text-center py-4">
                    <BookOpen size={48} className="mb-3 text-muted opacity-50" />
                    <p className="text-muted mb-0">Nenhuma nota encontrada para este aluno.</p>
                  </div>
                )}
              </div>

              {/* Versão Mobile */}
              <div className="d-block d-md-none">
                {historicoAluno?.dadosBoletim ? (
                  <div>
                    {/* Agrupar por matéria, mostrando bimestres como colunas */}
                    {historicoAluno.dadosBoletim.materias.map((materia: string) => (
                      <Card key={materia} className="mb-3">
                        <Card.Header className="bg-primary text-white">
                          <h6 className="mb-0">{materia}</h6>
                        </Card.Header>
                        <Card.Body className="p-2">
                          <div className="row g-2">
                            {historicoAluno.dadosBoletim.bimestres.map((bimestre: string) => {
                              const nota = historicoAluno.dadosBoletim.notas[bimestre]?.[materia];
                              const mediaFinal = nota?.mediaFinal;
                              const getNotaColor = (valor: number | null | undefined) => {
                                if (valor === null || valor === undefined) return 'text-muted';
                                if (valor >= 7) return 'text-success';
                                if (valor >= 5) return 'text-warning';
                                return 'text-danger';
                              };

                              return (
                                <div key={bimestre} className="col-6">
                                  <div className="border rounded p-2 text-center">
                                    <small className="text-muted d-block">{bimestre} Bim</small>
                                    <span className={`fw-bold fs-5 ${getNotaColor(mediaFinal)}`}>
                                      {mediaFinal !== null && mediaFinal !== undefined ? mediaFinal : '-'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Média Final da Matéria */}
                          <div className="mt-2 pt-2 border-top">
                            <div className="d-flex justify-content-between align-items-center">
                              <span className="fw-bold">Média Final:</span>
                              <span className={`fw-bold fs-4 ${(() => {
                                const notasBimestres = historicoAluno.dadosBoletim.bimestres
                                  .map((bim: string) => historicoAluno.dadosBoletim.notas[bim]?.[materia]?.mediaFinal)
                                  .filter((n: number | null | undefined) => n !== null && n !== undefined);

                                const mediaFinalMateria = notasBimestres.length > 0
                                  ? parseFloat((notasBimestres.reduce((sum: number, n: number) => sum + n, 0) / notasBimestres.length).toFixed(1))
                                  : null;

                                if (mediaFinalMateria === null) return 'text-muted';
                                if (mediaFinalMateria >= 6) return 'text-success';
                                if (mediaFinalMateria >= 5) return 'text-warning';
                                return 'text-danger';
                              })()}`}>
                                {(() => {
                                  const notasBimestres = historicoAluno.dadosBoletim.bimestres
                                    .map((bim: string) => historicoAluno.dadosBoletim.notas[bim]?.[materia]?.mediaFinal)
                                    .filter((n: number | null | undefined) => n !== null && n !== undefined);

                                  const mediaFinalMateria = notasBimestres.length > 0
                                    ? (notasBimestres.reduce((sum: number, n: number) => sum + n, 0) / notasBimestres.length).toFixed(1)
                                    : null;

                                  return mediaFinalMateria !== null ? mediaFinalMateria : '-';
                                })()}
                              </span>
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <BookOpen size={48} className="mb-3 text-muted opacity-50" />
                    <p className="text-muted mb-0">Nenhuma nota encontrada para este aluno.</p>
                  </div>
                )}
              </div>

              {/* Remover versão mobile duplicada antiga */}
              <div className="d-none">
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
                    <BookOpen size={48} className="mb-3" style={{ opacity: 0.3 }} />
                    <div>Nenhuma nota encontrada para este aluno.</div>
                  </div>
                )}
              </div>
            </Modal.Body>
          </Modal>

          {/* Modal de Rematrícula */}
          <Modal show={showRematricula} onHide={fecharModalRematricula} size="lg">
            <Modal.Header closeButton>
              <Modal.Title>
                <Edit size={20} className="me-2" />
                Rematrícula de Aluno
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {alunoRematricula && (
                <>
                  {/* Informações do Aluno */}
                  <div className="mb-4">
                    <h5 className="mb-3">Informações do Aluno</h5>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label fw-semibold text-muted">Nome Completo</label>
                          <div className="p-2 bg-light rounded">
                            <strong>{alunoRematricula.nome}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label fw-semibold text-muted">Turma Atual</label>
                          <div className="p-2 bg-light rounded">
                            {turmas.find(t => t.id === alunoRematricula.turmaId)?.nome}
                            <span className="text-muted ms-1">({anoLetivo})</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label fw-semibold text-muted">Situação Atual</label>
                          <div className="p-2 bg-light rounded">
                            {getStatusBadge(alunoRematricula.id)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr />

                  {/* Seleção de Nova Turma */}
                  <div className="mb-4">
                    <h5 className="mb-3">Selecionar Nova Turma ({parseInt(anoLetivo.toString()) + 1})</h5>

                    {turmasDisponiveis.length > 0 ? (
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Turmas Disponíveis</label>
                        <select
                          className="form-select"
                          value={turmaSelecionada}
                          onChange={(e) => setTurmaSelecionada(e.target.value)}
                        >
                          <option value="">Selecione uma turma...</option>
                          {turmasDisponiveis
                            .slice() // para não mutar o array original
                            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
                            .map(turma => (
                              <option key={turma.id} value={turma.id}>
                                {turma.nome} - {turma.turno}
                                {turma.isVirtualizada && ' (Virtual)'}
                                {!turma.isVirtualizada && ' (Materializada)'}
                              </option>
                            ))}
                        </select>
                        <div className="form-text">
                          Turmas da mesma série e da seguinte estão disponíveis para rematrícula.
                        </div>
                      </div>
                    ) : (
                      <div className="alert alert-warning">
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        Nenhuma turma disponível encontrada para o próximo ano letivo.

                        {/* Debug Info */}
                        <details className="mt-2">
                          <summary style={{ cursor: 'pointer' }} className="text-muted small">
                            🔍 Informações de Debug (clique para expandir)
                          </summary>
                          <div className="mt-2 p-2 bg-light rounded small">
                            <div><strong>Aluno:</strong> {alunoRematricula.nome}</div>
                            <div><strong>Turma Atual:</strong> {turmas.find(t => t.id === alunoRematricula.turmaId)?.nome}</div>
                            <div><strong>Série Atual:</strong> {extrairSerieDaTurma(turmas.find(t => t.id === alunoRematricula.turmaId)?.nome || '')}</div>
                            <div><strong>Ano Atual:</strong> {anoLetivo}</div>
                            <div><strong>Ano Próximo:</strong> {parseInt(anoLetivo.toString()) + 1}</div>
                            <div><strong>Turmas Encontradas:</strong> {turmasDisponiveis.length}</div>
                            <div className="text-muted mt-1">
                              Verifique o console do navegador (F12) para logs detalhados.
                            </div>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={fecharModalRematricula}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={executarRematricula}
                disabled={!turmaSelecionada || processandoRematricula}
              >
                {processandoRematricula ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Processando...
                  </>
                ) : (
                  'Confirmar Rematrícula'
                )}
              </Button>
            </Modal.Footer>
          </Modal>

        </div>

        {/* Modal de Confirmação de Ações */}
        <Modal
          show={showModalConfirmacao}
          onHide={() => setShowModalConfirmacao(false)}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>
              <CheckSquare size={24} className="me-2" />
              Confirmar Promoção
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted mb-3">
              Você está prestes a realizar a promoção da turma <strong>{turmas.find(t => t.id === turmaFiltroRematricula)?.nome}</strong>.
            </p>

            <Card className="border-0 shadow-sm">
              <Card.Body>
                <h6 className="mb-3">Resumo:</h6>
                <div className="d-flex flex-column gap-2">
                  {resumoDestinos.promovidos.length > 0 && (
                    <div className="d-flex align-items-start gap-2">
                      <CheckSquare size={18} className="text-success mt-1" />
                      <span>
                        <strong>{resumoDestinos.promovidos.length}</strong> aluno{resumoDestinos.promovidos.length > 1 ? 's' : ''} será{resumoDestinos.promovidos.length > 1 ? 'ão' : ''} promovido{resumoDestinos.promovidos.length > 1 ? 's' : ''} para <strong>{resumoDestinos.promovidos[0]?.turmaDestino}</strong>
                      </span>
                    </div>
                  )}

                  {resumoDestinos.reprovados.length > 0 && (
                    <div className="d-flex align-items-start gap-2">
                      <XSquare size={18} className="text-danger mt-1" />
                      <span>
                        <strong>{resumoDestinos.reprovados.length}</strong> aluno{resumoDestinos.reprovados.length > 1 ? 's' : ''} será{resumoDestinos.reprovados.length > 1 ? 'ão' : ''} reprovado{resumoDestinos.reprovados.length > 1 ? 's' : ''}
                        {resumoDestinos.reprovados.length > 0 && (
                          <>
                            {' '}para{' '}
                            {Array.from(new Set(resumoDestinos.reprovados.map(r => r.turmaDestino))).map((turma, idx, arr) => (
                              <span key={idx}>
                                <strong>{turma}</strong>{idx < arr.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  {resumoDestinos.transferidos.length > 0 && (
                    <div className="d-flex align-items-start gap-2">
                      <ArrowRight size={18} className="text-primary mt-1" />
                      <span>
                        <strong>{resumoDestinos.transferidos.length}</strong> aluno{resumoDestinos.transferidos.length > 1 ? 's' : ''} será{resumoDestinos.transferidos.length > 1 ? 'ão' : ''} transferido{resumoDestinos.transferidos.length > 1 ? 's' : ''}
                        {resumoDestinos.transferidos.length > 0 && (
                          <>
                            {' '}para{' '}
                            {Array.from(new Set(resumoDestinos.transferidos.map(t => t.turmaDestino))).map((turma, idx, arr) => (
                              <span key={idx}>
                                <strong>{turma}</strong>{idx < arr.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>

            <p className="text-muted small mt-3 mb-0">
              Esta ação não poderá ser desfeita facilmente. Deseja continuar?
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModalConfirmacao(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleConfirmarAcoes}>
              Confirmar Promoção
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal de Transferência Individual */}
        <Modal
          show={showModalTransferencia}
          onHide={handleFecharModalTransferencia}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>
              <ArrowRight size={24} className="me-2" />
              Transferir Aluno
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {alunoTransferencia && (
              <>
                <Card className="border-0 shadow-sm mb-3">
                  <Card.Body>
                    <h5 className="mb-3">Informações do Aluno</h5>

                    <div className="mb-3">
                      <label className="form-label fw-semibold text-muted">Nome</label>
                      <div className="p-2 bg-light rounded">
                        <strong>{alunoTransferencia.nome}</strong>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label fw-semibold text-muted">Turma Atual</label>
                          <div className="p-2 bg-light rounded">
                            {turmas.find(t => t.id === getTurmaAlunoNoAno(alunoTransferencia, anoLetivoRematricula))?.nome || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label fw-semibold text-muted">Média Final</label>
                          <div className="p-2 bg-light rounded">
                            <span className={`fw-bold ${mediasAlunos[alunoTransferencia.id] !== null && mediasAlunos[alunoTransferencia.id] !== undefined
                              ? mediasAlunos[alunoTransferencia.id]! >= 7 ? 'text-success'
                                : mediasAlunos[alunoTransferencia.id]! >= 5 ? 'text-warning'
                                  : 'text-danger'
                              : 'text-muted'
                              }`}>
                              {mediasAlunos[alunoTransferencia.id] !== null && mediasAlunos[alunoTransferencia.id] !== undefined
                                ? mediasAlunos[alunoTransferencia.id]!.toFixed(1)
                                : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-semibold text-muted">Situação Atual</label>
                      <div className="p-2 bg-light rounded">
                        {getStatusBadge(alunoTransferencia.id)}
                      </div>
                    </div>
                  </Card.Body>
                </Card>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Selecione a Turma de Destino</label>
                  <Form.Select
                    value={turmaDestinoTransferencia}
                    onChange={(e) => setTurmaDestinoTransferencia(e.target.value)}
                  >
                    <option value="">Selecione uma turma...</option>
                    {getTurmasAnoAtual().length > 0 ? (
                      getTurmasAnoAtual().map(turma => (
                        <option key={turma.id} value={turma.id}>
                          {turma.nome}
                        </option>
                      ))
                    ) : (
                      <option disabled>Nenhuma turma disponível</option>
                    )}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Transferir para outra turma do mesmo ano letivo ({anoLetivoRematricula})
                  </Form.Text>
                </div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleFecharModalTransferencia}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmarTransferenciaIndividual}
              disabled={!turmaDestinoTransferencia}
            >
              <ArrowRight size={18} className="me-1" />
              Confirmar Transferência
            </Button>
          </Modal.Footer>
        </Modal>

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
