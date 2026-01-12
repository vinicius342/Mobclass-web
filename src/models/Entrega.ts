export interface Entrega {
  id: string;
  alunoId: string;
  tarefaId: string;
  dataEntrega: string;
  status: string;
  dataConclusao?: string;
  anexoUrl?: string;
  observacoes?: string;
}
