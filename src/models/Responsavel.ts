export interface Responsavel {
  id: string;
  nome: string;
  email: string;
  status: string;
  filhos: string[]; // IDs dos alunos vinculados
  dataCriacao?: Date;
}
