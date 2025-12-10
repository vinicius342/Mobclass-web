// src/utils/turmasHelpers.ts

// Tipos leves para evitar dependência de tipos das páginas
export type AlunoLike = { turmaId: string; historicoTurmas?: Record<string, string> };
export type NotaLike = {
  notaParcial?: number | null;
  notaGlobal?: number | null;
  notaParticipacao?: number | null;
  notaRecuperacao?: number | null;
};
export type TurmaLike = { turmaOriginalId?: string };

// Verifica se uma turma é virtualizada (gerada dinamicamente no frontend)
export function isTurmaVirtualizada(turma: TurmaLike): boolean {
  return !!turma.turmaOriginalId;
}

// Obtém a turma do aluno para um ano específico considerando histórico de turmas
export function getTurmaAlunoNoAnoUtil(aluno: AlunoLike, ano: number): string {
  const anoStr = ano.toString();
  if (aluno.historicoTurmas && aluno.historicoTurmas[anoStr]) {
    return aluno.historicoTurmas[anoStr];
  }
  return aluno.turmaId;
}

// Calcula a média final com a mesma lógica utilizada nas telas (média simples + recuperação como teto)
export function calcularMediaFinalUtil(nota: NotaLike): number {
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
}

// Retorna classe de cor com base no valor da nota (suporta undefined)
export function getNotaColorUtil(valor: number | undefined): string {
  if (typeof valor !== 'number') return '';
  if (valor >= 9) return 'text-success';
  if (valor >= 6) return 'text-warning';
  return 'text-danger';
}
