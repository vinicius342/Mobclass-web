import { UserService, UsuariosService, AbaUsuarios, ContextoUsuarios, UsuarioBaseLista } from '../src/services/usuario/UserService';

// Mock global fetch
beforeEach(() => {
  global.fetch = jest.fn();
});

describe('UserService (operações com backend)', () => {
  it('atualizarStatus deve chamar updateStatus e updateDisabled', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })  // updateStatus
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // updateDisabled

    const service = new UserService();
    await service.atualizarStatus('uid-1', 'Ativo');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(1, expect.any(String), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ domain: 'user', action: 'updateStatus', uid: 'uid-1', status: 'Ativo' }),
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ domain: 'user', action: 'updateDisabled', uid: 'uid-1', disabled: false }),
    }));
  });

  it('atualizarStatus com Inativo deve chamar updateDisabled com true', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const service = new UserService();
    await service.atualizarStatus('uid-2', 'Inativo');

    expect(global.fetch).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({
      body: JSON.stringify({ domain: 'user', action: 'updateDisabled', uid: 'uid-2', disabled: true }),
    }));
  });

  it('atualizarStatusEmLote deve chamar atualizarStatus para cada usuário', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    const service = new UserService();
    await service.atualizarStatusEmLote([
      { uid: 'u1', status: 'Ativo' },
      { uid: 'u2', status: 'Inativo' },
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(4); // 2 usuários * 2 chamadas cada
  });

  it('buscarPorEmailCaseInsensitive deve retornar usuário encontrado', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'id-1', email: 'teste@example.com' }),
    });

    const service = new UserService();
    const found = await service.buscarPorEmailCaseInsensitive('TESTE@example.com');

    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ domain: 'user', action: 'findByEmailCaseInsensitive', email: 'TESTE@example.com' }),
    }));
    expect(found).toEqual({ id: 'id-1', email: 'teste@example.com' });
  });

  it('atualizarStatusSeExistir não deve atualizar quando usuário não existe', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ exists: false }),
    });

    const service = new UserService();
    await service.atualizarStatusSeExistir('nao-existe', 'Ativo');

    expect(global.fetch).toHaveBeenCalledTimes(1); // Apenas exists
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      body: JSON.stringify({ domain: 'user', action: 'exists', uid: 'nao-existe' }),
    }));
  });

  it('atualizarStatusSeExistir deve atualizar quando usuário existe', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ exists: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const service = new UserService();
    await service.atualizarStatusSeExistir('existe', 'Inativo');

    expect(global.fetch).toHaveBeenCalledTimes(3); // exists + updateStatus + updateDisabled
  });

  it('marcarPrimeiroAcessoConcluido deve chamar updateFirstAcesso', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const service = new UserService();
    await service.marcarPrimeiroAcessoConcluido('uid-123');

    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ domain: 'user', action: 'updateFirstAcesso', uid: 'uid-123', firstAcesso: false }),
    }));
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
    const service = new UserService();

    (global.fetch as jest.Mock).mockResolvedValueOnce(buildOkResponse({ success: true }));

    await expect(service.excluirUsuario('uid-1', 'professores')).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain('/excluir-usuario');
    expect((options as any).method).toBe('POST');
    expect(JSON.parse((options as any).body)).toEqual({ uid: 'uid-1', tipoUsuario: 'professores' });
  });

  it('criarApenasAuth deve propagar mensagem de erro vinda da API', async () => {
    const service = new UserService();

    (global.fetch as jest.Mock).mockResolvedValueOnce(buildErrorResponse('email já utilizado'));

    await expect(
      service.criarApenasAuth({ uid: 'u1', nome: 'Nome', email: 'a@b.com', tipoUsuario: 'professores' })
    ).rejects.toThrow('email já utilizado');
  });

  it('removerAuth deve lançar erro padrão quando API não retorna mensagem', async () => {
    const service = new UserService();

    (global.fetch as jest.Mock).mockResolvedValueOnce(buildErrorResponse());

    await expect(service.removerAuth('uid-xyz')).rejects.toThrow('Erro ao remover conta de autenticação');
  });

  it('atualizarEmailUsuario deve enviar payload completo ao endpoint', async () => {
    const service = new UserService();

    (global.fetch as jest.Mock).mockResolvedValueOnce(buildOkResponse({}));

    await service.atualizarEmailUsuario({ uid: 'u1', novoEmail: 'novo@exemplo.com', tipoUsuario: 'alunos' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain('/atualizar-email-usuario');
    expect(JSON.parse((options as any).body)).toEqual({
      uid: 'u1',
      novoEmail: 'novo@exemplo.com',
      tipoUsuario: 'alunos',
    });
  });

  it('criarUsuario deve retornar o payload retornado pela API', async () => {
    const service = new UserService();

    const apiResponse = { id: 'user-1', status: 'ok' };
    (global.fetch as jest.Mock).mockResolvedValueOnce(buildOkResponse(apiResponse));

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
    const service = new UserService();

    (global.fetch as jest.Mock).mockResolvedValueOnce(buildOkResponse({}));

    await service.enviarEmailEsqueceuSenha('email@example.com');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
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
