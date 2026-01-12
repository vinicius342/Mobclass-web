/**
 * Trunca um texto adicionando "..." se exceder o comprimento máximo
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Verifica se a mensagem precisa ser truncada
 */
export function needsTruncate(text: string, maxLength: number): boolean {
  return text.length > maxLength;
}
