import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';
import { IEntregaRepository } from './IEntregaRepository';
import { Entrega } from '../../models/Entrega';

export class FirebaseEntregaRepository implements IEntregaRepository {
  private collectionName = 'entregas';

  async findAll(): Promise<Entrega[]> {
    try {
      const querySnapshot = await getDocs(collection(db, this.collectionName));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Entrega));
    } catch (error) {
      console.error('Erro ao buscar entregas:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Entrega | null> {
    try {
      const docSnap = await getDoc(doc(db, this.collectionName, id));
      if (!docSnap.exists()) return null;
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Entrega;
    } catch (error) {
      console.error('Erro ao buscar entrega:', error);
      throw error;
    }
  }

  async create(entrega: Omit<Entrega, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), entrega);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao criar entrega:', error);
      throw error;
    }
  }

  async update(id: string, entrega: Partial<Omit<Entrega, 'id'>>): Promise<void> {
    try {
      await updateDoc(doc(db, this.collectionName, id), entrega as any);
    } catch (error) {
      console.error('Erro ao atualizar entrega:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.collectionName, id));
    } catch (error) {
      console.error('Erro ao excluir entrega:', error);
      throw error;
    }
  }

  async findByTarefaId(tarefaId: string): Promise<Entrega[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('tarefaId', '==', tarefaId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Entrega));
    } catch (error) {
      console.error('Erro ao buscar entregas por tarefa:', error);
      throw error;
    }
  }

  async findByAlunoAndTarefa(alunoId: string, tarefaId: string): Promise<Entrega | null> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('alunoId', '==', alunoId),
        where('tarefaId', '==', tarefaId)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as Entrega;
    } catch (error) {
      console.error('Erro ao buscar entrega por aluno e tarefa:', error);
      throw error;
    }
  }
}
