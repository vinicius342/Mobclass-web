// src/pages/Agenda.tsx - Atualizado para carregar turmas e matérias com base nos vínculos
import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Container, Table, Button, Modal, Form, Row, Col, Dropdown,
  Card,
} from 'react-bootstrap';
import { Calendar, Plus, X, Edit, Trash2, Download, ChevronRight, ChevronDown, Sun, Sunset, Moon, ArrowDownUp } from "lucide-react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, getDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useAnoLetivoAtual } from '../hooks/useAnoLetivoAtual';
import Paginacao from '../components/Paginacao';

// PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// XLSX
import * as XLSX from 'xlsx';

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
  anoLetivo?: string | number;
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

const diasSemana = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
const diasIndexMap = Object.fromEntries(diasSemana.map((d, i) => [d, i]));

export default function Agenda() {
  const { anoLetivo } = useAnoLetivoAtual();
  const { userData } = useAuth()!;
  const isAdmin = userData?.tipo === 'administradores';

  const [agendaPorTurma, setAgendaPorTurma] = useState<Record<string, AgendaItem[]>>({});
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [vinculos, setVinculos] = useState<{ professorId: string; materiaId: string; turmaId: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AgendaItem | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('lancamento-notas');

  const [turmaId, setTurmaId] = useState('');
  const [diaSemana, setDiaSemana] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [turno, setTurno] = useState('');
  const [professorId, setProfessorId] = useState('');
  const [filtroVisualizacaoTurma, setFiltroVisualizacaoTurma] = useState('');
  const [filtroProfessorVisualizacao, setFiltroProfessorVisualizacao] = useState('');
  const [filtroTurnoVisualizacao, setFiltroTurnoVisualizacao] = useState('manha');

  // Novos filtros
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroProfessor, setFiltroProfessor] = useState('');
  const [filtroTurno, setFiltroTurno] = useState('');
  const [filtroDia, setFiltroDia] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itensPorPagina = 15;

  // Estado para ordenação
  const [ordenacao, setOrdenacao] = useState<'turno' | 'dia' | 'horario' | 'materia' | 'professor' | 'turma'>('turno');

  // Estado para controlar expansão dos dias por turma
  const [expandedDays, setExpandedDays] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    const fetchInitial = async () => {
      const profSnap = await getDocs(collection(db, 'professores'));
      let vincSnap;
      if (isAdmin) {
        vincSnap = await getDocs(collection(db, 'professores_materias'));
      } else if (userData && userData.uid) {
        vincSnap = await getDocs(
          query(collection(db, 'professores_materias'), where('professorId', '==', userData.uid))
        );
      } else {
        vincSnap = { docs: [] }; // fallback if userData is null
      }

      const vincList = vincSnap.docs.map(d => d.data() as any);
      setVinculos(vincList);

      const turmaIds = [...new Set(vincList.map(v => v.turmaId))];
      const materiaIds = [...new Set(vincList.map(v => v.materiaId))];

      // Buscar turmas do ano atual
      let turmaDocs;
      if (isAdmin) {
        turmaDocs = (await getDocs(query(collection(db, 'turmas'), where('anoLetivo', '==', anoLetivo.toString())))).docs;
      } else {
        const turmaDocsTemp = await Promise.all(
          turmaIds.map(async id => {
            const turmaDoc = await getDoc(doc(db, 'turmas', id));
            return turmaDoc.data()?.anoLetivo?.toString() === anoLetivo.toString() ? turmaDoc : null;
          })
        );
        turmaDocs = turmaDocsTemp.filter((d): d is typeof turmaDocsTemp[0] & { id: string } => !!d);
      }

      // Buscar turmas do ano anterior para virtualização
      const anoAnterior = anoLetivo - 1;
      let turmasAnoAnteriorSnap;
      if (isAdmin) {
        turmasAnoAnteriorSnap = await getDocs(query(collection(db, 'turmas'), where('anoLetivo', '==', anoAnterior.toString())));
      } else {
        const turmaDocsTemp = await Promise.all(
          turmaIds.map(async id => {
            const turmaDoc = await getDoc(doc(db, 'turmas', id));
            return turmaDoc.data()?.anoLetivo?.toString() === anoAnterior.toString() ? turmaDoc : null;
          })
        );
        turmasAnoAnteriorSnap = { docs: turmaDocsTemp.filter((d): d is typeof turmaDocsTemp[0] & { id: string } => !!d) };
      }


      // Processar turmas do ano atual
      const turmasAtuais = turmaDocs.map(d => ({ id: d.id, ...(d.data() as any) }));

      // Processar turmas do ano anterior
      const turmasAnteriores = turmasAnoAnteriorSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      // Verificar quais turmas do ano anterior podem ser virtualizadas
      const turmasVirtualizadas: Turma[] = [];
      for (const turmaAnterior of turmasAnteriores) {
        const podeVirtualizar = (turmaAnterior as any).isVirtual !== false;
        // Normalizar nomes para comparação (remover espaços extras e case-insensitive)
        const nomeAnterior = (turmaAnterior.nome || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const jaExisteAtual = turmasAtuais.some(t => {
          const nomeAtual = (t.nome || '').trim().toLowerCase().replace(/\s+/g, ' ');
          return nomeAtual === nomeAnterior;
        });

        if (podeVirtualizar && !jaExisteAtual) {
          turmasVirtualizadas.push({
            ...turmaAnterior,
            id: `virtual_${turmaAnterior.id}`,
            anoLetivo: anoLetivo,
            isVirtualizada: true,
            turmaOriginalId: turmaAnterior.id
          });
        }
      }

      // Combinar turmas reais + virtualizadas
      const turmasFinais = [...turmasAtuais, ...turmasVirtualizadas].sort((a, b) => a.nome.localeCompare(b.nome));


      const materiaDocs = isAdmin
        ? (await getDocs(collection(db, 'materias'))).docs
        : await Promise.all(materiaIds.map(id => getDoc(doc(db, 'materias', id))));

      setProfessores(profSnap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
      setMaterias(materiaDocs.map(d => ({ id: d.id, nome: d.data()?.nome || '-' })));
      setTurmas(turmasFinais);
      setLoading(false);
    };
    fetchInitial();
  }, [userData, anoLetivo]);

  useEffect(() => {
    if (!loading && turmas.length > 0) fetchAgendaPorTurma();
  }, [loading, turmas]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroBusca, filtroTurma, filtroProfessor, filtroTurno, filtroDia]);

  const fetchAgendaPorTurma = async () => {
    const snap = await getDocs(collection(db, 'agenda'));
    const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as AgendaItem[];

    // Criar conjunto de IDs válidos incluindo turmas reais e virtualizadas
    const turmaIdsValidos = new Set<string>();
    turmas.forEach(t => {
      if (t.isVirtualizada && t.turmaOriginalId) {
        // Para turmas virtualizadas, o ID original é válido
        turmaIdsValidos.add(t.turmaOriginalId);
      } else {
        // Para turmas reais, o ID normal é válido
        turmaIdsValidos.add(t.id);
      }
    });

    const dataFiltrada = data.filter(item => {
      // Verificar se a turma da aula está no conjunto de turmas válidas
      return turmaIdsValidos.has(item.turmaId);
    });

    const agrupado: Record<string, AgendaItem[]> = {};
    dataFiltrada.forEach(item => {
      // Para agrupar, precisamos encontrar a turma correspondente
      const turma = turmas.find(t => {
        if (t.isVirtualizada && t.turmaOriginalId) {
          // Para turmas virtualizadas, comparar com o ID original
          return t.turmaOriginalId === item.turmaId;
        }
        // Para turmas reais, comparar diretamente
        return t.id === item.turmaId;
      });
      
      if (turma) {
        // Usar o ID da turma no estado como chave (pode ser ID real ou virtual_xxx)
        const turmaKey = turma.id;
        if (!agrupado[turmaKey]) agrupado[turmaKey] = [];
        agrupado[turmaKey].push(item);
      }
    });
    setAgendaPorTurma(agrupado);
  };

  const handleShow = () => setShowModal(true);

  // Função para detectar se estamos em mobile
  const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  };

  const toggleDayExpansion = (turmaId: string, day: string) => {
    setExpandedDays(prev => {
      // No mobile: padrão false (recolhido), no desktop: padrão true (expandido)
      const defaultState = isMobile() ? false : true;
      const currentState = prev[turmaId]?.[day] ?? defaultState;
      return {
        ...prev,
        [turmaId]: {
          ...prev[turmaId],
          [day]: !currentState
        }
      };
    });
  };

  const isDayExpanded = (turmaId: string, day: string) => {
    // No mobile: padrão false (recolhido), no desktop: padrão true (expandido)
    const defaultState = isMobile() ? false : true;
    return expandedDays[turmaId]?.[day] ?? defaultState;
  };

  // Função para verificar se o professor é válido (não contém apenas caracteres especiais)
  const isValidProfessor = (nome: string | undefined) => {
    if (!nome) return false;
    // Remove espaços e verifica se sobra algum caractere alfanumérico
    const semEspacos = nome.trim();
    return /[a-zA-ZÀ-ÿ0-9]/.test(semEspacos);
  };

  // Função para formatar nome do professor
  const formatarNomeProfessor = (nome: string | undefined) => {
    if (!nome || !isValidProfessor(nome)) return '---';
    return `Prof. ${nome}`;
  };

  const limparFiltros = () => {
    setFiltroBusca('');
    setFiltroTurma('');
    setFiltroProfessor('');
    setFiltroTurno('');
    setFiltroDia('');
    setCurrentPage(1);
  };

  const handleClose = () => {
    setEditId(null);
    setTurmaId('');
    setDiaSemana('');
    setInicio('');
    setFim('');
    setMateriaId('');
    setTurno('');
    setProfessorId('');
    setShowModal(false);
  };

  const handleSalvar = async () => {
    if (!turmaId || !diaSemana || !inicio || !fim || !materiaId || !turno || !professorId) return;
    const horario = `${inicio} - ${fim}`;
    const payload = { turmaId, diaSemana, horario, materiaId, turno, professorId };
    if (editId) await updateDoc(doc(db, 'agenda', editId), payload);
    else await addDoc(collection(db, 'agenda'), payload);
    handleClose();
    fetchAgendaPorTurma();
  };

  const handleEditar = (item: AgendaItem) => {
    setEditId(item.id);
    setTurmaId(item.turmaId);
    setDiaSemana(item.diaSemana);
    const [inicioHorario, fimHorario] = item.horario.split(' - ');
    setInicio(inicioHorario);
    setFim(fimHorario);
    setMateriaId(item.materiaId);

    // Determinar o turno baseado no horário
    const hora = parseInt(inicioHorario.split(':')[0]);
    if (hora >= 6 && hora < 12) {
      setTurno('manha');
    } else if (hora >= 12 && hora < 18) {
      setTurno('tarde');
    } else {
      setTurno('noite');
    }

    // Buscar o professor através do vínculo
    const vinculo = vinculos.find(v => v.materiaId === item.materiaId && v.turmaId === item.turmaId);
    if (vinculo) {
      setProfessorId(vinculo.professorId);
    }

    setShowModal(true);
  };

  const handleExcluir = (item: AgendaItem) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const confirmarExclusao = async () => {
    if (itemToDelete) {
      await deleteDoc(doc(db, 'agenda', itemToDelete.id));
      fetchAgendaPorTurma();
      setShowDeleteModal(false);
      setItemToDelete(null);
    }
  };

  const cancelarExclusao = () => {
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  const downloadPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4'); // Orientação paisagem

    // Agrupar dados por turma
    const dadosPorTurma: Record<string, AgendaItem[]> = {};
    dadosFiltrados.forEach(item => {
      if (!dadosPorTurma[item.turmaId]) {
        dadosPorTurma[item.turmaId] = [];
      }
      dadosPorTurma[item.turmaId].push(item);
    });

    let currentY = 20;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;

    // Para cada turma, criar uma grade de horários
    Object.keys(dadosPorTurma).forEach((turmaId, index) => {
      // Buscar turma considerando turmas virtualizadas
      const turma = turmas.find(t => {
        if (t.isVirtualizada && t.turmaOriginalId) {
          return t.turmaOriginalId === turmaId || t.id === turmaId;
        }
        return t.id === turmaId;
      });
      const aulasDaTurma = dadosPorTurma[turmaId];

      // Se não for a primeira turma e não couber na página, criar nova página
      if (index > 0 && currentY > pageHeight - 100) {
        doc.addPage();
        currentY = 20;
      }

      // Título da turma
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(turma?.nome || `Turma ${turmaId}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 15;

      // Organizar aulas por dia da semana e horário
      const gradeHorarios: Record<string, Record<string, { materia: string; professor: string }>> = {};
      const horariosUnicos = new Set<string>();

      aulasDaTurma.forEach(aula => {
        if (!gradeHorarios[aula.diaSemana]) {
          gradeHorarios[aula.diaSemana] = {};
        }

        const materia = materias.find(m => m.id === aula.materiaId);
        const vinculo = vinculos.find(v => v.materiaId === aula.materiaId && v.turmaId === aula.turmaId);
        const professor = professores.find(p => p.id === vinculo?.professorId);

        gradeHorarios[aula.diaSemana][aula.horario] = {
          materia: materia?.nome || '-',
          professor: professor?.nome || '---'
        };

        horariosUnicos.add(aula.horario);
      });

      // Ordenar horários
      const horariosOrdenados = Array.from(horariosUnicos).sort();

      // Preparar dados para a tabela da grade
      const bodyData: string[][] = [];

      horariosOrdenados.forEach(horario => {
        const linha: string[] = [];

        diasSemana.forEach(dia => {
          const aulaInfo = gradeHorarios[dia]?.[horario];
          if (aulaInfo) {
            linha.push(`${aulaInfo.materia} (${aulaInfo.professor})`);
          } else {
            linha.push('------');
          }
        });

        bodyData.push(linha);
      });

      // Criar tabela da grade de horários
      autoTable(doc, {
        startY: currentY,
        head: [diasSemana],
        body: bodyData,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          valign: 'middle',
          halign: 'center'
        },
        headStyles: {
          fillColor: [60, 60, 60],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        columnStyles: {
          0: { cellWidth: (pageWidth - 40) / 5 },
          1: { cellWidth: (pageWidth - 40) / 5 },
          2: { cellWidth: (pageWidth - 40) / 5 },
          3: { cellWidth: (pageWidth - 40) / 5 },
          4: { cellWidth: (pageWidth - 40) / 5 }
        },
        margin: { left: 20, right: 20 }
      });

      // Atualizar currentY após a tabela da grade
      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Adicionar seção de horários das aulas em formato de tabela
      // Layout lado a lado: horários à esquerda, professores à direita
      const horariosTable: string[][] = [];
      let aulaCount = 1;
      horariosOrdenados.forEach((horario) => {
        const temIntervalo = aulasDaTurma.some(a => a.horario === horario && (
          (materias.find(m => m.id === a.materiaId)?.nome || '').toLowerCase().includes('intervalo')
        ));
        if (temIntervalo) {
          horariosTable.push(['Intervalo', horario]);
        } else {
          horariosTable.push([`${aulaCount}ª Aula`, horario]);
          aulaCount++;
        }
      });

      // Professores
      const professoresDaTurma = new Map<string, string[]>();
      aulasDaTurma.forEach(aula => {
        const materia = materias.find(m => m.id === aula.materiaId);
        const vinculo = vinculos.find(v => v.materiaId === aula.materiaId && v.turmaId === aula.turmaId);
        const professor = professores.find(p => p.id === vinculo?.professorId);
        if (professor && materia) {
          if (!professoresDaTurma.has(professor.nome)) {
            professoresDaTurma.set(professor.nome, []);
          }
          const materiasDoProf = professoresDaTurma.get(professor.nome)!;
          if (!materiasDoProf.includes(materia.nome)) {
            materiasDoProf.push(materia.nome);
          }
        }
      });
      const professoresTable: string[][] = [];
      professoresDaTurma.forEach((materias, professor) => {
        professoresTable.push([professor, materias.join(', ')]);
      });

      // Definir largura das tabelas e margens
      const horariosTableWidth = 85; // 30+45+padding
      const professoresTableWidth = 130; // 50+80+padding
      const tableTopY = currentY + 4;
      const leftMargin = 20;
      const rightMargin = pageWidth - professoresTableWidth - 20;

      // Título das tabelas
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Horários das Aulas:', leftMargin, currentY);
      doc.text(`Professores do ${turma?.nome || 'Turma'}:`, rightMargin, currentY);

      // Renderizar tabelas lado a lado
      autoTable(doc, {
        startY: tableTopY,
        margin: { left: leftMargin },
        head: [['Aula', 'Horário']],
        body: horariosTable,
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle', halign: 'center' },
        headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 45 }
        },
        tableWidth: horariosTableWidth,
        didDrawPage: () => { }
      });
      autoTable(doc, {
        startY: tableTopY,
        margin: { left: rightMargin },
        head: [['Professor', 'Disciplinas']],
        body: professoresTable,
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle', halign: 'center' },
        headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 80 }
        },
        tableWidth: professoresTableWidth,
        didDrawPage: () => {
          // Atualiza currentY para o final da tabela mais longa
          const horariosRows = horariosTable.length + 1; // +1 cabeçalho
          const profRows = professoresTable.length + 1;
          const rowHeight = 8; // Aproximado
          const maxRows = Math.max(horariosRows, profRows);
          currentY = tableTopY + maxRows * rowHeight + 10;
        }
      });
    });

    doc.save(`agenda-escolar-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const downloadExcel = () => {
    // Preparar dados para Excel
    const dadosParaExcel = dadosFiltrados.map(item => {
      const turma = turmas.find(t => t.id === item.turmaId);
      const materia = materias.find(m => m.id === item.materiaId);
      const vinculo = vinculos.find(v => v.materiaId === item.materiaId && v.turmaId === item.turmaId);
      const professor = professores.find(p => p.id === vinculo?.professorId);

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

      return {
        Turno: turno,
        'Dia da Semana': item.diaSemana,
        'Horário': item.horario,
        'Matéria': materia?.nome || '-',
        'Professor': professor?.nome || '---',
        'Turma': turma?.nome || '-'
      };
    });

    // Cria a planilha
    const worksheet = XLSX.utils.json_to_sheet(dadosParaExcel);

    // Define a largura das colunas
    worksheet['!cols'] = [
      { wch: 15 }, // Turno
      { wch: 20 }, // Dia da Semana
      { wch: 18 }, // Horário
      { wch: 25 }, // Matéria
      { wch: 25 }, // Professor
      { wch: 20 }  // Turma
    ];

    // Cria o workbook e adiciona a aba
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Agenda de Aulas');

    // Salva o arquivo
    XLSX.writeFile(workbook, `agenda-aulas-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Função para obter cores leves por dia da semana
  const getDayColor = (dia: string) => {
    switch (dia) {
      case 'Segunda-feira':
        return { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' }; // azul
      case 'Terça-feira':
        return { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' }; // verde
      case 'Quarta-feira':
        return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' }; // amarelo
      case 'Quinta-feira':
        return { bg: '#fce7f3', text: '#be185d', border: '#fbcfe8' }; // rosa
      case 'Sexta-feira':
        return { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' }; // índigo
      default:
        return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' }; // cinza
    }
  };

  // Função para determinar o turno baseado no horário
  const getTurnoFromHorario = (horario: string) => {
    const horarioInicio = horario.split(' - ')[0];
    const hora = parseInt(horarioInicio.split(':')[0]);

    if (hora >= 6 && hora < 12) {
      return 'manha';
    } else if (hora >= 12 && hora < 18) {
      return 'tarde';
    } else {
      return 'noite';
    }
  };

  // Função para obter o nome do turno para exibição
  const getTurnoNome = (turno: string) => {
    switch (turno) {
      case 'manha': return 'Manhã';
      case 'tarde': return 'Tarde';
      case 'noite': return 'Noite';
      default: return 'Indefinido';
    }
  };

  // Função para filtrar aulas por professor na visualização
  const filtrarAulasPorProfessor = (aulas: AgendaItem[]) => {
    if (!filtroProfessorVisualizacao) return aulas;

    return aulas.filter(aula => {
      const vinculo = vinculos.find(v => v.materiaId === aula.materiaId && v.turmaId === aula.turmaId);
      return vinculo?.professorId === filtroProfessorVisualizacao;
    });
  };

  // Função para filtrar aulas por turno na visualização
  const filtrarAulasPorTurno = (aulas: AgendaItem[]) => {
    if (!filtroTurnoVisualizacao) return aulas;

    return aulas.filter(aula => {
      const turnoAula = getTurnoFromHorario(aula.horario);
      return turnoAula === filtroTurnoVisualizacao;
    });
  };

  // Função para obter dados filtrados para a grade de turnos
  const obterDadosFiltradosParaGrade = () => {
    if (!filtroTurnoVisualizacao) return [];

    return dadosFiltrados.filter(item => {
      // Aplica o filtro de turno da visualização
      const turnoAula = getTurnoFromHorario(item.horario);
      if (turnoAula !== filtroTurnoVisualizacao) return false;

      // Aplica o filtro de turma da visualização se existir
      if (filtroVisualizacaoTurma) {
        // Considerar turmas virtualizadas
        const turma = turmas.find(t => t.id === filtroVisualizacaoTurma);
        if (turma?.isVirtualizada && turma.turmaOriginalId) {
          // Se a turma do filtro é virtualizada, comparar com o ID original
          if (item.turmaId !== turma.turmaOriginalId && item.turmaId !== filtroVisualizacaoTurma) {
            return false;
          }
        } else {
          // Turma normal
          if (item.turmaId !== filtroVisualizacaoTurma) {
            return false;
          }
        }
      }

      // Aplica o filtro de professor da visualização se existir
      if (filtroProfessorVisualizacao) {
        const vinculo = vinculos.find(v => v.materiaId === item.materiaId && v.turmaId === item.turmaId);
        if (vinculo?.professorId !== filtroProfessorVisualizacao) return false;
      }

      return true;
    });
  };

  const getShiftColor = (turno: string) => {
    switch (turno.toLowerCase()) {
      case 'manhã':
        return { bg: '#fed7aa', color: '#ea580c', variant: 'custom-manha' }; // laranja suave
      case 'tarde':
        return { bg: '#fecaca', color: '#9a3412', variant: 'custom-tarde' }; // #9a3412 claro
      case 'noite':
        return { bg: '#dbeafe', color: '#1e40af', variant: 'custom-noite' }; // azul claro
      default:
        return { bg: '#f3f4f6', color: '#6b7280', variant: 'secondary' }; // cinza
    }
  };

  const dadosOrdenados = Object.values(agendaPorTurma).flat()
    .sort((a, b) => {
      // Buscar turma, considerando turmas virtualizadas
      const turmaA = turmas.find(t => {
        if (t.isVirtualizada && t.turmaOriginalId) {
          return t.turmaOriginalId === a.turmaId || t.id === a.turmaId;
        }
        return t.id === a.turmaId;
      });
      const turmaB = turmas.find(t => {
        if (t.isVirtualizada && t.turmaOriginalId) {
          return t.turmaOriginalId === b.turmaId || t.id === b.turmaId;
        }
        return t.id === b.turmaId;
      });
      
      const nomeTurmaA = turmaA?.nome || '';
      const nomeTurmaB = turmaB?.nome || '';
      const nomeDiff = nomeTurmaA.localeCompare(nomeTurmaB);
      if (nomeDiff !== 0) return nomeDiff;
      const diaDiff = diasIndexMap[a.diaSemana] - diasIndexMap[b.diaSemana];
      return diaDiff !== 0 ? diaDiff : a.horario.localeCompare(b.horario);
    });

  const dadosFiltrados = dadosOrdenados.filter(item => {
    // Buscar turma, considerando turmas virtualizadas
    const turma = turmas.find(t => {
      if (t.isVirtualizada && t.turmaOriginalId) {
        return t.turmaOriginalId === item.turmaId || t.id === item.turmaId;
      }
      return t.id === item.turmaId;
    });
    
    const materia = materias.find(m => m.id === item.materiaId);
    const vinculo = vinculos.find(v => v.materiaId === item.materiaId && v.turmaId === item.turmaId);
    const professor = professores.find(p => p.id === vinculo?.professorId);

    // Filtro de busca geral (incluindo professores)
    if (filtroBusca) {
      const termoBusca = filtroBusca.toLowerCase();
      const contemBusca =
        turma?.nome.toLowerCase().includes(termoBusca) ||
        materia?.nome.toLowerCase().includes(termoBusca) ||
        professor?.nome.toLowerCase().includes(termoBusca) ||
        item.diaSemana.toLowerCase().includes(termoBusca) ||
        item.horario.toLowerCase().includes(termoBusca);
      if (!contemBusca) return false;
    }

    // Filtro de turma específica - considerar turmas virtualizadas
    if (filtroTurma) {
      const turmaFiltro = turmas.find(t => t.id === filtroTurma);
      if (turmaFiltro?.isVirtualizada && turmaFiltro.turmaOriginalId) {
        // Se a turma do filtro é virtualizada, comparar com o ID original
        if (item.turmaId !== turmaFiltro.turmaOriginalId && item.turmaId !== filtroTurma) {
          return false;
        }
      } else {
        // Turma normal
        if (item.turmaId !== filtroTurma) {
          return false;
        }
      }
    }

    // Filtro de professor
    if (filtroProfessor && vinculo?.professorId !== filtroProfessor) return false;

    // Filtro de turno (baseado no horário)
    if (filtroTurno) {
      const horarioInicio = item.horario.split(' - ')[0];
      const hora = parseInt(horarioInicio.split(':')[0]);
      if (filtroTurno === 'manha' && (hora < 6 || hora >= 12)) return false;
      if (filtroTurno === 'tarde' && (hora < 12 || hora >= 18)) return false;
      if (filtroTurno === 'noite' && (hora < 18 || hora >= 24)) return false;
    }

    // Filtro de dia da semana
    if (filtroDia && item.diaSemana !== filtroDia) return false;

    return true;
  });

  // Aplicar ordenação para tabela
  const dadosOrdenadosTabela = [...dadosFiltrados].sort((a, b) => {
    const turmaA = turmas.find(t => t.id === a.turmaId)?.nome || '';
    const turmaB = turmas.find(t => t.id === b.turmaId)?.nome || '';
    const materiaA = materias.find(m => m.id === a.materiaId)?.nome || '';
    const materiaB = materias.find(m => m.id === b.materiaId)?.nome || '';

    // Obter professor via vínculo
    const vinculoA = vinculos.find(v => v.materiaId === a.materiaId && v.turmaId === a.turmaId);
    const vinculoB = vinculos.find(v => v.materiaId === b.materiaId && v.turmaId === b.turmaId);
    const professorA = vinculoA ? professores.find(p => p.id === vinculoA.professorId)?.nome || '' : '';
    const professorB = vinculoB ? professores.find(p => p.id === vinculoB.professorId)?.nome || '' : '';

    // Obter turno
    const getTurnoFromHorario = (horario: string) => {
      const horarioInicio = horario.split(' - ')[0];
      const hora = parseInt(horarioInicio.split(':')[0]);
      if (hora >= 6 && hora < 12) return 'Manhã';
      if (hora >= 12 && hora < 18) return 'Tarde';
      return 'Noite';
    };

    switch (ordenacao) {
      case 'turno':
        const turnoA = getTurnoFromHorario(a.horario);
        const turnoB = getTurnoFromHorario(b.horario);
        return turnoA.localeCompare(turnoB);

      case 'dia':
        return diasIndexMap[a.diaSemana] - diasIndexMap[b.diaSemana];

      case 'horario':
        return a.horario.localeCompare(b.horario);

      case 'materia':
        return materiaA.localeCompare(materiaB);

      case 'professor':
        return professorA.localeCompare(professorB);

      case 'turma':
        return turmaA.localeCompare(turmaB);

      default:
        return 0;
    }
  });

  const totalPaginas = Math.ceil(dadosOrdenadosTabela.length / itensPorPagina);
  const dadosPaginados = dadosOrdenadosTabela.slice((currentPage - 1) * itensPorPagina, currentPage * itensPorPagina);

  return (
    <AppLayout>
      <Container className="my-4">

        <div className="border-gray-200 mb-3">
          {/* Header */}
          <div className="mb-4 px-1">
            <div className="d-flex align-items-center gap-2 mb-1">
              <Calendar size={32} color="#2563eb" style={{ minWidth: 32, minHeight: 32 }} />
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
                Gestão de Agenda Escolar
              </h1>
            </div>
            <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
              Gerencie aulas, horários e turnos
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="container px-0">
          <div className="d-flex py-3">
            <div className="custom-tabs-container">
              <button
                className={`custom-tab ${activeTab === 'lancamento-notas' ? 'active' : ''}`}
                onClick={() => setActiveTab('lancamento-notas')}
                type="button"
              >
                Cadastro de Agendas
              </button>
              <button
                className={`custom-tab ${activeTab === 'visualizacao-resultados' ? 'active' : ''}`}
                onClick={() => setActiveTab('visualizacao-resultados')}
                type="button"
              >
                Grade por Turnos
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'lancamento-notas' && isAdmin && (
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
                  <Col md={3} className="d-flex align-items-center justify-content-end">
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

            <Row className="align-items-center">
              <Col md={6}>
                <Card className="mb-3 mb-custom-mobile-0">
                  <Card.Body className="py-3 px-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center gap-2 px-3">
                        <Download size={18} className='nothing-in-mobile' />
                        <h6 className="text-dark fw-medium mb-0">Exportar Agenda</h6>
                      </div>
                      <div className="d-flex gap-2">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={downloadPDF}
                        >
                          Exportar PDF
                        </Button>
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={downloadExcel}
                        >
                          Exportar Excel
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6} className="d-flex justify-content-end">
                <Button
                  variant='outline-primary'
                  className="d-flex align-items-center gap-2 mb-2"
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

                      // Buscar turma correspondente ao turmaId da aula

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
        )}

        {/* visualizacao de horarios */}
        {activeTab === 'visualizacao-resultados' && (
          <div>
            {/* Filtros da visualização por turnos */}
            <Card className="mb-3">
              <Card.Body>
                <Row className='mb-3'>
                  <Col md={6}>
                    <Form.Select value={filtroVisualizacaoTurma} onChange={e => setFiltroVisualizacaoTurma(e.target.value)}>
                      <option value="">Todas as Turmas</option>
                      {[...turmas].sort((a, b) => a.nome.localeCompare(b.nome)).map(t => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Select value={filtroProfessorVisualizacao} onChange={e => setFiltroProfessorVisualizacao(e.target.value)}>
                      <option value="">Todos os Professores</option>
                      {[...professores].sort((a, b) => a.nome.localeCompare(b.nome)).map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </Form.Select>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
            <Row className='mb-3'>
              <Col md={12}>
                <div className="custom-tabs-container">
                  <button
                    className={`custom-tab ${filtroTurnoVisualizacao === 'manha' ? 'active' : ''}`}
                    onClick={() => setFiltroTurnoVisualizacao(filtroTurnoVisualizacao === 'manha' ? '' : 'manha')}
                    type="button"
                  >
                    <Sun size={18} />
                    Manhã
                  </button>
                  <button
                    className={`custom-tab ${filtroTurnoVisualizacao === 'tarde' ? 'active' : ''}`}
                    onClick={() => setFiltroTurnoVisualizacao(filtroTurnoVisualizacao === 'tarde' ? '' : 'tarde')}
                    type="button"
                  >
                    <Sunset size={18} />
                    Tarde
                  </button>
                  <button
                    className={`custom-tab ${filtroTurnoVisualizacao === 'noite' ? 'active' : ''}`}
                    onClick={() => setFiltroTurnoVisualizacao(filtroTurnoVisualizacao === 'noite' ? '' : 'noite')}
                    type="button"
                  >
                    <Moon size={18} />
                    Noite
                  </button>
                </div>
              </Col>
            </Row>

            {/* Card de Exportação - aparece quando um turno está selecionado */}
            {filtroTurnoVisualizacao && (
              <Col md={6}>
                <Card className="mb-3">
                  <Card.Body className="py-3 px-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center gap-2 px-3">
                        <Download size={18} />
                        <h6 className="text-dark fw-medium mb-0">Exportar Grade(s)</h6>
                      </div>
                      <div className="d-flex gap-2">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => {
                            // Exportar PDF no mesmo padrão da agenda principal, por turma
                            const doc = new jsPDF('landscape', 'mm', 'a4');
                            const pageHeight = doc.internal.pageSize.height;
                            const pageWidth = doc.internal.pageSize.width;
                            let currentY = 20;

                            // Agrupar dados filtrados por turma
                            const dadosGrade = obterDadosFiltradosParaGrade();
                            const dadosPorTurma: Record<string, AgendaItem[]> = {};
                            dadosGrade.forEach(item => {
                              if (!dadosPorTurma[item.turmaId]) dadosPorTurma[item.turmaId] = [];
                              dadosPorTurma[item.turmaId].push(item);
                            });

                            Object.keys(dadosPorTurma).forEach((turmaId, index) => {
                              // Buscar turma considerando turmas virtualizadas
                              const turma = turmas.find(t => {
                                if (t.isVirtualizada && t.turmaOriginalId) {
                                  return t.turmaOriginalId === turmaId || t.id === turmaId;
                                }
                                return t.id === turmaId;
                              });
                              const aulasDaTurma = dadosPorTurma[turmaId];
                              if (index > 0 && currentY > pageHeight - 100) {
                                doc.addPage();
                                currentY = 20;
                              }
                              // Título da turma
                              doc.setFontSize(16);
                              doc.setFont('helvetica', 'bold');
                              doc.text(turma?.nome || `Turma ${turmaId}`, pageWidth / 2, currentY, { align: 'center' });
                              currentY += 15;

                              // Organizar aulas por dia da semana e horário
                              const gradeHorarios: Record<string, Record<string, { materia: string; professor: string }>> = {};
                              const horariosUnicos = new Set<string>();
                              aulasDaTurma.forEach(aula => {
                                if (!gradeHorarios[aula.diaSemana]) gradeHorarios[aula.diaSemana] = {};
                                const materia = materias.find(m => m.id === aula.materiaId);
                                const vinculo = vinculos.find(v => v.materiaId === aula.materiaId && v.turmaId === aula.turmaId);
                                const professor = professores.find(p => p.id === vinculo?.professorId);
                                gradeHorarios[aula.diaSemana][aula.horario] = {
                                  materia: materia?.nome || '-',
                                  professor: professor?.nome || '---'
                                };
                                horariosUnicos.add(aula.horario);
                              });
                              const horariosOrdenados = Array.from(horariosUnicos).sort();
                              // Preparar dados para a tabela da grade
                              const bodyData: string[][] = [];
                              horariosOrdenados.forEach(horario => {
                                const linha: string[] = [];
                                diasSemana.forEach(dia => {
                                  const aulaInfo = gradeHorarios[dia]?.[horario];
                                  if (aulaInfo) {
                                    linha.push(`${aulaInfo.materia} (${aulaInfo.professor})`);
                                  } else {
                                    linha.push('------');
                                  }
                                });
                                bodyData.push(linha);
                              });
                              // Criar tabela da grade de horários
                              autoTable(doc, {
                                startY: currentY,
                                head: [diasSemana],
                                body: bodyData,
                                styles: { fontSize: 8, cellPadding: 2, valign: 'middle', halign: 'center' },
                                headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
                                columnStyles: {
                                  0: { cellWidth: (pageWidth - 40) / 5 },
                                  1: { cellWidth: (pageWidth - 40) / 5 },
                                  2: { cellWidth: (pageWidth - 40) / 5 },
                                  3: { cellWidth: (pageWidth - 40) / 5 },
                                  4: { cellWidth: (pageWidth - 40) / 5 }
                                },
                                margin: { left: 20, right: 20 }
                              });
                              
                              // Atualizar currentY após a tabela da grade
                              currentY = (doc as any).lastAutoTable.finalY + 15;
                              // Tabelas lado a lado: horários e professores
                              // Montar dados da tabela de horários
                              const horariosTable: string[][] = [];
                              let aulaCount = 1;
                              horariosOrdenados.forEach((horario) => {
                                const temIntervalo = aulasDaTurma.some(a => a.horario === horario && (
                                  (materias.find(m => m.id === a.materiaId)?.nome || '').toLowerCase().includes('intervalo')
                                ));
                                if (temIntervalo) {
                                  horariosTable.push(['Intervalo', horario]);
                                } else {
                                  horariosTable.push([`${aulaCount}ª Aula`, horario]);
                                  aulaCount++;
                                }
                              });
                              // Professores
                              const professoresDaTurma = new Map<string, string[]>();
                              aulasDaTurma.forEach(aula => {
                                const materia = materias.find(m => m.id === aula.materiaId);
                                const vinculo = vinculos.find(v => v.materiaId === aula.materiaId && v.turmaId === aula.turmaId);
                                const professor = professores.find(p => p.id === vinculo?.professorId);
                                if (professor && materia) {
                                  if (!professoresDaTurma.has(professor.nome)) {
                                    professoresDaTurma.set(professor.nome, []);
                                  }
                                  const materiasDoProf = professoresDaTurma.get(professor.nome)!;
                                  if (!materiasDoProf.includes(materia.nome)) {
                                    materiasDoProf.push(materia.nome);
                                  }
                                }
                              });
                              const professoresTable: string[][] = [];
                              professoresDaTurma.forEach((materias, professor) => {
                                professoresTable.push([professor, materias.join(', ')]);
                              });
                              // Definir largura das tabelas e margens
                              const horariosTableWidth = 85;
                              const professoresTableWidth = 130;
                              const tableTopY = currentY + 4;
                              const leftMargin = 20;
                              const rightMargin = pageWidth - professoresTableWidth - 20;
                              // Título das tabelas
                              doc.setFontSize(10);
                              doc.setFont('helvetica', 'bold');
                              doc.text('Horários das Aulas:', leftMargin, currentY);
                              doc.text(`Professores do ${turma?.nome || 'Turma'}:`, rightMargin, currentY);
                              // Renderizar tabelas lado a lado
                              autoTable(doc, {
                                startY: tableTopY,
                                margin: { left: leftMargin },
                                head: [['Aula', 'Horário']],
                                body: horariosTable,
                                styles: { fontSize: 8, cellPadding: 2, valign: 'middle', halign: 'center' },
                                headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
                                columnStyles: {
                                  0: { cellWidth: 30 },
                                  1: { cellWidth: 45 }
                                },
                                tableWidth: horariosTableWidth,
                                didDrawPage: () => { }
                              });
                              autoTable(doc, {
                                startY: tableTopY,
                                margin: { left: rightMargin },
                                head: [['Professor', 'Disciplinas']],
                                body: professoresTable,
                                styles: { fontSize: 8, cellPadding: 2, valign: 'middle', halign: 'center' },
                                headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
                                columnStyles: {
                                  0: { cellWidth: 50 },
                                  1: { cellWidth: 80 }
                                },
                                tableWidth: professoresTableWidth,
                                didDrawPage: () => {
                                  // Atualiza currentY para o final da tabela mais longa
                                  const horariosRows = horariosTable.length + 1;
                                  const profRows = professoresTable.length + 1;
                                  const rowHeight = 8;
                                  const maxRows = Math.max(horariosRows, profRows);
                                  currentY = tableTopY + maxRows * rowHeight + 10;
                                }
                              });
                            });
                            doc.save(`grade-${filtroTurnoVisualizacao}-${new Date().toISOString().split('T')[0]}.pdf`);
                          }}
                        >
                          Exportar PDF
                        </Button>
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={() => {
                            // Função para exportar Excel da grade selecionada
                            const turnoNome = getTurnoNome(filtroTurnoVisualizacao);

                            // Usar os dados filtrados que consideram todos os filtros aplicados
                            const dadosGrade = obterDadosFiltradosParaGrade().map(item => {
                              const turma = turmas.find(t => t.id === item.turmaId);
                              const materia = materias.find(m => m.id === item.materiaId);
                              const vinculo = vinculos.find(v => v.materiaId === item.materiaId && v.turmaId === item.turmaId);
                              const professor = professores.find(p => p.id === vinculo?.professorId);

                              return {
                                'Turma': turma?.nome || '-',
                                'Dia da Semana': item.diaSemana,
                                'Horário': item.horario,
                                'Matéria': materia?.nome || '-',
                                'Professor': professor?.nome || '---'
                              };
                            });

                            const worksheet = XLSX.utils.json_to_sheet(dadosGrade);

                            worksheet['!cols'] = [
                              { wch: 20 }, // Turma
                              { wch: 20 }, // Dia da Semana
                              { wch: 18 }, // Horário
                              { wch: 25 }, // Matéria
                              { wch: 25 }  // Professor
                            ];

                            const workbook = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(workbook, worksheet, `Grade ${turnoNome}`);

                            XLSX.writeFile(workbook, `grade-${filtroTurnoVisualizacao}-${new Date().toISOString().split('T')[0]}.xlsx`);
                          }}
                        >
                          Exportar Excel
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            )}

            {/* Mensagem quando nenhum turno for selecionado */}
            {!filtroTurnoVisualizacao && (
              <Card className="shadow-sm mb-4">
                <Card.Body>
                  <div className="text-center text-muted py-5">
                    <FontAwesomeIcon icon={faCircleExclamation} size="2x" className="mb-3" />
                    <div>Selecione um turno para visualizar as aulas organizadas por grade de horários.</div>
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Renderiza as tabelas de turmas apenas se um turno estiver selecionado */}
            {filtroTurnoVisualizacao && (() => {
              const turmasComAulas = turmas
                .filter(t => !filtroVisualizacaoTurma || t.id === filtroVisualizacaoTurma)
                .filter(t => {
                  // Só mostra a turma se ela tiver aulas no turno filtrado
                  let aulasDaTurma = agendaPorTurma[t.id] || [];
                  aulasDaTurma = filtrarAulasPorProfessor(aulasDaTurma);
                  aulasDaTurma = filtrarAulasPorTurno(aulasDaTurma);
                  return aulasDaTurma.length > 0;
                })
                .sort((a, b) => a.nome.localeCompare(b.nome));

              // Se não há turmas com aulas, exibe mensagem de aviso
              if (turmasComAulas.length === 0) {
                return (
                  <Card className="shadow-sm mb-4">
                    <Card.Body>
                      <div className="text-center text-muted py-5">
                        <FontAwesomeIcon icon={faCircleExclamation} size="2x" className="mb-3" />
                        <div>Não há aulas cadastradas para o turno selecionado.</div>
                      </div>
                    </Card.Body>
                  </Card>
                );
              }

              return turmasComAulas.map(t => {
                // Filtra as aulas da turma aplicando todos os filtros de visualização
                let aulasDaTurma = agendaPorTurma[t.id] || [];
                aulasDaTurma = filtrarAulasPorProfessor(aulasDaTurma);
                aulasDaTurma = filtrarAulasPorTurno(aulasDaTurma);

                return (
                  <Card key={t.id} className="mb-4 shadow-sm">
                    <Card.Body className="p-4">
                      {/* Versão Desktop - Grade Horizontal */}
                      <div className="d-none d-lg-block">
                        <h4 className="mb-2 fw-bold text-dark pb-2 px-3">{t.nome}</h4>
                        <Row>
                          {diasSemana.map(dia => (
                            <Col key={dia} style={{ flex: `0 0 ${100 / diasSemana.length}%`, maxWidth: `${100 / diasSemana.length}%` }} className="mb-3">
                              <div className="text-center mb-2">
                                <Button
                                  variant="ghost"
                                  onClick={() => toggleDayExpansion(t.id, dia)}
                                  className="d-flex align-items-center gap-1 w-100 justify-content-center fw-semibold text-muted border-0 bg-transparent p-1"
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  {isDayExpanded(t.id, dia) ? (
                                    <ChevronDown size={12} />
                                  ) : (
                                    <ChevronRight size={12} />
                                  )}
                                  <span className="d-none d-lg-inline">{dia}</span>
                                  <span className="d-lg-none">{dia.slice(0, 3)}</span>
                                </Button>
                              </div>
                              {isDayExpanded(t.id, dia) && (
                                <div className="d-flex flex-column gap-2" style={{ minHeight: '140px' }}>
                                  {aulasDaTurma
                                    .filter(a => a.diaSemana === dia)
                                    .sort((a, b) => a.horario.localeCompare(b.horario))
                                    .map((a, idx) => {
                                      const turnoAula = getTurnoFromHorario(a.horario);
                                      const dayColor = getDayColor(dia);

                                      return (
                                        <Card
                                          key={idx}
                                          className="position-relative h-100"
                                          style={{
                                            backgroundColor: dayColor.bg,
                                            borderColor: dayColor.border,
                                            borderWidth: '1px',
                                            borderStyle: 'solid',
                                            transition: 'all 0.2s ease',
                                            cursor: 'pointer',
                                            minHeight: '160px',
                                            minWidth: '140px',
                                            maxWidth: '100%',
                                            color: dayColor.text
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = 'none';
                                          }}
                                        >
                                          <Card.Body className="p-3 h-100 d-flex flex-column justify-content-between">
                                            <div className="space-y-1">
                                              {/* Horário */}
                                              <div className="fw-bold mb-1" style={{ color: 'black', fontSize: '0.8rem' }}>
                                                {a.horario}
                                              </div>

                                              {/* Disciplina */}
                                              <div className="fw-medium mb-1" style={{ fontSize: '0.8rem', color: dayColor.text }}>
                                                {materias.find(m => m.id === a.materiaId)?.nome || '-'}
                                              </div>

                                              {/* Professor */}
                                              <div className="mb-2" style={{ color: 'black', fontSize: '0.7rem', opacity: 0.8 }}>
                                                {(() => {
                                                  const professor = professores.find(p => p.id === vinculos.find(v => v.materiaId === a.materiaId && v.turmaId === a.turmaId)?.professorId);
                                                  return formatarNomeProfessor(professor?.nome);
                                                })()}
                                              </div>
                                            </div>

                                            {/* Badge de Turno e Botões de Editar/Excluir na mesma linha */}
                                            <div className="d-flex justify-content-between align-items-center mt-2">
                                              <span
                                                className="badge badge-turno px-2 py-1"
                                                style={{
                                                  backgroundColor: 'white',
                                                  color: 'black',
                                                  borderRadius: '20px',
                                                  fontWeight: '600',
                                                  fontSize: '0.65rem',
                                                  border: 'none'
                                                }}
                                              >
                                                {getTurnoNome(turnoAula)}
                                              </span>

                                              <div className="d-flex gap-1">
                                                {isAdmin && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setItemToDelete(a);
                                                      setShowDeleteModal(true);
                                                    }}
                                                    className="p-1 border-0 bg-transparent"
                                                    style={{
                                                      minWidth: 'auto',
                                                      fontSize: '0.7rem',
                                                      lineHeight: '1',
                                                      color: '#dc3545'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                                  >
                                                    <Trash2 size={14} />
                                                  </Button>
                                                )}
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditar(a);
                                                  }}
                                                  className="p-1 border-0 bg-transparent"
                                                  style={{
                                                    minWidth: 'auto',
                                                    fontSize: '0.7rem',
                                                    lineHeight: '1',
                                                    color: dayColor.text
                                                  }}
                                                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                                                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                                >
                                                  <Edit size={14} />
                                                </Button>
                                              </div>
                                            </div>
                                          </Card.Body>
                                        </Card>
                                      )
                                    })}
                                  {/* Card para adicionar nova aula */}
                                  <Card
                                    className="border-2"
                                    style={{
                                      borderStyle: 'dashed',
                                      borderColor: '#d1d5db',
                                      transition: 'all 0.2s ease',
                                      cursor: 'pointer',
                                      height: '120px',
                                      minWidth: '140px',
                                      maxWidth: '100%'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.borderColor = '#60a5fa';
                                      e.currentTarget.style.transform = 'translateY(-2px)';
                                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.borderColor = '#d1d5db';
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                    onClick={() => {
                                      setDiaSemana(dia);
                                      setTurmaId(t.id);
                                      handleShow();
                                    }}
                                  >
                                    <Card.Body className="p-2 d-flex flex-column justify-content-center align-items-center" style={{ height: '100%' }}>
                                      <div className="text-muted small text-center mb-1" style={{ fontSize: '0.65rem' }}>
                                        Adicionar Aula
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted d-flex align-items-center justify-content-center border-0 bg-transparent p-0"
                                        style={{
                                          transition: 'color 0.2s',
                                          fontSize: '0.8rem'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.color = '#2563eb'}
                                        onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
                                      >
                                        <Plus size={14} />
                                      </Button>
                                    </Card.Body>
                                  </Card>
                                </div>
                              )}
                            </Col>
                          ))}
                        </Row>
                      </div>

                      {/* Versão Mobile - Lista Vertical */}
                      <div className="d-lg-none turno-cards-container">
                        <div className="turno-card-header">
                          <h4 className="fw-bold text-dark">{t.nome}</h4>
                        </div>

                        <div className="turno-dias-container">
                          {diasSemana.map(dia => {
                            const aulasDoDia = aulasDaTurma
                              .filter(a => a.diaSemana === dia)
                              .sort((a, b) => a.horario.localeCompare(b.horario));

                            const hasClasses = aulasDoDia.length > 0;

                            // Sempre mostra o dia, mesmo sem aulas, para permitir adicionar novas
                            return (
                              <div
                                key={dia}
                                className={`turno-dia-card ${isDayExpanded(t.id, dia) ? 'expanded' : ''} ${!hasClasses ? 'no-classes' : ''}`}
                                onClick={(e) => {
                                  // Só executa no mobile e se não clicou em um botão de ação
                                  const target = e.target as HTMLElement;
                                  if (window.innerWidth <= 768 && !target.closest('.turno-aula-actions, .turno-add-card, .turno-dia-toggle')) {
                                    toggleDayExpansion(t.id, dia);
                                  }
                                }}
                              >
                                <div className="turno-dia-header">
                                  <span
                                    className="turno-dia-titulo"
                                    onClick={() => toggleDayExpansion(t.id, dia)}
                                  >
                                    {dia}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    onClick={() => toggleDayExpansion(t.id, dia)}
                                    className="turno-dia-toggle"
                                  >
                                    {isDayExpanded(t.id, dia) ? (
                                      <ChevronDown size={16} />
                                    ) : (
                                      <ChevronRight size={16} />
                                    )}
                                  </Button>
                                </div>

                                <div className="turno-aulas-lista">
                                  {aulasDoDia.length === 0 ? (
                                    <div className="turno-empty-state">
                                      <div className="turno-empty-icon">📚</div>
                                      <div className="turno-empty-title">Nenhuma aula</div>
                                      <div className="turno-empty-text">Adicione uma aula para este dia</div>
                                    </div>
                                  ) : (
                                    aulasDoDia.map((a, idx) => {
                                      const turnoAula = getTurnoFromHorario(a.horario);
                                      let turnoClass = '';

                                      if (turnoAula === 'manha') turnoClass = 'manha';
                                      else if (turnoAula === 'tarde') turnoClass = 'tarde';
                                      else turnoClass = 'noite';

                                      const materia = materias.find(m => m.id === a.materiaId);
                                      const vinculo = vinculos.find(v => v.materiaId === a.materiaId && v.turmaId === a.turmaId);
                                      const professor = professores.find(p => p.id === vinculo?.professorId);

                                      return (
                                        <div key={idx} className="turno-aula-card">
                                          <div className="turno-aula-header">
                                            <span className="turno-aula-horario">{a.horario}</span>
                                            <div className="turno-aula-actions">
                                              <Button
                                                variant="ghost"
                                                onClick={() => handleEditar(a)}
                                                className="turno-aula-btn edit"
                                              >
                                                <Edit size={16} />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                onClick={() => {
                                                  setItemToDelete(a);
                                                  setShowDeleteModal(true);
                                                }}
                                                className="turno-aula-btn delete"
                                              >
                                                <Trash2 size={16} />
                                              </Button>
                                            </div>
                                          </div>

                                          <div className="turno-aula-body">
                                            <div className="turno-aula-info">
                                              <div className="turno-aula-materia">
                                                {materia?.nome || '-'}
                                              </div>
                                              <div className="turno-aula-professor">
                                                {formatarNomeProfessor(professor?.nome)}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="turno-aula-footer">
                                            <span className={`turno-aula-badge ${turnoClass}`}>
                                              {getTurnoNome(turnoAula)}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}

                                  {/* Card de adicionar aula em mobile */}
                                  <div
                                    className="turno-add-card"
                                    onClick={() => {
                                      setDiaSemana(dia);
                                      setTurmaId(t.id);
                                      handleShow();
                                    }}
                                  >
                                    <div className="turno-add-text">Adicionar Aula</div>
                                    <div className="turno-add-icon">
                                      <Plus size={20} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                )
              });
            })()}
          </div>
        )}

        <Modal show={showModal} onHide={handleClose} centered>
          <Modal.Header closeButton style={{ borderBottom: 'none' }}>
            <div>
              <Modal.Title>{editId ? 'Editar Aula' : 'Adicionar Nova Aula'}</Modal.Title>
              {!editId && (
                <p className="text-muted mb-0 mt-1" style={{ fontSize: '0.8rem' }}>
                  Preencha as informações para criar uma nova aula.
                </p>
              )}
            </div>
          </Modal.Header>
          <Modal.Body className='border-top-0 pb-0'>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Turno *</Form.Label>
                <Form.Select value={turno} onChange={e => setTurno(e.target.value)}>
                  <option value="">Selecione o turno</option>
                  <option value="manha">Manhã</option>
                  <option value="tarde">Tarde</option>
                  <option value="noite">Noite</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Dia da Semana *</Form.Label>
                <Form.Select value={diaSemana} onChange={e => setDiaSemana(e.target.value)}>
                  <option value="">Selecione o dia</option>
                  {diasSemana.map(d => <option key={d} value={d}>{d}</option>)}
                </Form.Select>
              </Form.Group>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Horário Início *</Form.Label>
                    <Form.Control type="time" value={inicio} onChange={e => setInicio(e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Horário Fim *</Form.Label>
                    <Form.Control type="time" value={fim} onChange={e => setFim(e.target.value)} />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Disciplina *</Form.Label>
                <Form.Select value={materiaId} onChange={e => setMateriaId(e.target.value)}>
                  <option value="">Selecione a disciplina</option>
                  {[...materias].sort((a, b) => a.nome.localeCompare(b.nome)).map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Professor *</Form.Label>
                <Form.Select value={professorId} onChange={e => setProfessorId(e.target.value)}>
                  <option value="">Selecione o professor</option>
                  {[...professores].sort((a, b) => a.nome.localeCompare(b.nome)).map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Turma *</Form.Label>
                <Form.Select value={turmaId} onChange={e => setTurmaId(e.target.value)}>
                  <option value="">Selecione a turma</option>
                  {[...turmas].sort((a, b) => a.nome.localeCompare(b.nome)).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </Form.Select>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer className='border-top-0'>
            <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button variant="primary" onClick={handleSalvar}>Salvar</Button>
          </Modal.Footer>
        </Modal>

        {/* Modal de Confirmação de Exclusão */}
        <Modal show={showDeleteModal} onHide={cancelarExclusao} centered>
          <Modal.Header closeButton style={{ borderBottom: 'none' }}>
            <Modal.Title className="text-danger">Confirmar Exclusão</Modal.Title>
          </Modal.Header>
          <Modal.Body className='border-top-0'>
            {itemToDelete && (
              <div>
                <p className="mb-3">
                  Tem certeza que deseja excluir a aula:
                </p>
                <div className="bg-light p-3 rounded mb-3">
                  <p className="mb-2">
                    <strong>Professor:</strong> {professores.find(p => p.id === vinculos.find(v => v.materiaId === itemToDelete.materiaId && v.turmaId === itemToDelete.turmaId)?.professorId)?.nome || '---'}
                  </p>
                  <p className="mb-2">
                    <strong>Disciplina:</strong> {materias.find(m => m.id === itemToDelete.materiaId)?.nome || '-'}
                  </p>
                  <p className="mb-2">
                    <strong>Turma:</strong> {turmas.find(t => t.id === itemToDelete.turmaId)?.nome || '-'}
                  </p>
                  <p className="mb-2">
                    <strong>Dia:</strong> {itemToDelete.diaSemana}
                  </p>
                  <p className="mb-0">
                    <strong>Horário:</strong> {itemToDelete.horario}
                  </p>
                </div>
                <p className="text-muted small mb-0">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className='border-top-0'>
            <Button variant="secondary" onClick={cancelarExclusao} className="d-flex align-items-center gap-2">
              <X size={16} />
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarExclusao} className="d-flex align-items-center gap-2">
              <Trash2 size={16} />
              Excluir
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </AppLayout>
  );
}
