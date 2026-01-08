export interface Professor {
  id: string;
  nome: string;
  email: string;
  status: string;
  turmas: string[];
  dataCriacao?: Date;
}
