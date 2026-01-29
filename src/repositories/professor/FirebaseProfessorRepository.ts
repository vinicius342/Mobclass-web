import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';
import { Professor } from '../../models/Professor';
import { IProfessorRepository } from './IProfessorRepository';

export class FirebaseProfessorRepository implements IProfessorRepository {
  private collectionName = 'professores';

  async findAll(): Promise<Professor[]> {
    const querySnapshot = await getDocs(collection(db, this.collectionName));
    return querySnapshot.docs.map(doc => this.mapDocToProfessor(doc));
  }

  async findById(id: string): Promise<Professor | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.mapDocToProfessor(docSnap);
  }

  async create(professor: Omit<Professor, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...professor,
      polivalente: !!professor.polivalente,
      dataCriacao: professor.dataCriacao ? Timestamp.fromDate(professor.dataCriacao) : Timestamp.now()
    });
    return docRef.id;
  }

  async update(id: string, professor: Partial<Omit<Professor, 'id'>>): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    const updateData: any = { ...professor };
    if (typeof professor.polivalente !== 'undefined') {
      updateData.polivalente = !!professor.polivalente;
    }
    if (professor.dataCriacao) {
      updateData.dataCriacao = Timestamp.fromDate(professor.dataCriacao);
    }
    await updateDoc(docRef, updateData);
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  private mapDocToProfessor(docSnap: any): Professor {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      nome: data.nome,
      email: data.email,
      status: data.status,
      turmas: data.turmas || [],
      polivalente: !!data.polivalente,
      dataCriacao: data.dataCriacao?.toDate() || new Date()
    };
  }
}
