import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';
import { IAgendaRepository } from './IAgendaRepository';
import { Agenda } from '../../models/Agenda';

export class FirebaseAgendaRepository implements IAgendaRepository {
  private collectionName = 'agenda';

  async listar(): Promise<Agenda[]> {
    const snap = await getDocs(collection(db, this.collectionName));
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Agenda));
  }

  async buscarPorId(id: string): Promise<Agenda | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Agenda;
    }
    return null;
  }

  async criar(agenda: Omit<Agenda, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), agenda);
    return docRef.id;
  }

  async atualizar(id: string, agenda: Partial<Omit<Agenda, 'id'>>): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, agenda);
  }

  async deletar(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  async listarPorTurma(turmaId: string): Promise<Agenda[]> {
    const q = query(
      collection(db, this.collectionName),
      where('turmaId', '==', turmaId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Agenda));
  }

  async listarPorTurmas(turmaIds: string[]): Promise<Agenda[]> {
    if (turmaIds.length === 0) return [];
    
    const q = query(
      collection(db, this.collectionName),
      where('turmaId', 'in', turmaIds)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Agenda));
  }
}

