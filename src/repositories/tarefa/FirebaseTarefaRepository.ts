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
import { ITarefaRepository } from './ITarefaRepository';
import { Tarefa } from '../../models/Tarefa';

export class FirebaseTarefaRepository implements ITarefaRepository {
  private collectionName = 'tarefas';

  async findAll(): Promise<Tarefa[]> {
    try {
      const querySnapshot = await getDocs(collection(db, this.collectionName));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Tarefa));
    } catch (error) {
      console.error('Erro ao buscar tarefas:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Tarefa | null> {
    try {
      const docSnap = await getDoc(doc(db, this.collectionName, id));
      if (!docSnap.exists()) return null;
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Tarefa;
    } catch (error) {
      console.error('Erro ao buscar tarefa:', error);
      throw error;
    }
  }

  async create(tarefa: Omit<Tarefa, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), tarefa);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);
      throw error;
    }
  }

  async update(id: string, tarefa: Partial<Omit<Tarefa, 'id'>>): Promise<void> {
    try {
      await updateDoc(doc(db, this.collectionName, id), tarefa as any);
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.collectionName, id));
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error);
      throw error;
    }
  }

  async findByTurmaAndMateria(turmaId: string, materiaId: string): Promise<Tarefa[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('turmaId', '==', turmaId),
        where('materiaId', '==', materiaId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Tarefa));
    } catch (error) {
      console.error('Erro ao buscar tarefas por turma e matéria:', error);
      throw error;
    }
  }

  async findByTurmas(turmaIds: string[]): Promise<Tarefa[]> {
    try {
      if (turmaIds.length === 0) return [];
      
      const q = query(
        collection(db, this.collectionName),
        where('turmaId', 'in', turmaIds)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Tarefa));
    } catch (error) {
      console.error('Erro ao buscar tarefas por turmas:', error);
      throw error;
    }
  }
}
