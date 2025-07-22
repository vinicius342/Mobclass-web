// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

interface UserData {
  uid: string;
  email: string;
  nome: string;
  tipo: 'administradores' | 'professores' | 'alunos' | 'responsaveis';
  status: 'Ativo' | 'Inativo';
  firstAcesso: boolean;
  turmas: string[]; // Garantido sempre como array
  [key: string]: any;
}

interface AuthContextType {
  userData: UserData | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data?.tipo && data?.status === 'Ativo') {
              const turmas = Array.isArray(data.turmas) ? data.turmas : [];

              const userInfo: UserData = {
                uid: user.uid,
                email: user.email || '',
                nome: data.nome,
                tipo: data.tipo,
                status: data.status,
                firstAcesso: data.firstAcesso,
                turmas,
              };

              console.log('[AuthContext] Usuário autenticado:', userInfo);
              setUserData(userInfo);
            } else {
              console.warn('[AuthContext] Usuário sem tipo válido ou inativo.');
              setUserData(null);
            }
          } else {
            console.warn('[AuthContext] Documento do usuário não encontrado no Firestore.');
            setUserData(null);
          }
        } catch (err) {
          console.error('[AuthContext] Erro ao carregar dados do usuário:', err);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}



