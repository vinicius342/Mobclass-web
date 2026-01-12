import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';
import { Materia } from '../../models/Materia';
import { IMateriaRepository } from './IMateriaRepository';

export class FirebaseMateriaRepository implements IMateriaRepository {
  private collectionName = 'materias';

  async findAll(): Promise<Materia[]> {
    const querySnapshot = await getDocs(collection(db, this.collectionName));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Materia));
  }

  async findById(id: string): Promise<Materia | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Materia;
  }

  async create(materia: Omit<Materia, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), materia);
    return docRef.id;
  }

  async update(id: string, materia: Partial<Omit<Materia, 'id'>>): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, materia);
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }
}
