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
import { Users, BookOpen, User, Eye, Clock, CheckCircle2, Ghost } from 'lucide-react';
import { Edit, Trash2 } from 'lucide-react';

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
  const [buscaRematricula, setBuscaRematricula] = useState('');

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

  useEffect(() => {
    if (!userData || carregandoAnos) return;
    fetchData();
  }, [userData, carregandoAnos, anoLetivo]);

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
      calcularStatusAlunosPaginaAtual(alunosFiltrados);
    }
  }, [alunos, buscaRematricula, turmaFiltroRematricula]);

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

      // Combinar turmas atuais + virtualizadas
      const todasTurmas = [...turmasAtuais, ...turmasVirtualizadas].sort((a, b) => a.nome.localeCompare(b.nome));

      setTurmas(todasTurmas);
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
    if (!window.confirm('Deseja realmente excluir esta turma?')) return;
    try {
      await deleteDoc(doc(db, 'turmas', id));
      setToast({ show: true, message: 'Turma excluída.', variant: 'success' });
      fetchData();
    } catch (error) {
      console.error(error);
      setToast({ show: true, message: 'Erro ao excluir turma.', variant: 'danger' });
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

    return matchBusca && matchTurno && matchNumAlunos;
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
      // Filtro por busca (nome do aluno)
      const matchBusca = buscaRematricula === '' ||
        aluno.nome.toLowerCase().includes(buscaRematricula.toLowerCase());
      // Filtro por turma (usando histórico do ano letivo atual)
      const matchTurma = turmaFiltroRematricula === '' ||
        getTurmaAlunoNoAno(aluno, anoLetivo) === turmaFiltroRematricula;
      return matchBusca && matchTurma;
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
  const calcularStatusAluno = async (aluno: Aluno): Promise<string> => {
    try {
      const alunoUidParaBusca = aluno.uid || aluno.id;

      // Obter a turma do aluno no ano letivo atual usando o histórico
      const turmaIdNoAno = getTurmaAlunoNoAno(aluno, anoLetivo);

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
  const calcularStatusAlunosPaginaAtual = async (alunosVisiveis: Aluno[]) => {
    const novosStatus = new Map<string, string>();

    // Calcular status em paralelo para melhor performance
    const promessas = alunosVisiveis.map(async (aluno) => {
      const status = await calcularStatusAluno(aluno);
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
    console.log('🔍 Extraindo número da série de:', nomeTurma);

    // Extrair apenas o número da série (1, 2, 3, 6, 7, 8, 9)
    const match = nomeTurma.match(/^(\d+)/);
    if (match) {
      const numero = parseInt(match[1]);
      console.log('✅ Número da série extraído:', numero);
      return numero;
    }

    console.log('❌ Nenhum número encontrado em:', nomeTurma);
    return 0;
  };

  // Função para extrair série completa (com sufixo)
  const extrairSerieDaTurma = (nomeTurma: string): string => {
    console.log('🔍 Extraindo série de:', nomeTurma);

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
        console.log('✅ Série extraída:', serie);
        return serie;
      }
    }

    console.log('❌ Nenhuma série encontrada em:', nomeTurma);
    return '';
  };

  // Função para abrir modal de rematrícula
  const handleAbrirRematricula = async (aluno: Aluno) => {
    try {
      console.log('🎓 INICIANDO REMATRÍCULA');
      console.log('👤 Aluno:', aluno);

      setAlunoRematricula(aluno);

      // Buscar turma atual do aluno
      const turmaAtual = turmas.find(t => t.id === aluno.turmaId);
      console.log('🏫 Turma atual:', turmaAtual);

      if (!turmaAtual) {
        alert('Turma atual do aluno não encontrada');
        return;
      }

      // Extrair série da turma atual
      const serieAtual = extrairSerieDaTurma(turmaAtual.nome);
      console.log('📚 Série extraída:', serieAtual, 'de:', turmaAtual.nome);

      const anoProximo = (parseInt(anoLetivo.toString()) + 1).toString();
      console.log('📅 Ano letivo atual:', anoLetivo);
      console.log('📅 Ano próximo:', anoProximo);

      // Buscar turmas do ano seguinte
      console.log('🔍 Buscando turmas do ano:', anoProximo);
      console.log('🔍 Tipo do ano próximo:', typeof anoProximo, '| Valor:', anoProximo);

      // Tentar buscar com string e number para garantir
      const turmasAnoSeguinteQuery1 = query(
        collection(db, 'turmas'),
        where('anoLetivo', '==', anoProximo)
      );

      const turmasAnoSeguinteQuery2 = query(
        collection(db, 'turmas'),
        where('anoLetivo', '==', parseInt(anoProximo))
      );

      const [turmasAnoSeguinteSnap1, turmasAnoSeguinteSnap2] = await Promise.all([
        getDocs(turmasAnoSeguinteQuery1),
        getDocs(turmasAnoSeguinteQuery2)
      ]);

      console.log('📋 Resultados busca por string:', turmasAnoSeguinteSnap1.docs.length);
      console.log('📋 Resultados busca por number:', turmasAnoSeguinteSnap2.docs.length);

      // Usar o resultado que trouxe mais turmas
      const turmasAnoSeguinteSnap = turmasAnoSeguinteSnap1.docs.length > 0 ? turmasAnoSeguinteSnap1 : turmasAnoSeguinteSnap2;

      let turmasAnoSeguinte = turmasAnoSeguinteSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Turma[];

      // Buscar turmas do ano ATUAL que podem ser virtualizadas para o próximo ano
      const turmasAnoAtualQuery1 = query(
        collection(db, 'turmas'),
        where('anoLetivo', '==', anoLetivo.toString())
      );

      const turmasAnoAtualQuery2 = query(
        collection(db, 'turmas'),
        where('anoLetivo', '==', anoLetivo)
      );

      const [turmasAnoAtualSnap1, turmasAnoAtualSnap2] = await Promise.all([
        getDocs(turmasAnoAtualQuery1),
        getDocs(turmasAnoAtualQuery2)
      ]);

      const turmasAnoAtualSnap = turmasAnoAtualSnap1.docs.length > 0 ? turmasAnoAtualSnap1 : turmasAnoAtualSnap2;

      const turmasAnoAtual = turmasAnoAtualSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Turma[];

      console.log('🔄 Turmas do ano atual para virtualizar:', turmasAnoAtual.length);

      // Virtualizar turmas do ano atual que podem ser usadas no próximo ano
      const turmasVirtualizadas: Turma[] = [];

      turmasAnoAtual.forEach(turmaAtual => {
        const podeVirtualizar = turmaAtual.isVirtual !== false;
        const jaExisteNoProximo = turmasAnoSeguinte.some(t => t.nome === turmaAtual.nome);

        if (podeVirtualizar && !jaExisteNoProximo) {
          turmasVirtualizadas.push({
            ...turmaAtual,
            id: `virtual_${turmaAtual.id}`,
            isVirtualizada: true,
            turmaOriginalId: turmaAtual.id,
            anoLetivo: anoProximo // Marca como do próximo ano
          });
        }
      });

      console.log('🔄 Turmas virtualizadas criadas:', turmasVirtualizadas.length);

      // Combinar turmas reais do próximo ano + turmas virtualizadas
      turmasAnoSeguinte = [...turmasAnoSeguinte, ...turmasVirtualizadas];

      console.log('📋 Turmas encontradas para', anoProximo + ':', turmasAnoSeguinte);
      console.log('📋 Quantidade de turmas (incluindo virtualizadas):', turmasAnoSeguinte.length);

      // Lógica dinâmica: analizar turmas disponíveis e permitir progressão natural
      console.log('🔍 Analisando turmas disponíveis dinamicamente...');

      const numeroSerieAtual = extrairNumeroSerie(turmaAtual.nome);
      console.log('📊 Número da série atual:', numeroSerieAtual);

      // Obter todos os números de séries disponíveis no próximo ano
      const seriesDisponiveis = turmasAnoSeguinte.map(turma => extrairNumeroSerie(turma.nome)).filter(num => num > 0);
      const seriesUnicas = [...new Set(seriesDisponiveis)].sort((a, b) => a - b);
      console.log('� Séries disponíveis no próximo ano:', seriesUnicas);

      const turmasDisp = turmasAnoSeguinte.filter(turma => {
        const numeroSerieTurma = extrairNumeroSerie(turma.nome);
        const serieTurma = extrairSerieDaTurma(turma.nome);

        console.log('📝 Verificando turma:', turma.nome, '| Série:', serieTurma, '| Número:', numeroSerieTurma);

        let podeMatricular = false;

        // Lógica dinâmica:
        // 1. Pode repetir a mesma série (mesmo número)
        // 2. Pode avançar para a próxima série (número + 1) se existir
        if (numeroSerieTurma === numeroSerieAtual) {
          podeMatricular = true;
          console.log('   ✅ PODE REPETIR (mesma série)');
        } else if (numeroSerieTurma === numeroSerieAtual + 1) {
          podeMatricular = true;
          console.log('   ✅ PODE AVANÇAR (série seguinte)');
        } else {
          console.log('   ❌ NÃO PODE (série', numeroSerieTurma, '- atual:', numeroSerieAtual + ')');
        }

        return podeMatricular;
      });

      console.log('✅ Turmas disponíveis após filtro:', turmasDisp);
      console.log('✅ Quantidade final:', turmasDisp.length);

      setTurmasDisponiveis(turmasDisp);
      setTurmaSelecionada('');
      setShowRematricula(true);

    } catch (error) {
      console.error('❌ Erro ao buscar turmas para rematrícula:', error);
      alert('Erro ao carregar turmas disponíveis');
    }
  };

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
        console.log('🔄 Turma virtual detectada, materializando...');

        // Verificar se já existe uma turma real com o mesmo nome no ano atual
        const turmasReaisQuery = query(
          collection(db, 'turmas'),
          where('nome', '==', turmaVirtual.nome),
          where('anoLetivo', '==', turmaVirtual.anoLetivo)
        );

        const turmasReaisSnap = await getDocs(turmasReaisQuery);

        if (turmasReaisSnap.empty) {
          // Materializar a turma virtual
          console.log('📝 Criando turma real...');

          const novaTurmaData = {
            nome: turmaVirtual.nome,
            anoLetivo: turmaVirtual.anoLetivo,
            turno: turmaVirtual.turno
          };

          const novaTurmaRef = await addDoc(collection(db, 'turmas'), novaTurmaData);
          turmaFinalId = novaTurmaRef.id;

          console.log('✅ Turma real criada com ID:', turmaFinalId);

          // Copiar vínculos professor-matéria da turma original
          console.log('🔗 Copiando vínculos da turma original:', turmaVirtual.turmaOriginalId);

          const vinculosOriginaisQuery = query(
            collection(db, 'professores_materias'),
            where('turmaId', '==', turmaVirtual.turmaOriginalId)
          );

          const vinculosOriginaisSnap = await getDocs(vinculosOriginaisQuery);

          console.log('📋 Vínculos encontrados:', vinculosOriginaisSnap.docs.length);

          for (const vinculoDoc of vinculosOriginaisSnap.docs) {
            const vinculoData = vinculoDoc.data();
            await addDoc(collection(db, 'professores_materias'), {
              professorId: vinculoData.professorId,
              materiaId: vinculoData.materiaId,
              turmaId: turmaFinalId
            });
          }

          console.log('✅ Vínculos copiados com sucesso');

          // Marcar turma original como não virtualizável
          await updateDoc(doc(db, 'turmas', turmaVirtual.turmaOriginalId), {
            isVirtual: false
          });

          console.log('✅ Turma original marcada como não virtualizável');
        } else {
          // Turma real já existe, usar ela
          turmaFinalId = turmasReaisSnap.docs[0].id;
          console.log('✅ Turma real já existe, usando ID:', turmaFinalId);
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
        console.log(`📚 Salvando turma atual no histórico de ${anoLetivoAtualStr}:`, historicoTurmas[anoLetivoAtualStr]);
      }

      // Adicionar a nova turma no histórico do ano letivo de destino
      const anoLetivoTurmaDestino = (turmaVirtual?.anoLetivo || (anoLetivo + 1)).toString();
      historicoTurmas[anoLetivoTurmaDestino] = turmaFinalId;

      console.log('📚 Histórico de turmas completo:', historicoTurmas);

      // Atualizar documento do aluno
      await updateDoc(alunoRef, {
        turmaId: turmaFinalId, // Manter compatibilidade (turma mais recente)
        historicoTurmas: historicoTurmas, // Histórico completo por ano letivo
        ultimaAtualizacao: new Date()
      });

      console.log('✅ Aluno rematriculado com histórico preservado');

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

  // Função para abrir modal de histórico de notas
  const handleAbrirBoletim = async (aluno: Aluno) => {
    try {
      console.log('🔍 Buscando notas para aluno:', aluno);
      console.log('🔍 ID do aluno:', aluno.id);
      console.log('🔍 UID do aluno:', aluno.uid);
      console.log('🔍 Ano letivo atual:', anoLetivo);

      // Usar o UID do aluno (campo uid) em vez do ID do documento
      const alunoUidParaBusca = aluno.uid || aluno.id;
      console.log('🔍 Usando para busca:', alunoUidParaBusca);

      // Obter a turma do aluno no ano letivo atual usando o histórico
      const turmaIdNoAno = getTurmaAlunoNoAno(aluno, anoLetivo);
      console.log('🔍 Turma do aluno no ano', anoLetivo, ':', turmaIdNoAno);

      // Vamos também buscar TODAS as notas para ver os alunoUid disponíveis (debug)
      const todasNotasSnap = await getDocs(collection(db, 'notas'));
      console.log('🔍 TODAS as notas no banco:', todasNotasSnap.docs.map(doc => ({
        id: doc.id,
        alunoUid: doc.data().alunoUid,
        turmaId: doc.data().turmaId,
        nomeAluno: doc.data().nomeAluno || 'Sem nome'
      })));

      // Buscar as notas do aluno na turma do ano letivo atual
      const notasSnap = await getDocs(query(
        collection(db, 'notas'),
        where('alunoUid', '==', alunoUidParaBusca),
        where('turmaId', '==', turmaIdNoAno)
      ));

      console.log('📊 Documentos encontrados para alunoUid =', alunoUidParaBusca, 'e turmaId =', turmaIdNoAno, ':', notasSnap.docs.length);

      if (notasSnap.docs.length === 0) {
        console.log('❌ Nenhuma nota encontrada');
        // Vamos tentar procurar por uid ou nome
        console.log('🔍 Tentando buscar por outros campos...');

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

      console.log('📋 Notas organizadas por bimestre/matéria:', notasPorMateriaBimestre);

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
              <Button variant="primary" onClick={() => openModal()}>
                <PlusCircle className="me-2" size={18} /> Nova Turma
              </Button>
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
                Rematrícula de Alunos
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
                    <div className="col-md-3">
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
                                      {t.isVirtualizada ? (
                                        <span className="badge bg-info text-white px-2 py-1">
                                          <Ghost size={14} className="me-1" />
                                          Virtual
                                        </span>
                                      ) : (
                                        <span className="badge bg-success text-white px-2 py-1">
                                          <CheckCircle2 size={14} className="me-1" />
                                          Ativa
                                        </span>
                                      )}
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
                                            <Dropdown.Item onClick={() => handleMaterializarTurma(t)} className="d-flex align-items-center gap-2 text-success">
                                              <CheckCircle2 size={16} className="text-success" /> Materializar
                                            </Dropdown.Item>
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
                  <div className="row g-3">
                    <div className="col-md-6">
                      <Form.Control
                        type="text"
                        placeholder="Buscar turmas e alunos..."
                        value={buscaRematricula}
                        onChange={e => setBuscaRematricula(e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <Form.Select value={turmaFiltroRematricula} onChange={e => setTurmaFiltroRematricula(e.target.value)}>
                        <option value="">Selecione a turma</option>
                        {turmas.filter(t => !t.isVirtualizada).map(turma => (
                          <option key={turma.id} value={turma.id}>{turma.nome}</option>
                        ))}
                      </Form.Select>
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
                <Card className="mb-4">
                  <Card.Body className="pb-0">
                    <div className="d-flex align-items-center justify-content-between px-2 mb-2">
                      <h3 className="mb-0 d-flex align-items-center gap-2">Lista de Alunos
                        <span className="text-muted" style={{ fontSize: '1rem', verticalAlign: 'middle' }}>({getAlunosFiltrados().length})</span>
                      </h3>
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
                            <th className='text-muted' style={{ width: '80px' }}>Status</th>
                            <th className='text-muted'>Aluno</th>
                            <th className='text-muted'>Situação</th>
                            <th className='text-muted'>Ações</th>
                          </tr>
                        </thead>
                        <tbody className=''>
                          {getAlunosFiltrados().length > 0 ? getAlunosFiltrados().map(aluno => {
                            const foiRematriculado = aluno.turmaId !== turmaFiltroRematricula;
                            
                            return (
                              <tr key={aluno.id} className='align-middle linha-agenda' style={{ textAlign: 'center' }}>
                                <td>
                                  {foiRematriculado ? (
                                    <div className="d-flex align-items-center justify-content-center" title="Rematriculado">
                                      <CheckCircle2 size={20} color="#22c55e" />
                                    </div>
                                  ) : (
                                    <div className="d-flex align-items-center justify-content-center" title="Aguardando rematrícula">
                                      <Clock size={20} color="#9ca3af" />
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <div className="d-flex align-items-center justify-content-center gap-2">
                                    <strong>{aluno.nome}</strong>
                                  </div>
                                </td>
                                <td>
                                  {getStatusBadge(aluno.id)}
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
                                    <Dropdown.Item
                                      className="d-flex align-items-center gap-2"
                                      onClick={() => handleAbrirBoletim(aluno)}
                                    >
                                      <BookOpen size={16} /> Boletim
                                    </Dropdown.Item>
                                    <Dropdown.Item
                                      className="d-flex align-items-center gap-2 text-primary"
                                      onClick={() => handleAbrirRematricula(aluno)}
                                    >
                                      <Edit size={16} className="text-primary" /> Rematricular
                                    </Dropdown.Item>
                                  </Dropdown.Menu>
                                </Dropdown>
                              </td>
                            </tr>
                            );
                          }) : (
                            <tr>
                              <td colSpan={4} className="text-center py-4">
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
                                {turmaDetalhes.isVirtualizada ? (
                                  <span className="badge bg-info px-2 py-1">
                                    <Ghost size={12} className="me-1" />
                                    Virtual (Ano {anoLetivo - 1})
                                  </span>
                                ) : (
                                  <span className="badge bg-success px-2 py-1">
                                    <CheckCircle2 size={12} className="me-1" />
                                    Ativa
                                  </span>
                                )}
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
                        <th style={{ width: '15%' }}>Bimestre</th>
                        {historicoAluno.dadosBoletim.materias.map((materia: string) => (
                          <th key={materia} style={{ minWidth: '120px' }}>{materia}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historicoAluno.dadosBoletim.bimestres.map((bimestre: string) => (
                        <tr key={bimestre}>
                          <td style={{ fontWeight: 600, background: '#f8f9fa' }}>{bimestre}</td>
                          {historicoAluno.dadosBoletim.materias.map((materia: string) => {
                            const nota = historicoAluno.dadosBoletim.notas[bimestre]?.[materia];
                            const mediaFinal = nota?.mediaFinal;
                            const getNotaColor = (valor: number | null | undefined) => {
                              if (valor === null || valor === undefined) return 'text-muted';
                              if (valor >= 7) return 'text-success';
                              if (valor >= 5) return 'text-warning';
                              return 'text-danger';
                            };

                            return (
                              <td
                                key={materia}
                                className={`fw-bold ${getNotaColor(mediaFinal)}`}
                                style={{
                                  fontSize: '1.1rem',
                                  padding: '12px 8px'
                                }}
                              >
                                {mediaFinal !== null && mediaFinal !== undefined ? mediaFinal : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Linha de Média Final */}
                      <tr style={{ background: '#e9ecef', fontWeight: 700 }}>
                        <td style={{ fontWeight: 700, fontSize: '1rem' }}>Média Final</td>
                        {historicoAluno.dadosBoletim.materias.map((materia: string) => {
                          // Calcular média final da matéria (média dos 4 bimestres)
                          const notasBimestres = historicoAluno.dadosBoletim.bimestres
                            .map((bim: string) => historicoAluno.dadosBoletim.notas[bim]?.[materia]?.mediaFinal)
                            .filter((n: number | null | undefined) => n !== null && n !== undefined);

                          const mediaFinalMateria = notasBimestres.length > 0
                            ? (notasBimestres.reduce((sum: number, n: number) => sum + n, 0) / notasBimestres.length).toFixed(1)
                            : null;

                          const getNotaColor = (valor: number | null) => {
                            if (valor === null) return 'text-muted';
                            if (valor >= 6) return 'text-success';
                            if (valor >= 5) return 'text-warning';
                            return 'text-danger';
                          };

                          return (
                            <td
                              key={materia}
                              className={`fw-bold ${getNotaColor(mediaFinalMateria ? parseFloat(mediaFinalMateria) : null)}`}
                              style={{
                                fontSize: '1.2rem',
                                padding: '12px 8px'
                              }}
                            >
                              {mediaFinalMateria !== null ? mediaFinalMateria : '-'}
                            </td>
                          );
                        })}
                      </tr>
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
                    {historicoAluno.dadosBoletim.bimestres.map((bimestre: string) => (
                      <Card key={bimestre} className="mb-3">
                        <Card.Header className="bg-primary text-white">
                          <h6 className="mb-0">{bimestre} Bimestre</h6>
                        </Card.Header>
                        <Card.Body className="p-2">
                          {historicoAluno.dadosBoletim.materias.map((materia: string) => {
                            const nota = historicoAluno.dadosBoletim.notas[bimestre]?.[materia];
                            const mediaFinal = nota?.mediaFinal;
                            const getNotaColor = (valor: number | null | undefined) => {
                              if (valor === null || valor === undefined) return 'text-muted';
                              if (valor >= 7) return 'text-success';
                              if (valor >= 5) return 'text-warning';
                              return 'text-danger';
                            };

                            return (
                              <div key={materia} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                                <span className="fw-semibold">{materia}</span>
                                <span className={`fw-bold fs-5 ${getNotaColor(mediaFinal)}`}>
                                  {mediaFinal !== null && mediaFinal !== undefined ? mediaFinal : '-'}
                                </span>
                              </div>
                            );
                          })}
                        </Card.Body>
                      </Card>
                    ))}
                    {/* Card de Média Final - Mobile */}
                    <Card className="mb-3" style={{ background: '#e9ecef', border: '2px solid #dee2e6' }}>
                      <Card.Header style={{ background: '#6c757d', color: 'white' }}>
                        <h6 className="mb-0 fw-bold">Média Final do Ano</h6>
                      </Card.Header>
                      <Card.Body className="p-2">
                        {historicoAluno.dadosBoletim.materias.map((materia: string) => {
                          // Calcular média final da matéria
                          const notasBimestres = historicoAluno.dadosBoletim.bimestres
                            .map((bim: string) => historicoAluno.dadosBoletim.notas[bim]?.[materia]?.mediaFinal)
                            .filter((n: number | null | undefined) => n !== null && n !== undefined);

                          const mediaFinalMateria = notasBimestres.length > 0
                            ? (notasBimestres.reduce((sum: number, n: number) => sum + n, 0) / notasBimestres.length).toFixed(1)
                            : null;

                          const getNotaColor = (valor: number | null) => {
                            if (valor === null) return 'text-muted';
                            if (valor >= 6) return 'text-success';
                            if (valor >= 5) return 'text-warning';
                            return 'text-danger';
                          };

                          return (
                            <div key={materia} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                              <span className="fw-bold">{materia}</span>
                              <span className={`fw-bold fs-4 ${getNotaColor(mediaFinalMateria ? parseFloat(mediaFinalMateria) : null)}`}>
                                {mediaFinalMateria !== null ? mediaFinalMateria : '-'}
                              </span>
                            </div>
                          );
                        })}
                      </Card.Body>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <BookOpen size={48} className="mb-3 text-muted opacity-50" />
                    <p className="text-muted mb-0">Nenhuma nota encontrada para este aluno.</p>
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

        <ToastContainer position="bottom-end" className="p-3">
          <Toast bg={toast.variant} show={toast.show} onClose={() => setToast(prev => ({ ...prev, show: false }))} delay={3000} autohide>
            <Toast.Body className="text-white">{toast.message}</Toast.Body>
          </Toast>
        </ToastContainer>
      </Container>
    </AppLayout>
  );
}
