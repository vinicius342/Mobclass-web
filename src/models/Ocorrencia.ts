export interface Ocorrencia {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  gravidade: 'baixa' | 'media' | 'alta' | 'critica';
  status: 'aberta' | 'em_analise' | 'resolvida' | 'arquivada';
  alunoId: string;
  alunoNome: string;
  turmaId: string;
  turmaNome: string;
  professorId: string;
  professorNome: string;
  dataOcorrencia: string;
  dataCriacao: string;
  dataResolucao?: string;
  observacoes?: string;
  medidas?: string;
}
