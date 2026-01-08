import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';
import { IResponsavelRepository } from './IResponsavelRepository';
import { Responsavel } from '../../models/Responsavel';

export class FirebaseResponsavelRepository implements IResponsavelRepository {
  private collectionName = 'responsaveis';

  async findAll(): Promise<Responsavel[]> {
    try {
      const querySnapshot = await getDocs(collection(db, this.collectionName));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Responsavel));
    } catch (error) {
      console.error('Erro ao buscar responsáveis:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Responsavel | null> {
    try {
      const docSnap = await getDoc(doc(db, this.collectionName, id));
      if (!docSnap.exists()) return null;
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Responsavel;
    } catch (error) {
      console.error('Erro ao buscar responsável:', error);
      throw error;
    }
  }

  async create(responsavel: Omit<Responsavel, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), responsavel);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao criar responsável:', error);
      throw error;
    }
  }

  async update(id: string, responsavel: Partial<Omit<Responsavel, 'id'>>): Promise<void> {
    try {
      await updateDoc(doc(db, this.collectionName, id), responsavel as any);
    } catch (error) {
      console.error('Erro ao atualizar responsável:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.collectionName, id));
    } catch (error) {
      console.error('Erro ao excluir responsável:', error);
      throw error;
    }
  }
}
