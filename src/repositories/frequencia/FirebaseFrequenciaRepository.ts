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
  writeBatch
} from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';
import { Frequencia } from '../../models/Frequencia';
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
    const docRef = await addDoc(collection(db, this.collectionName), frequencia);
    return docRef.id;
  }

  async update(id: string, frequencia: Partial<Omit<Frequencia, 'id'>>): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, frequencia);
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

  async findByTurmaMateria(turmaId: string, materiaId: string, data: string): Promise<Frequencia[]> {
    const q = query(
      collection(db, this.collectionName),
      where('turmaId', '==', turmaId),
      where('materiaId', '==', materiaId),
      where('data', '==', data)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToFrequencia(doc));
  }

  async salvarEmLote(frequencias: Omit<Frequencia, 'id'>[]): Promise<void> {
    const batch = writeBatch(db);
    
    for (const freq of frequencias) {
      // ID baseado em turmaId_materiaId_data_alunoId
      const docId = `${freq.turmaId}_${freq.materiaId}_${freq.data}_${freq.alunoId}`;
      const docRef = doc(db, this.collectionName, docId);
      batch.set(docRef, freq);
    }
    
    await batch.commit();
  }

  async copiarFrequencias(alunoId: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    const frequenciasOrigem = await this.findByAlunoIdETurma(alunoId, turmaOrigemId);
    
    for (const freqOrigem of frequenciasOrigem) {
      await this.create({
        alunoId: freqOrigem.alunoId,
        materiaId: freqOrigem.materiaId,
        presenca: freqOrigem.presenca,
        turmaId: turmaDestinoId,
        data: freqOrigem.data,
        professorId: freqOrigem.professorId,
        observacao: freqOrigem.observacao
      });
    }
  }

  async findByAlunoIdEPeriodo(alunoId: string, dataInicio: string, dataFim: string): Promise<Frequencia[]> {
    const q = query(
      collection(db, this.collectionName),
      where('alunoId', '==', alunoId),
      where('data', '>=', dataInicio),
      where('data', '<=', dataFim)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToFrequencia(doc));
  }

  async findByPeriodo(dataInicio: string, dataFim: string): Promise<Frequencia[]> {
    const q = query(
      collection(db, this.collectionName),
      where('data', '>=', dataInicio),
      where('data', '<=', dataFim)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToFrequencia(doc));
  }

  private mapDocToFrequencia(doc: any): Frequencia {
    const data = doc.data();
    return {
      id: doc.id,
      alunoId: data.alunoId || '',
      turmaId: data.turmaId || '',
      materiaId: data.materiaId || '',
      data: data.data || '',
      presenca: data.presenca ?? null,
      professorId: data.professorId || '',
      observacao: data.observacao
    };
  }
}
