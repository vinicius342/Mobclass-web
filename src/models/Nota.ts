export interface Nota {
  id: string;
  alunoUid: string;
  bimestre: string;
  dataLancamento: Date;
  materiaId: string;
  notaGlobal: number;
  notaParcial: number;
  notaParticipacao: number | null;
  notaRecuperacao: number | null;
  turmaId: string;
  nomeAluno?: string;
}
