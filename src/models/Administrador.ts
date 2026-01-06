export interface Administrador {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  status: string;
  cargo?: string;
  permissoes?: string[];
  dataCriacao: Date;
}
