// src/utils/agendaExport.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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

interface ExportPDFParams {
  dadosFiltrados: AgendaItem[];
  turmas: Turma[];
  materias: Materia[];
  professores: Professor[];
  vinculos: Vinculo[];
  diasSemana: string[];
}

interface ExportExcelParams {
  dadosFiltrados: AgendaItem[];
  turmas: Turma[];
  materias: Materia[];
  professores: Professor[];
  vinculos: Vinculo[];
}

/**
 * Exporta a agenda escolar em formato PDF
 * Cria uma grade de horários para cada turma com professores e horários
 */
export const exportarAgendaPDF = ({
  dadosFiltrados,
  turmas,
  materias,
  professores,
  vinculos,
  diasSemana
}: ExportPDFParams): void => {
  const doc = new jsPDF('landscape', 'mm', 'a4');

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

/**
 * Exporta a agenda escolar em formato Excel
 * Cria uma planilha com todas as aulas filtradas
 */
export const exportarAgendaExcel = ({
  dadosFiltrados,
  turmas,
  materias,
  professores,
  vinculos
}: ExportExcelParams): void => {
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

/**
 * Exporta a grade de horários por turno em formato PDF
 * Usado na visualização de grade por turnos
 */
export const exportarGradeTurnoPDF = ({
  dadosFiltrados,
  turmas,
  materias,
  professores,
  vinculos,
  diasSemana,
  turnoFiltro
}: ExportPDFParams & { turnoFiltro: string }): void => {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  let currentY = 20;

  // Agrupar dados filtrados por turma
  const dadosPorTurma: Record<string, AgendaItem[]> = {};
  dadosFiltrados.forEach(item => {
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

    currentY = (doc as any).lastAutoTable.finalY + 15;
    
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
      columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 45 } },
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
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 80 } },
      tableWidth: professoresTableWidth,
      didDrawPage: () => {
        const horariosRows = horariosTable.length + 1;
        const profRows = professoresTable.length + 1;
        const rowHeight = 8;
        const maxRows = Math.max(horariosRows, profRows);
        currentY = tableTopY + maxRows * rowHeight + 10;
      }
    });
  });
  
  doc.save(`grade-${turnoFiltro}-${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Exporta a grade de horários por turno em formato Excel
 * Usado na visualização de grade por turnos
 */
export const exportarGradeTurnoExcel = ({
  dadosFiltrados,
  turmas,
  materias,
  professores,
  vinculos,
  turnoNome
}: Omit<ExportExcelParams, 'dadosFiltrados'> & { dadosFiltrados: AgendaItem[]; turnoNome: string }): void => {
  const dadosGrade = dadosFiltrados.map(item => {
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
  XLSX.writeFile(workbook, `grade-${turnoNome.toLowerCase()}-${new Date().toISOString().split('T')[0]}.xlsx`);
};
