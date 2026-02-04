export interface Tarefa {
  id: string;
  materiaId: string;
  titulo?: string;
  descricao: string;
  turmaId: string;
  anoLetivo?: string;
  dataEntrega: string;
  professorId?: string;
  excluida?: boolean;
  bloqueado?: boolean;
  links?: Array<{
    url: string;
    titulo: string;
  }>;
}
