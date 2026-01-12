import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';
import { Ocorrencia } from '../../models/Ocorrencia';
import { IOcorrenciaRepository } from './IOcorrenciaRepository';

export class FirebaseOcorrenciaRepository implements IOcorrenciaRepository {
  private collectionName = 'ocorrencias';

  async findAll(): Promise<Ocorrencia[]> {
    try {
      const q = query(collection(db, this.collectionName), orderBy('dataCriacao', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ocorrencia[];
    } catch (error) {
      console.error('Erro ao buscar ocorrências:', error);
      return [];
    }
  }

  async findById(id: string): Promise<Ocorrencia | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const snapshot = await getDocs(query(collection(db, this.collectionName)));
      const found = snapshot.docs.find(d => d.id === id);
      return found ? { id: found.id, ...found.data() } as Ocorrencia : null;
    } catch (error) {
      console.error('Erro ao buscar ocorrência:', error);
      return null;
    }
  }

  async create(ocorrencia: Omit<Ocorrencia, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), ocorrencia);
    return docRef.id;
  }

  async update(id: string, ocorrencia: Partial<Omit<Ocorrencia, 'id'>>): Promise<void> {
    await updateDoc(doc(db, this.collectionName, id), ocorrencia as any);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, id));
  }
}
