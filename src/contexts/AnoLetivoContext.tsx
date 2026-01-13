import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db, auth } from '../services/firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';

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
  const anoAtual = new Date().getFullYear();

  const [anoLetivo, setAnoLetivoState] = useState<number>(anoAtual);
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [carregandoAnos, setCarregandoAnos] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Monitora o estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
    });

    return () => unsubscribe();
  }, []);

  // Busca os anos letivos disponíveis nas turmas cadastradas APENAS quando autenticado
  useEffect(() => {
    // Não busca se não estiver autenticado
    if (!isAuthenticated) {
      setCarregandoAnos(false);
      setAnosDisponiveis([anoAtual, anoAtual + 1]);
      setAnoLetivoState(anoAtual);
      return;
    }

    const buscarAnosDisponiveis = async () => {
      try {
        setCarregandoAnos(true);

        // Busca todas as turmas
        const turmasQuery = query(collection(db, 'turmas'));
        const snapshot = await getDocs(turmasQuery);

        // Extrai os anos letivos únicos das turmas
        const anosEncontrados = new Set<number>();

        snapshot.docs.forEach(doc => {
          const data = doc.data() as any;
          const raw = data.anoLetivo;
          if (raw === undefined || raw === null) return;
          if (typeof raw === 'number' && !isNaN(raw)) {
            anosEncontrados.add(raw);
          } else if (typeof raw === 'string') {
            const parsed = parseInt(raw, 10);
            if (!isNaN(parsed)) anosEncontrados.add(parsed);
          }
        });

        // Sempre adiciona o ano atual
        anosEncontrados.add(anoAtual);

        // Adiciona o próximo ano
        anosEncontrados.add(anoAtual + 1);

        // Converte para array e ordena
        const anosOrdenados = Array.from(anosEncontrados).sort((a, b) => b - a);

        setAnosDisponiveis(anosOrdenados);

        // Verifica localStorage - se não existir ou for inválido, usa o ano atual
        const savedAno = localStorage.getItem('anoLetivo');
        if (!savedAno) {
          // Não tem nada salvo = usa o ano atual
          setAnoLetivoState(anoAtual);
          localStorage.setItem('anoLetivo', anoAtual.toString());
        } else {
          const anoSalvo = parseInt(savedAno, 10);
          // Se o ano salvo está disponível E é válido, usa ele
          if (!isNaN(anoSalvo) && anosOrdenados.includes(anoSalvo)) {
            setAnoLetivoState(anoSalvo);
          } else {
            // Ano inválido ou não disponível = usa o ano atual
            setAnoLetivoState(anoAtual);
            localStorage.setItem('anoLetivo', anoAtual.toString());
          }
        }
      } catch (error) {
        console.error('Erro ao buscar anos letivos:', error);
        // Em caso de erro, usa o ano atual
        setAnosDisponiveis([anoAtual, anoAtual + 1]);
        setAnoLetivoState(anoAtual);
        localStorage.setItem('anoLetivo', anoAtual.toString());
      } finally {
        setCarregandoAnos(false);
      }
    };

    buscarAnosDisponiveis();
  }, [anoAtual, isAuthenticated]);

  const setAnoLetivo = (ano: number) => {
    setAnoLetivoState(ano);
    localStorage.setItem('anoLetivo', ano.toString());
  };

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