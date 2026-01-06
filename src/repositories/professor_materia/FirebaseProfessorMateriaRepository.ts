import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';
import { ProfessorMateria } from '../../models/ProfessorMateria';
import { IProfessorMateriaRepository } from './IProfessorMateriaRepository';

export class FirebaseProfessorMateriaRepository implements IProfessorMateriaRepository {
  private collectionName = 'professores_materias';

  async findAll(): Promise<ProfessorMateria[]> {
    const querySnapshot = await getDocs(collection(db, this.collectionName));
    return querySnapshot.docs.map(doc => this.mapDocToProfessorMateria(doc));
  }

  async findById(id: string): Promise<ProfessorMateria | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.mapDocToProfessorMateria(docSnap);
  }

  async create(professorMateria: Omit<ProfessorMateria, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), professorMateria);
    return docRef.id;
  }

  async update(
    id: string,
    professorMateria: Partial<Omit<ProfessorMateria, 'id'>>
  ): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, professorMateria);
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  async findByProfessorId(professorId: string): Promise<ProfessorMateria[]> {
    const q = query(
      collection(db, this.collectionName),
      where('professorId', '==', professorId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToProfessorMateria(doc));
  }

  async findByMateriaId(materiaId: string): Promise<ProfessorMateria[]> {
    const q = query(
      collection(db, this.collectionName),
      where('materiaId', '==', materiaId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToProfessorMateria(doc));
  }

  async findByTurmaId(turmaId: string): Promise<ProfessorMateria[]> {
    const q = query(
      collection(db, this.collectionName),
      where('turmaId', '==', turmaId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToProfessorMateria(doc));
  }

  async findByProfessorMateriaETurma(
    professorId: string,
    materiaId: string,
    turmaId: string
  ): Promise<ProfessorMateria | null> {
    const q = query(
      collection(db, this.collectionName),
      where('professorId', '==', professorId),
      where('materiaId', '==', materiaId),
      where('turmaId', '==', turmaId)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    return this.mapDocToProfessorMateria(querySnapshot.docs[0]);
  }

  async copiarVinculos(turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    const vinculosOrigem = await this.findByTurmaId(turmaOrigemId);

    const promises = vinculosOrigem.map(vinculo =>
      this.create({
        professorId: vinculo.professorId,
        materiaId: vinculo.materiaId,
        turmaId: turmaDestinoId
      })
    );

    await Promise.all(promises);
  }

  private mapDocToProfessorMateria(doc: any): ProfessorMateria {
    const data = doc.data();
    return {
      id: doc.id,
      professorId: data.professorId || '',
      materiaId: data.materiaId || '',
      turmaId: data.turmaId || ''
    };
  }
}
