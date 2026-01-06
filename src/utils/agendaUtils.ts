/**
 * Retorna as cores de fundo e texto para cada dia da semana
 */
export function getDayColor(dia: string): { bg: string; text: string; border: string } {
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
}

/**
 * Retorna o nome formatado do turno
 */
export function getTurnoNome(turno: string): string {
  switch (turno) {
    case 'manha': return 'Manhã';
    case 'tarde': return 'Tarde';
    case 'noite': return 'Noite';
    default: return 'Indefinido';
  }
}

/**
 * Retorna as cores de fundo e texto para cada turno
 */
export function getShiftColor(turno: string): { bg: string; color: string; variant: string } {
  switch (turno.toLowerCase()) {
    case 'manhã':
      return { bg: '#fed7aa', color: '#ea580c', variant: 'custom-manha' }; // laranja suave
    case 'tarde':
      return { bg: '#fecaca', color: '#9a3412', variant: 'custom-tarde' }; // vermelho claro
    case 'noite':
      return { bg: '#dbeafe', color: '#1e40af', variant: 'custom-noite' }; // azul claro
    default:
      return { bg: '#f3f4f6', color: '#6b7280', variant: 'secondary' }; // cinza
  }
}

/**
 * Valida se o nome do professor é válido
 */
export function isValidProfessor(nome: string | undefined): boolean {
  if (!nome) return false;
  const semEspacos = nome.trim();
  return /[a-zA-ZÀ-ÿ0-9]/.test(semEspacos);
}

/**
 * Formata o nome do professor com o prefixo "Prof."
 */
export function formatarNomeProfessor(nome: string | undefined): string {
  if (!nome || !isValidProfessor(nome)) return '---';
  return `Prof. ${nome}`;
}
