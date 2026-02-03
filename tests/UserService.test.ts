import { UserService, UsuariosService, AbaUsuarios, ContextoUsuarios, UsuarioBaseLista } from '../src/services/usuario/UserService';
import { IUserRepository } from '../src/repositories/user/IUserRepository';

class FakeUserRepository implements IUserRepository {
  public updatedStatus: Array<{ uid: string; status: 'Ativo' | 'Inativo' }> = [];
  public updatedDisabled: Array<{ uid: string; disabled: boolean }> = [];
  public updatedFirstAcesso: Array<{ uid: string; firstAcesso: boolean }> = [];
  private usersByEmail: Record<string, { id: string; email: string }> = {};
  public existingUids = new Set<string>();

  updateStatus(uid: string, status: 'Ativo' | 'Inativo'): Promise<void> {
    this.updatedStatus.push({ uid, status });
    this.existingUids.add(uid);
    return Promise.resolve();
  }

  updateDisabled(uid: string, disabled: boolean): Promise<void> {
    this.updatedDisabled.push({ uid, disabled });
    this.existingUids.add(uid);
    return Promise.resolve();
  }

  updateFirstAcesso(uid: string, firstAcesso: boolean): Promise<void> {
    this.updatedFirstAcesso.push({ uid, firstAcesso });
    this.existingUids.add(uid);
    return Promise.resolve();
  }

  async findByEmailCaseInsensitive(email: string): Promise<{ id: string; email: string } | null> {
    const key = email.toLowerCase().trim();
    return this.usersByEmail[key] ?? null;
  }

  async exists(uid: string): Promise<boolean> {
    return this.existingUids.has(uid);
  }

  addUserByEmail(id: string, email: string) {
    this.usersByEmail[email.toLowerCase().trim()] = { id, email };
  }
}

// Mock global fetch para métodos que chamam a Cloud Function gerenciaUsuario
const mockFetch = jest.fn();

beforeAll(() => {
  // @ts-ignore sobrescrevendo fetch global para teste
  global.fetch = mockFetch;
});

beforeEach(() => {
  mockFetch.mockReset();
});

describe('UserService (regras com repositório users)', () => {
  it('atualizarStatus deve atualizar status e disabled corretamente', async () => {
    const repo = new FakeUserRepository();
    const service = new UserService(repo);

    await service.atualizarStatus('uid-1', 'Ativo');
    await service.atualizarStatus('uid-2', 'Inativo');

    expect(repo.updatedStatus).toEqual([
      { uid: 'uid-1', status: 'Ativo' },
      { uid: 'uid-2', status: 'Inativo' },
    ]);

    expect(repo.updatedDisabled).toEqual([
      { uid: 'uid-1', disabled: false },
      { uid: 'uid-2', disabled: true },
    ]);
  });

  it('atualizarStatusEmLote deve delegar para atualizarStatus para cada usuário', async () => {
    const repo = new FakeUserRepository();
    const service = new UserService(repo);

    const usuarios = [
      { uid: 'u1', status: 'Ativo' as const },
      { uid: 'u2', status: 'Inativo' as const },
    ];

    await service.atualizarStatusEmLote(usuarios);

    expect(repo.updatedStatus).toHaveLength(2);
    expect(repo.updatedDisabled).toHaveLength(2);
    expect(repo.updatedStatus.map(u => u.uid)).toEqual(['u1', 'u2']);
  });

  it('buscarPorEmailCaseInsensitive deve delegar para o repositório', async () => {
    const repo = new FakeUserRepository();
    const service = new UserService(repo);

    repo.addUserByEmail('id-1', 'teste@example.com');

    const found = await service.buscarPorEmailCaseInsensitive('TESTE@example.com');
    expect(found).toEqual({ id: 'id-1', email: 'teste@example.com' });
  });

  it('atualizarStatusSeExistir não deve chamar atualizarStatus quando usuário não existe', async () => {
    const repo = new FakeUserRepository();
    const service = new UserService(repo);

    await service.atualizarStatusSeExistir('nao-existe', 'Ativo');
    expect(repo.updatedStatus).toHaveLength(0);

    // Marca como existente e tenta novamente
    repo.existingUids.add('existe');
    await service.atualizarStatusSeExistir('existe', 'Inativo');

    expect(repo.updatedStatus).toHaveLength(1);
    expect(repo.updatedStatus[0]).toEqual({ uid: 'existe', status: 'Inativo' });
  });

  it('marcarPrimeiroAcessoConcluido deve atualizar firstAcesso para false', async () => {
    const repo = new FakeUserRepository();
    const service = new UserService(repo);

    await service.marcarPrimeiroAcessoConcluido('uid-123');

    expect(repo.updatedFirstAcesso).toEqual([
      { uid: 'uid-123', firstAcesso: false },
    ]);
  });
});

describe('UserService (integração com gerenciaUsuario via fetch)', () => {
  const buildOkResponse = (data: any) => ({
    ok: true,
    json: async () => data,
  });

  const buildErrorResponse = (message?: string) => ({
    ok: false,
    json: async () => (message ? { message } : {}),
  });

  it('excluirUsuario deve chamar endpoint correto e não lançar erro em sucesso', async () => {
    const repo = new FakeUserRepository();
    const service = new UserService(repo);

    mockFetch.mockResolvedValueOnce(buildOkResponse({ success: true }));

    await expect(service.excluirUsuario('uid-1', 'professores')).resolves.toBeUndefined();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/excluir-usuario');
    expect((options as any).method).toBe('POST');
    expect(JSON.parse((options as any).body)).toEqual({ uid: 'uid-1', tipoUsuario: 'professores' });
  });

  it('criarApenasAuth deve propagar mensagem de erro vinda da API', async () => {
    const repo = new FakeUserRepository();
    const service = new UserService(repo);

    mockFetch.mockResolvedValueOnce(buildErrorResponse('email já utilizado'));

    await expect(
      service.criarApenasAuth({ uid: 'u1', nome: 'Nome', email: 'a@b.com', tipoUsuario: 'professores' })
    ).rejects.toThrow('email já utilizado');
  });

  it('removerAuth deve lançar erro padrão quando API não retorna mensagem', async () => {
    const repo = new FakeUserRepository();
    const service = new UserService(repo);

    mockFetch.mockResolvedValueOnce(buildErrorResponse());

    await expect(service.removerAuth('uid-xyz')).rejects.toThrow('Erro ao remover conta de autenticação');
  });

  it('atualizarEmailUsuario deve enviar payload completo ao endpoint', async () => {
    const repo = new FakeUserRepository();
    const service = new UserService(repo);

    mockFetch.mockResolvedValueOnce(buildOkResponse({}));

    await service.atualizarEmailUsuario({ uid: 'u1', novoEmail: 'novo@exemplo.com', tipoUsuario: 'alunos' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/atualizar-email-usuario');
    expect(JSON.parse((options as any).body)).toEqual({
      uid: 'u1',
      novoEmail: 'novo@exemplo.com',
      tipoUsuario: 'alunos',
    });
  });

  it('criarUsuario deve retornar o payload retornado pela API', async () => {
    const repo = new FakeUserRepository();
    const service = new UserService(repo);

    const apiResponse = { id: 'user-1', status: 'ok' };
    mockFetch.mockResolvedValueOnce(buildOkResponse(apiResponse));

    const result = await service.criarUsuario({
      nome: 'Teste',
      email: 'teste@example.com',
      tipoUsuario: 'professores',
      status: 'Ativo',
      turmaId: null,
      filhos: [],
      turmas: [],
      polivalente: false,
      modoAcesso: 'portal',
      dataCriacao: new Date().toISOString(),
    });

    expect(result).toEqual(apiResponse);
  });

  it('enviarEmailEsqueceuSenha deve chamar endpoint correto', async () => {
    const repo = new FakeUserRepository();
    const service = new UserService(repo);

    mockFetch.mockResolvedValueOnce(buildOkResponse({}));

    await service.enviarEmailEsqueceuSenha('email@example.com');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/esqueceu-senha');
    expect(JSON.parse((options as any).body)).toEqual({ email: 'email@example.com' });
  });
});

describe('UsuariosService (helpers de listagem e filtros)', () => {
  const contextoBase: ContextoUsuarios = {
    professores: [
      { id: 'p1', nome: 'Prof A', email: 'p1@escola.com', status: 'Ativo', turmas: ['t1', 't2'] },
    ],
    alunos: [
      { id: 'a1', nome: 'Aluno Um', email: 'a1@escola.com', status: 'Ativo', turmaId: 't1' },
      { id: 'a2', nome: 'Aluno Dois', email: 'a2@escola.com', status: 'Inativo', turmaId: 't2' },
    ],
    responsaveis: [
      { id: 'r1', nome: 'Resp 1', email: 'r1@escola.com', status: 'Ativo', filhos: ['a1'] } as any,
    ],
    administradores: [
      { id: 'adm1', nome: 'Admin', email: 'adm@escola.com', status: 'Ativo' } as any,
    ],
    turmas: [
      { id: 't1', nome: 'Turma 1' } as any,
      { id: 't2', nome: 'Turma 2' } as any,
    ],
  };

  it('montarListaBase deve respeitar activeTab', () => {
    const todos = UsuariosService.montarListaBase(contextoBase, 'todos');
    expect(todos.map(u => u.id)).toEqual(['p1', 'a1', 'a2', 'r1', 'adm1']);

    const apenasProfessores = UsuariosService.montarListaBase(contextoBase, 'professores');
    expect(apenasProfessores.map(u => u.id)).toEqual(['p1']);
  });

  it('aplicarFiltrosLista deve filtrar por busca em nome/email/info', () => {
    const listaBase: UsuarioBaseLista[] = UsuariosService.montarListaBase(contextoBase, 'todos');

    const porNomeAluno = UsuariosService.aplicarFiltrosLista(listaBase, contextoBase, {
      activeTab: 'todos',
      search: 'aluno um',
      statusFiltro: '',
      turmaFiltro: '',
    });
    expect(porNomeAluno.map(u => u.id)).toEqual(['a1', 'r1']);

    const porNomeFilho = UsuariosService.aplicarFiltrosLista(listaBase, contextoBase, {
      activeTab: 'responsaveis',
      search: 'aluno um',
      statusFiltro: '',
      turmaFiltro: '',
    });
    expect(porNomeFilho.map(u => u.id)).toEqual(['a1', 'r1']);
  });

  it('obterListaPaginada deve paginar corretamente', () => {
    const contexto: ContextoUsuarios = {
      ...contextoBase,
      professores: [],
      administradores: [],
      responsaveis: [],
    };

    const filtros = { activeTab: 'alunos' as AbaUsuarios, search: '', statusFiltro: '', turmaFiltro: '' };
    const pagina1 = UsuariosService.obterListaPaginada(contexto, filtros, 1, 1);
    const pagina2 = UsuariosService.obterListaPaginada(contexto, filtros, 2, 1);

    expect(pagina1).toHaveLength(1);
    expect(pagina2).toHaveLength(1);
    expect(pagina1[0].id).not.toBe(pagina2[0].id);
  });

  it('montarDadosTabelaExportacao deve montar cabeçalho e linhas corretas para aba todos', () => {
    const usuarios: UsuarioBaseLista[] = UsuariosService.montarListaBase(contextoBase, 'todos');
    const { headers, body } = UsuariosService.montarDadosTabelaExportacao(usuarios, contextoBase, 'todos');

    expect(headers[0]).toEqual(['Nome', 'E-mail', 'Status', 'Tipo', 'Info']);
    expect(body[0][0]).toBe('Prof A');
  });

  it('montarDadosExcel deve montar colunas diferentes por aba', () => {
    const usuariosTodos: UsuarioBaseLista[] = UsuariosService.montarListaBase(contextoBase, 'todos');
    const excelTodos = UsuariosService.montarDadosExcel(usuariosTodos, contextoBase, 'todos');
    expect(excelTodos[0]).toHaveProperty('Tipo');

    const usuariosAlunos: UsuarioBaseLista[] = UsuariosService.montarListaBase(contextoBase, 'alunos');
    const excelAlunos = UsuariosService.montarDadosExcel(usuariosAlunos, contextoBase, 'alunos');
    expect(excelAlunos[0]).toHaveProperty('Turma');
  });
});
