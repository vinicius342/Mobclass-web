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
import { IAdministradorRepository } from './IAdministradorRepository';
import { Administrador } from '../../models/Administrador';

export class FirebaseAdministradorRepository implements IAdministradorRepository {
  private collectionName = 'administradores';

  async findAll(): Promise<Administrador[]> {
    try {
      const querySnapshot = await getDocs(collection(db, this.collectionName));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Administrador));
    } catch (error) {
      console.error('Erro ao buscar administradores:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Administrador | null> {
    try {
      const docSnap = await getDoc(doc(db, this.collectionName, id));
      if (!docSnap.exists()) return null;
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Administrador;
    } catch (error) {
      console.error('Erro ao buscar administrador:', error);
      throw error;
    }
  }

  async create(administrador: Omit<Administrador, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), administrador);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao criar administrador:', error);
      throw error;
    }
  }

  async update(id: string, administrador: Partial<Omit<Administrador, 'id'>>): Promise<void> {
    try {
      await updateDoc(doc(db, this.collectionName, id), administrador as any);
    } catch (error) {
      console.error('Erro ao atualizar administrador:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.collectionName, id));
    } catch (error) {
      console.error('Erro ao excluir administrador:', error);
      throw error;
    }
  }
}
