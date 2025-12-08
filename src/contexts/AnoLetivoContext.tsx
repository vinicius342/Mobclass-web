import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../services/firebase/firebase';

interface AnoLetivoContextType {
  anoLetivo: number;
  setAnoLetivo: (ano: number) => void;
  anosDisponiveis: number[];
  carregandoAnos: boolean;
}

const AnoLetivoContext = createContext<AnoLetivoContextType | undefined>(undefined);

export const useAnoLetivo = () => {
  const context = useContext(AnoLetivoContext);
  if (context === undefined) {
    throw new Error('useAnoLetivo deve ser usado dentro de um AnoLetivoProvider');
  }
  return context;
};

interface AnoLetivoProviderProps {
  children: ReactNode;
}

export const AnoLetivoProvider: React.FC<AnoLetivoProviderProps> = ({ children }) => {
  const [anoLetivo, setAnoLetivoState] = useState<number>(() => {
    // Tenta recuperar do localStorage ou usa o ano atual
    const savedAno = localStorage.getItem('anoLetivo');
    return savedAno ? parseInt(savedAno, 10) : new Date().getFullYear();
  });

  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [carregandoAnos, setCarregandoAnos] = useState<boolean>(true);

  // Busca os anos letivos disponíveis nas turmas cadastradas
  useEffect(() => {
    const buscarAnosDisponiveis = async () => {
      try {
        setCarregandoAnos(true);
        
        // Busca todas as turmas
        const turmasQuery = query(collection(db, 'turmas'));
        const snapshot = await getDocs(turmasQuery);
        
        // Extrai os anos letivos únicos das turmas
        const anosEncontrados = new Set<number>();
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.anoLetivo && typeof data.anoLetivo === 'number') {
            anosEncontrados.add(data.anoLetivo);
          }
        });

        // Se não encontrou nenhum ano nas turmas, adiciona o ano atual
        if (anosEncontrados.size === 0) {
          anosEncontrados.add(new Date().getFullYear());
        }

        // Adiciona o próximo ano automaticamente
        const anoAtual = new Date().getFullYear();
        const proximoAno = anoAtual + 1;
        anosEncontrados.add(proximoAno);

        // Converte para array e ordena
        const anosOrdenados = Array.from(anosEncontrados).sort((a, b) => b - a);
        
        setAnosDisponiveis(anosOrdenados);
      } catch (error) {
        console.error('Erro ao buscar anos letivos:', error);
        // Em caso de erro, usa o ano atual
        setAnosDisponiveis([new Date().getFullYear(), new Date().getFullYear() + 1]);
      } finally {
        setCarregandoAnos(false);
      }
    };

    buscarAnosDisponiveis();
  }, []);

  const setAnoLetivo = (ano: number) => {
    setAnoLetivoState(ano);
    localStorage.setItem('anoLetivo', ano.toString());
  };

  useEffect(() => {
    // Salva no localStorage sempre que o ano mudar
    localStorage.setItem('anoLetivo', anoLetivo.toString());
  }, [anoLetivo]);

  const value = {
    anoLetivo,
    setAnoLetivo,
    anosDisponiveis,
    carregandoAnos,
  };

  return (
    <AnoLetivoContext.Provider value={value}>
      {children}
    </AnoLetivoContext.Provider>
  );
};