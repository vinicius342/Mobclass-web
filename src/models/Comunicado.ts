import { Timestamp } from 'firebase/firestore';

export interface Comunicado {
  id: string;
  assunto: string;
  mensagem: string;
  turmaId: string;
  turmaNome: string;
  data: Timestamp;
  status: 'enviado' | 'agendado' | 'rascunho';
  dataAgendamento?: Timestamp;
}
