export interface Turma {
  id: string;
  nome: string;
  anoLetivo: string;
  turno: string;
  isVirtual?: boolean;        // Indica se pode ser virtualizada (persistido no banco)
  turmaOriginalId?: string;   // Usado apenas no frontend para turmas virtualizadas
}