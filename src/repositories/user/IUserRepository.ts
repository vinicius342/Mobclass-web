export interface IUserRepository {
  updateStatus(uid: string, status: 'Ativo' | 'Inativo'): Promise<void>;
  updateDisabled(uid: string, disabled: boolean): Promise<void>;
}
