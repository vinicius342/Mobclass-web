import { IUserRepository } from '../../repositories/user/IUserRepository';

export class UserService {
  constructor(private userRepository: IUserRepository) {}

  /**
   * Atualiza o status do usuário na coleção 'users'
   */
  async atualizarStatus(uid: string, status: 'Ativo' | 'Inativo'): Promise<void> {
    await this.userRepository.updateStatus(uid, status);
    
    // Se inativo, também desabilitar no Firebase Auth
    if (status === 'Inativo') {
      await this.userRepository.updateDisabled(uid, true);
    } else {
      await this.userRepository.updateDisabled(uid, false);
    }
  }

  /**
   * Atualiza múltiplos usuários em lote
   */
  async atualizarStatusEmLote(usuarios: Array<{ uid: string; status: 'Ativo' | 'Inativo' }>): Promise<void> {
    await Promise.all(
      usuarios.map(user => this.atualizarStatus(user.uid, user.status))
    );
  }
}
