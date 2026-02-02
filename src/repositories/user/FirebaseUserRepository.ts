import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
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

  async updateFirstAcesso(uid: string, firstAcesso: boolean): Promise<void> {
    const docRef = doc(db, this.collectionName, uid);
    await updateDoc(docRef, { firstAcesso });
  }

  async findByEmailCaseInsensitive(email: string): Promise<{ id: string; email: string } | null> {
    const normalized = email.toLowerCase().trim();
    const snapshot = await getDocs(collection(db, this.collectionName));

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as { email?: string };
      const docEmail = (data.email || '').toLowerCase().trim();
      if (docEmail && docEmail === normalized) {
        return { id: docSnap.id, email: data.email || '' };
      }
    }

    return null;
  }

  async exists(uid: string): Promise<boolean> {
    const docRef = doc(db, this.collectionName, uid);
    const snap = await getDoc(docRef);
    return snap.exists();
  }
}
