import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase/firebase';
import { Aluno } from '../models/Aluno';
import { IAlunoRepository } from './IAlunoRepository';

export class FirebaseAlunoRepository implements IAlunoRepository {
  private collectionName = 'alunos';

  async findAll(): Promise<Aluno[]> {
    const querySnapshot = await getDocs(collection(db, this.collectionName));
    return querySnapshot.docs.map(doc => this.mapDocToAluno(doc));
  }

  async findById(id: string): Promise<Aluno | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.mapDocToAluno(docSnap);
  }

  async create(aluno: Omit<Aluno, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...aluno,
      dataCriacao: Timestamp.now(),
      ultimaAtualizacao: Timestamp.now()
    });
    return docRef.id;
  }

  async update(id: string, aluno: Partial<Omit<Aluno, 'id'>>): Promise<void> {
  const docRef = doc(db, this.collectionName, id);
  const { id: _, ...updateData } = aluno as Aluno;
  await updateDoc(docRef, {
    ...updateData,
    ultimaAtualizacao: Timestamp.now()
  });
}

  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  async findByTurmaId(turmaId: string): Promise<Aluno[]> {
    const q = query(
      collection(db, this.collectionName),
      where('turmaId', '==', turmaId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToAluno(doc));
  }

  async findByTurmaEAnoLetivo(turmaId: string, anoLetivo: string): Promise<Aluno[]> {
    const q = query(
      collection(db, this.collectionName),
      where('turmaId', '==', turmaId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs
      .map(doc => this.mapDocToAluno(doc))
      .filter(aluno => aluno.historicoTurmas?.[anoLetivo] === turmaId);
  }

  async updateHistorico(
    id: string,
    anoAtual: string,
    anoDestino: string,
    turmaId: string,
    status: 'promovido' | 'reprovado' | 'transferido'
  ): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error(`Aluno com id ${id} não encontrado`);
    }

    const aluno = this.mapDocToAluno(docSnap);
    const historicoTurmas = aluno.historicoTurmas || {};
    const historicoStatus = aluno.historicoStatus || {};

    // SEMPRE preservar a turma do ano atual no histórico (se ainda não existir)
    if (!historicoTurmas[anoAtual]) {
      historicoTurmas[anoAtual] = aluno.turmaId;
    }

    // Registrar o status no ano atual
    historicoStatus[anoAtual] = status;

    // Adicionar turma de destino no histórico do ano de destino
    historicoTurmas[anoDestino] = turmaId;

    // Encontrar o maior ano no histórico para definir a turma atual
    const todosAnos = Object.keys(historicoTurmas).map(ano => parseInt(ano));
    const maiorAno = Math.max(...todosAnos);
    const turmaIdAtual = historicoTurmas[maiorAno.toString()];

    await updateDoc(docRef, {
      turmaId: turmaIdAtual,
      historicoTurmas,
      historicoStatus,
      ultimaAtualizacao: Timestamp.now()
    });
  }

  private mapDocToAluno(doc: any): Aluno {
    const data = doc.data();
    return {
      id: doc.id,
      nome: data.nome || '',
      email: data.email,
      turmaId: data.turmaId || '',
      status: data.status || 'Ativo',
      dataCriacao: data.dataCriacao?.toDate(),
      ultimaAtualizacao: data.ultimaAtualizacao?.toDate(),
      historicoTurmas: data.historicoTurmas || {},
      historicoStatus: data.historicoStatus || {}
    };
  }
};