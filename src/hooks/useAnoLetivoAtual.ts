import { useAnoLetivo } from '../contexts/AnoLetivoContext';

/**
 * Hook personalizado que retorna o ano letivo atual para uso em queries do Firestore
 * Pode ser usado em todas as páginas que precisam filtrar dados por ano letivo
 */
export const useAnoLetivoAtual = () => {
  const { anoLetivo, carregandoAnos } = useAnoLetivo();
  
  return {
    anoLetivo,
    anoLetivoString: anoLetivo.toString(),
    carregandoAnos,
  };
};