export interface Responsavel {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  cpf?: string;
  status: string;
  alunosVinculados: string[]; // IDs dos alunos vinculados
  dataCriacao: Date;
}
