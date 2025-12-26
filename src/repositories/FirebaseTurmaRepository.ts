import { db } from '../services/firebase/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Turma } from '../models/Turma';
import { ITurmaRepository } from './ITurmaRepository';

export class FirebaseTurmaRepository implements ITurmaRepository {
  async findAll(): Promise<Turma[]> {
    const snapshot = await getDocs(collection(db, 'turmas'));
    return snapshot.docs.map(d => {
      const data = d.data() as any;
      const anoLetivoStr = typeof data.anoLetivo === 'number' ? String(data.anoLetivo) : data.anoLetivo;
      return { id: d.id, ...data, anoLetivo: anoLetivoStr } as Turma;
    });
  }

  async findById(id: string): Promise<Turma | null> {
    const snapshot = await getDocs(collection(db, 'turmas'));
    const turmaDoc = snapshot.docs.find(doc => doc.id === id);
    if (!turmaDoc) return null;
    const data = turmaDoc.data() as any;
    const anoLetivoStr = typeof data.anoLetivo === 'number' ? String(data.anoLetivo) : data.anoLetivo;
    return { id: turmaDoc.id, ...data, anoLetivo: anoLetivoStr } as Turma;
  }

  async create(turma: Omit<Turma, 'id' | 'turmaOriginalId'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'turmas'), turma);
    return docRef.id;
  }

  async update(id: string, turma: Partial<Omit<Turma, 'id' | 'turmaOriginalId'>>): Promise<void> {
    await updateDoc(doc(db, 'turmas', id), turma);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'turmas', id));
  }
}
