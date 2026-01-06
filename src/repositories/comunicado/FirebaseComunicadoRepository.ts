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
  orderBy,
} from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';
import { IComunicadoRepository } from './IComunicadoRepository';
import { Comunicado } from '../../models/Comunicado';

export class FirebaseComunicadoRepository implements IComunicadoRepository {
  private collectionName = 'comunicados';

  async listar(): Promise<Comunicado[]> {
    const q = query(collection(db, this.collectionName), orderBy('data', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      status: doc.data().status || 'enviado'
    } as Comunicado));
  }

  async listarPorTurmas(turmaIds: string[]): Promise<Comunicado[]> {
    if (turmaIds.length === 0) return [];
    
    const q = query(
      collection(db, this.collectionName),
      where('turmaId', 'in', turmaIds),
      orderBy('data', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      status: doc.data().status || 'enviado'
    } as Comunicado));
  }

  async buscarPorId(id: string): Promise<Comunicado | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        status: docSnap.data().status || 'enviado'
      } as Comunicado;
    }
    return null;
  }

  async criar(comunicado: Omit<Comunicado, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), comunicado);
    return docRef.id;
  }

  async atualizar(id: string, comunicado: Partial<Omit<Comunicado, 'id'>>): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, comunicado);
  }

  async deletar(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }
}
