import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase/firebase';
import { Frequencia } from '../models/Frequencia';
import { IFrequenciaRepository } from './IFrequenciaRepository';

export class FirebaseFrequenciaRepository implements IFrequenciaRepository {
  private collectionName = 'frequencias';

  async findAll(): Promise<Frequencia[]> {
    const querySnapshot = await getDocs(collection(db, this.collectionName));
    return querySnapshot.docs.map(doc => this.mapDocToFrequencia(doc));
  }

  async findById(id: string): Promise<Frequencia | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return this.mapDocToFrequencia(docSnap);
  }

  async create(frequencia: Omit<Frequencia, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...frequencia,
      data: frequencia.data ? Timestamp.fromDate(frequencia.data) : Timestamp.now()
    });
    return docRef.id;
  }

  async update(id: string, frequencia: Partial<Omit<Frequencia, 'id'>>): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    const { id: _, ...updateData } = frequencia as Frequencia;
    
    const dataToUpdate: any = { ...updateData };
    if (updateData.data) {
      dataToUpdate.data = Timestamp.fromDate(updateData.data);
    }
    
    await updateDoc(docRef, dataToUpdate);
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  async findByAlunoId(alunoId: string): Promise<Frequencia[]> {
    const q = query(
      collection(db, this.collectionName),
      where('alunoId', '==', alunoId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToFrequencia(doc));
  }

  async findByAlunoIdETurma(alunoId: string, turmaId: string): Promise<Frequencia[]> {
    const q = query(
      collection(db, this.collectionName),
      where('alunoId', '==', alunoId),
      where('turmaId', '==', turmaId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToFrequencia(doc));
  }

  async findByTurmaId(turmaId: string): Promise<Frequencia[]> {
    const q = query(
      collection(db, this.collectionName),
      where('turmaId', '==', turmaId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToFrequencia(doc));
  }

  async copiarFrequencias(alunoId: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    const frequenciasOrigem = await this.findByAlunoIdETurma(alunoId, turmaOrigemId);
    
    for (const freqOrigem of frequenciasOrigem) {
      await this.create({
        alunoId: freqOrigem.alunoId,
        materiaId: freqOrigem.materiaId,
        presenca: freqOrigem.presenca,
        turmaId: turmaDestinoId,
        data: freqOrigem.data
      });
    }
  }

  private mapDocToFrequencia(doc: any): Frequencia {
    const data = doc.data();
    return {
      id: doc.id,
      alunoId: data.alunoId || '',
      turmaId: data.turmaId || '',
      materiaId: data.materiaId || '',
      data: data.data?.toDate() || new Date(),
      presenca: data.presenca ?? false
    };
  }
}
