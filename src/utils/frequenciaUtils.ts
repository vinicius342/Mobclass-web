/**
 * Formata uma data para o formato yyyy-MM-dd
 */
export const formatarData = (data: Date): string => {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

/**
 * Converte string yyyy-MM-dd para Date local (sem timezone)
 */
export const stringParaDataLocal = (dataString: string): Date => {
  const [ano, mes, dia] = dataString.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
};

/**
 * Verifica se a data é hoje
 */
export const isDataAtual = (dataString: string): boolean => {
  const hoje = formatarData(new Date());
  return dataString === hoje;
};

/**
 * Retorna a data atual no formato yyyy-MM-dd
 */
export const obterDataAtual = (): string => {
  return formatarData(new Date());
};

/**
 * Formata data para exibição (dd/MM/yyyy)
 */
export const formatarDataParaExibicao = (dataString: string): string => {
  const [ano, mes, dia] = dataString.split('-');
  return `${dia}/${mes}/${ano}`;
};

/**
 * Valida se a string está no formato yyyy-MM-dd e é uma data válida
 */
export const validarFormatoData = (data: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(data)) {
    return false;
  }

  const [ano, mes, dia] = data.split('-').map(Number);
  const date = new Date(ano, mes - 1, dia);
  
  return date.getFullYear() === ano 
    && date.getMonth() === mes - 1 
    && date.getDate() === dia;
};

/**
 * Obtém o nome do dia da semana
 */
export const obterNomeDiaSemana = (dataString: string): string => {
  const data = stringParaDataLocal(dataString);
  const diasSemana = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
  ];
  return diasSemana[data.getDay()];
};

/**
 * Adiciona dias a uma data
 */
export const adicionarDias = (dataString: string, dias: number): string => {
  const data = stringParaDataLocal(dataString);
  data.setDate(data.getDate() + dias);
  return formatarData(data);
};

/**
 * Subtrai dias de uma data
 */
export const subtrairDias = (dataString: string, dias: number): string => {
  return adicionarDias(dataString, -dias);
};

/**
 * Compara duas datas (retorna -1 se data1 < data2, 0 se iguais, 1 se data1 > data2)
 */
export const compararDatas = (data1: string, data2: string): number => {
  if (data1 === data2) return 0;
  return data1 < data2 ? -1 : 1;
};

/**
 * Verifica se data1 é anterior a data2
 */
export const isDataAnterior = (data1: string, data2: string): boolean => {
  return compararDatas(data1, data2) === -1;
};

/**
 * Verifica se data1 é posterior a data2
 */
export const isDataPosterior = (data1: string, data2: string): boolean => {
  return compararDatas(data1, data2) === 1;
};

/**
 * Calcula o status de frequência baseado no percentual
 */
export const calcularStatusFrequencia = (percentual: number): {
  variant: 'success' | 'warning' | 'danger';
  texto: string;
} => {
  if (percentual >= 80) {
    return { variant: 'success', texto: 'OK' };
  } else if (percentual >= 60) {
    return { variant: 'warning', texto: 'Regular' };
  } else {
    return { variant: 'danger', texto: 'Crítico' };
  }
};
