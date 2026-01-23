export interface Aluno {
  id: string;
  nome: string;
  email: string;
  turmaId: string;
  status: 'Ativo' | 'Inativo';
  modoAcesso?: 'aluno' | 'responsavel';
  historicoTurmas?: { [anoLetivo: string]: string };
  historicoStatus?: {
    [anoLetivo: string]: 'promovido' | 'reprovado' | 'transferido'
  };

  dataCriacao?: Date;
  ultimaAtualizacao?: Date;
}