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
import { db } from '../../services/firebase/firebase';
import { Nota } from '../../models/Nota';
import { INotaRepository } from './INotaRepository';

export class FirebaseNotaRepository implements INotaRepository {
  private collectionName = 'notas';

  async findAll(): Promise<Nota[]> {
    const querySnapshot = await getDocs(collection(db, this.collectionName));
    return querySnapshot.docs.map(doc => this.mapDocToNota(doc));
  }

  async findById(id: string): Promise<Nota | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.mapDocToNota(docSnap);
  }

  async create(nota: Omit<Nota, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...nota,
      dataLancamento: nota.dataLancamento ? Timestamp.fromDate(nota.dataLancamento) : Timestamp.now()
    });
    return docRef.id;
  }

  async update(id: string, nota: Partial<Omit<Nota, 'id'>>): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    const { id: _, ...updateData } = nota as Nota;
    await updateDoc(docRef, updateData);
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  async findByAlunoUid(alunoUid: string): Promise<Nota[]> {
    const q = query(
      collection(db, this.collectionName),
      where('alunoUid', '==', alunoUid)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToNota(doc));
  }

  async findByAlunoUidETurma(alunoUid: string, turmaId: string): Promise<Nota[]> {
    const q = query(
      collection(db, this.collectionName),
      where('alunoUid', '==', alunoUid),
      where('turmaId', '==', turmaId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToNota(doc));
  }

  async findByTurmaId(turmaId: string): Promise<Nota[]> {
    const q = query(
      collection(db, this.collectionName),
      where('turmaId', '==', turmaId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToNota(doc));
  }

  async copiarNotas(alunoUid: string, turmaOrigemId: string, turmaDestinoId: string): Promise<void> {
    // Buscar notas do aluno na turma de origem
    const notasOrigem = await this.findByAlunoUidETurma(alunoUid, turmaOrigemId);

    // Criar cópia de cada nota para a turma de destino
    for (const notaOrigem of notasOrigem) {
      await this.create({
        alunoUid: notaOrigem.alunoUid,
        bimestre: notaOrigem.bimestre,
        materiaId: notaOrigem.materiaId,
        notaGlobal: notaOrigem.notaGlobal,
        notaParcial: notaOrigem.notaParcial,
        notaParticipacao: notaOrigem.notaParticipacao,
        notaRecuperacao: notaOrigem.notaRecuperacao,
        turmaId: turmaDestinoId, // ✅ Muda para turma destino
        nomeAluno: notaOrigem.nomeAluno,
        dataLancamento: new Date(),
      });
    }
  }

  private mapDocToNota(doc: any): Nota {
    const data = doc.data();
    return {
      id: doc.id,
      alunoUid: data.alunoUid || '',
      bimestre: data.bimestre || '',
      dataLancamento: data.dataLancamento?.toDate(),
      materiaId: data.materiaId || '',
      notaGlobal: data.notaGlobal ?? null,
      notaParcial: data.notaParcial ?? null,
      notaParticipacao: data.notaParticipacao ?? null,
      notaRecuperacao: data.notaRecuperacao ?? null,
      turmaId: data.turmaId || '',
      nomeAluno: data.nomeAluno
    };
  }
}