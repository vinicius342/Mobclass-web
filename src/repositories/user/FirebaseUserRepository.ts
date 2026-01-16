import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';
import { IUserRepository } from './IUserRepository';

export class FirebaseUserRepository implements IUserRepository {
  private collectionName = 'users';

  async updateStatus(uid: string, status: 'Ativo' | 'Inativo'): Promise<void> {
    const docRef = doc(db, this.collectionName, uid);
    await updateDoc(docRef, { status });
  }

  async updateDisabled(uid: string, disabled: boolean): Promise<void> {
    const docRef = doc(db, this.collectionName, uid);
    await updateDoc(docRef, { disabled });
  }
}
