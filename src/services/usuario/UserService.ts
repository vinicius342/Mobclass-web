import { IUserRepository } from '../../repositories/user/IUserRepository';
import { Responsavel } from '../../models/Responsavel';
import { Administrador } from '../../models/Administrador';
import { Turma as TurmaModel } from '../../models/Turma';

const GERENCIA_USUARIO_BASE_URL =
  'https://us-central1-agenda-digital-e481b.cloudfunctions.net/gerenciaUsuario';

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

  /**
   * Busca usuário na coleção "users" por e-mail (case-insensitive).
   */
  async buscarPorEmailCaseInsensitive(email: string): Promise<{ id: string; email: string } | null> {
    return this.userRepository.findByEmailCaseInsensitive(email);
  }

  /**
   * Atualiza o status somente se existir documento na coleção "users".
   */
  async atualizarStatusSeExistir(uid: string, status: 'Ativo' | 'Inativo'): Promise<void> {
    const exists = await this.userRepository.exists(uid);
    if (!exists) return;
    await this.atualizarStatus(uid, status);
  }

  async marcarPrimeiroAcessoConcluido(uid: string): Promise<void> {
    await this.userRepository.updateFirstAcesso(uid, false);
  }

  private async postGerenciaUsuario<T = any>(
    path: string,
    body: any,
    defaultErrorMessage: string,
  ): Promise<T> {
    const response = await fetch(`${GERENCIA_USUARIO_BASE_URL}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      throw new Error((result && result.message) || defaultErrorMessage);
    }

    return result as T;
  }

  async excluirUsuario(uid: string, tipoUsuario: string): Promise<void> {
    await this.postGerenciaUsuario('excluir-usuario', { uid, tipoUsuario }, 'Erro ao excluir usuário');
  }

  async criarApenasAuth(params: {
    uid: string;
    nome: string;
    email: string;
    tipoUsuario: string;
  }): Promise<void> {
    await this.postGerenciaUsuario('criar-apenas-auth', params, 'Erro ao criar conta de autenticação');
  }

  async removerAuth(uid: string): Promise<void> {
    await this.postGerenciaUsuario('remover-auth', { uid }, 'Erro ao remover conta de autenticação');
  }

  async atualizarEmailUsuario(params: {
    uid: string;
    novoEmail: string;
    tipoUsuario: string;
  }): Promise<void> {
    await this.postGerenciaUsuario('atualizar-email-usuario', params, 'Erro ao atualizar e-mail.');
  }

  async criarUsuario(params: {
    nome: string;
    email: string;
    tipoUsuario: string;
    status: string;
    turmaId?: string | null;
    filhos?: string[];
    turmas?: string[];
    polivalente?: boolean;
    modoAcesso?: string;
    dataCriacao: string;
  }): Promise<any> {
    return this.postGerenciaUsuario('criar-usuario', params, 'Erro ao criar usuário');
  }

  async enviarEmailEsqueceuSenha(email: string): Promise<void> {
    await this.postGerenciaUsuario(
      'esqueceu-senha',
      { email },
      'Erro ao enviar e-mail. Tente novamente mais tarde.',
    );
  }
}

// Tipos e helpers de listagem/relatórios de usuários (antes em UsuariosService)

export type AbaUsuarios = 'todos' | 'professores' | 'alunos' | 'responsaveis' | 'administradores';

export interface UsuarioBaseLista {
  id: string;
  nome: string;
  email: string;
  status?: string;
  tipoUsuario?: 'professores' | 'alunos' | 'responsaveis' | 'administradores';
  turmas?: string[];
  turmaId?: string;
  filhos?: string[];
}

export interface ProfessorLista extends UsuarioBaseLista {
  turmas: string[];
}

export interface AlunoLista extends UsuarioBaseLista {
  turmaId?: string;
}

export interface ContextoUsuarios {
  professores: ProfessorLista[];
  alunos: AlunoLista[];
  responsaveis: Responsavel[];
  administradores: Administrador[];
  turmas: TurmaModel[];
}

export interface FiltrosUsuarios {
  activeTab: AbaUsuarios;
  search: string;
  statusFiltro: string;
  turmaFiltro: string;
}

export const UsuariosService = {
  montarListaBase(contexto: ContextoUsuarios, activeTab: AbaUsuarios): UsuarioBaseLista[] {
    const { professores, alunos, responsaveis, administradores } = contexto;

    if (activeTab === 'todos') {
      return [
        ...professores.map(p => ({ ...p, tipoUsuario: 'professores' as const })),
        ...alunos.map(a => ({ ...a, tipoUsuario: 'alunos' as const })),
        ...responsaveis.map(r => ({ ...r, tipoUsuario: 'responsaveis' as const })),
        ...administradores.map(adm => ({ ...adm, tipoUsuario: 'administradores' as const })),
      ];
    }

    if (activeTab === 'professores') return professores;
    if (activeTab === 'alunos') return alunos;
    if (activeTab === 'responsaveis') return responsaveis;
    return administradores;
  },

  aplicarFiltrosLista(
    lista: UsuarioBaseLista[],
    contexto: ContextoUsuarios,
    filtros: FiltrosUsuarios,
  ): UsuarioBaseLista[] {
    const { alunos, professores, turmas } = contexto;
    const { activeTab, search, statusFiltro, turmaFiltro } = filtros;

    let filtered = lista.filter(u => {
      const searchLower = search.toLowerCase();
      const nameMatch = u.nome.toLowerCase().includes(searchLower);
      const emailMatch = u.email.toLowerCase().includes(searchLower);

      let infoMatch = false;

      if (u.tipoUsuario === 'responsaveis' || activeTab === 'responsaveis') {
        const responsavel = u as unknown as Responsavel;
        if (responsavel.filhos && responsavel.filhos.length > 0) {
          infoMatch = responsavel.filhos.some(filhoId => {
            const aluno = alunos.find(a => a.id === filhoId);
            return aluno && aluno.nome.toLowerCase().includes(searchLower);
          });
        }
      } else if ((u.tipoUsuario === 'alunos' || activeTab === 'alunos') && (u as any).turmaId) {
        const turma = turmas.find(t => t.id === (u as any).turmaId);
        infoMatch = !!(turma && turma.nome.toLowerCase().includes(searchLower));
      } else if (u.tipoUsuario === 'professores' || activeTab === 'professores') {
        const professor = u as any;
        if (professor.turmas && professor.turmas.length > 0) {
          infoMatch = professor.turmas.some((turmaId: string) => {
            const turma = turmas.find(t => t.id === turmaId);
            return turma && turma.nome.toLowerCase().includes(searchLower);
          });
        }
      }

      return nameMatch || emailMatch || infoMatch;
    });

    if (statusFiltro) {
      filtered = filtered.filter(u => (u.status || 'Ativo') === statusFiltro);
    }

    if (turmaFiltro) {
      if (activeTab === 'alunos') {
        filtered = filtered.filter(a => (a as AlunoLista).turmaId === turmaFiltro);
      } else if (activeTab === 'professores') {
        filtered = filtered.filter(p => {
          const professor = p as unknown as ProfessorLista;
          return professor.turmas && professor.turmas.includes(turmaFiltro);
        });
      } else if (activeTab === 'todos') {
        filtered = filtered.filter(u => {
          const isAluno = alunos.find(a => a.id === u.id);
          if (isAluno) {
            return (u as AlunoLista).turmaId === turmaFiltro;
          }

          const isProfessor = professores.find(p => p.id === u.id);
          if (isProfessor) {
            const professor = u as unknown as ProfessorLista;
            return professor.turmas && professor.turmas.includes(turmaFiltro);
          }

          return false;
        });
      }
    }

    return filtered.sort((a, b) => a.nome.localeCompare(b.nome));
  },

  obterListaFiltradaCompleta(contexto: ContextoUsuarios, filtros: FiltrosUsuarios): UsuarioBaseLista[] {
    const base = this.montarListaBase(contexto, filtros.activeTab);
    return this.aplicarFiltrosLista(base, contexto, filtros);
  },

  obterListaPaginada(
    contexto: ContextoUsuarios,
    filtros: FiltrosUsuarios,
    currentPage: number,
    itemsPerPage: number,
  ): UsuarioBaseLista[] {
    const filtrada = this.obterListaFiltradaCompleta(contexto, filtros);
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtrada.slice(startIndex, startIndex + itemsPerPage);
  },

  montarDadosTabelaExportacao(
    usuarios: UsuarioBaseLista[],
    contexto: ContextoUsuarios,
    activeTab: AbaUsuarios,
  ): { headers: string[][]; body: string[][] } {
    const { turmas, alunos } = contexto;

    const body: string[][] = usuarios.map(usuario => {
      let tipo = '';
      let info = '';

      if (activeTab === 'todos') {
        tipo = usuario.tipoUsuario === 'professores' ? 'Professor' :
          usuario.tipoUsuario === 'alunos' ? 'Aluno' :
            usuario.tipoUsuario === 'responsaveis' ? 'Responsável' : 'Administrador';

        if (usuario.tipoUsuario === 'professores' && usuario.turmas) {
          info = usuario.turmas
            .map((id: string) => turmas.find(t => t.id === id)?.nome)
            .filter(Boolean)
            .join(', ');
        } else if (usuario.tipoUsuario === 'alunos' && usuario.turmaId) {
          info = turmas.find(t => t.id === usuario.turmaId)?.nome || '';
        } else if (usuario.tipoUsuario === 'responsaveis' && (usuario as any).filhos) {
          info = (usuario as any).filhos
            .map((filhoId: string) => alunos.find(a => a.id === filhoId)?.nome || 'Desconhecido')
            .join(', ');
        }
      } else {
        if (activeTab === 'professores' && (usuario as any).turmas) {
          info = (usuario as any).turmas
            .map((id: string) => turmas.find(t => t.id === id)?.nome)
            .filter(Boolean)
            .join(', ');
        } else if (activeTab === 'alunos' && (usuario as any).turmaId) {
          info = turmas.find(t => t.id === (usuario as any).turmaId)?.nome || '';
        } else if (activeTab === 'responsaveis' && (usuario as any).filhos) {
          info = (usuario as any).filhos
            .map((filhoId: string) => {
              const aluno = alunos.find(a => a.id === filhoId);
              return aluno?.nome || 'Desconhecido';
            })
            .join(', ');
        }
      }

      return activeTab === 'todos'
        ? [usuario.nome, usuario.email, usuario.status || 'Ativo', tipo, info]
        : [usuario.nome, usuario.email, usuario.status || 'Ativo', info];
    });

    const headers = activeTab === 'todos'
      ? [['Nome', 'E-mail', 'Status', 'Tipo', 'Info']]
      : [[
        'Nome',
        'E-mail',
        'Status',
        activeTab === 'professores'
          ? 'Turmas'
          : activeTab === 'alunos'
            ? 'Turma'
            : activeTab === 'responsaveis'
              ? 'Filhos'
              : 'Info',
      ]];

    return { headers, body };
  },

  montarDadosExcel(
    usuarios: UsuarioBaseLista[],
    contexto: ContextoUsuarios,
    activeTab: AbaUsuarios,
  ): Array<Record<string, string>> {
    const { turmas, alunos } = contexto;

    return usuarios.map(usuario => {
      let tipo = '';
      let info = '';

      if (activeTab === 'todos') {
        tipo = usuario.tipoUsuario === 'professores' ? 'Professor' :
          usuario.tipoUsuario === 'alunos' ? 'Aluno' :
            usuario.tipoUsuario === 'responsaveis' ? 'Responsável' : 'Administrador';

        if (usuario.tipoUsuario === 'professores' && usuario.turmas) {
          info = usuario.turmas
            .map((id: string) => turmas.find(t => t.id === id)?.nome)
            .filter(Boolean)
            .join(', ');
        } else if (usuario.tipoUsuario === 'alunos' && usuario.turmaId) {
          info = turmas.find(t => t.id === usuario.turmaId)?.nome || '';
        } else if (usuario.tipoUsuario === 'responsaveis' && (usuario as any).filhos) {
          info = (usuario as any).filhos
            .map((filhoId: string) => alunos.find(a => a.id === filhoId)?.nome || 'Desconhecido')
            .join(', ');
        }
      } else {
        if (activeTab === 'professores' && (usuario as any).turmas) {
          info = (usuario as any).turmas
            .map((id: string) => turmas.find(t => t.id === id)?.nome)
            .filter(Boolean)
            .join(', ');
        } else if (activeTab === 'alunos' && (usuario as any).turmaId) {
          info = turmas.find(t => t.id === (usuario as any).turmaId)?.nome || '';
        } else if (activeTab === 'responsaveis' && (usuario as any).filhos) {
          info = (usuario as any).filhos
            .map((filhoId: string) => {
              const aluno = alunos.find(a => a.id === filhoId);
              return aluno?.nome || 'Desconhecido';
            })
            .join(', ');
        }
      }

      if (activeTab === 'todos') {
        return {
          Nome: usuario.nome,
          'E-mail': usuario.email,
          Status: usuario.status || 'Ativo',
          Tipo: tipo,
          Info: info,
        };
      }

      const colunaInfo =
        activeTab === 'professores'
          ? 'Turmas'
          : activeTab === 'alunos'
            ? 'Turma'
            : activeTab === 'responsaveis'
              ? 'Filhos'
              : 'Info';

      return {
        Nome: usuario.nome,
        'E-mail': usuario.email,
        Status: usuario.status || 'Ativo',
        [colunaInfo]: info,
      } as Record<string, string>;
    });
  },
};

