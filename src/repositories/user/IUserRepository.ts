export interface IUserRepository {
  updateStatus(uid: string, status: 'Ativo' | 'Inativo'): Promise<void>;
  updateDisabled(uid: string, disabled: boolean): Promise<void>;
  updateFirstAcesso(uid: string, firstAcesso: boolean): Promise<void>;
  /**
   * Busca um usuário da coleção "users" por e-mail (case-insensitive).
   */
  findByEmailCaseInsensitive(email: string): Promise<{ id: string; email: string } | null>;

  /**
   * Verifica se existe um documento na coleção "users" para o UID informado.
   */
  exists(uid: string): Promise<boolean>;
}
