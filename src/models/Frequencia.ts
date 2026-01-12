export interface Frequencia {
  id: string;
  alunoId: string;
  turmaId: string;
  materiaId: string;
  data: string; // formato: yyyy-MM-dd (para facilitar queries)
  presenca: boolean | null;
  professorId: string;
  observacao?: string; // justificativa de ausência
}
