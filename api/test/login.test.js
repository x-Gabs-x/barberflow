const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { criarAutenticarLogin } = require('../src/servicos/autenticar-login');

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TOKEN = 'jwt-real-falso-do-mock';
const usuario = { id: ID, nome_completo: 'Dono de Teste', email: 'dono@example.com' };
const entrada = (overrides = {}) => ({ cpf: '52998224725', senha: 'SenhaTeste123', ...overrides });

function clienteAdmin(passos) {
  const chamadas = [];
  const inesperadas = [];
  const admin = {
    auth: {
      signInWithPassword: async () => { throw new Error('O cliente administrativo não pode autenticar senha.'); },
    },
    from(tabela) {
      let acao;
      const argumentos = { filtros: {} };
      const consulta = {
        select(colunas) { acao ??= 'select'; argumentos.colunas = colunas; return this; },
        eq(campo, valor) { argumentos.filtros[campo] = valor; return this; },
        in(campo, valor) { argumentos.filtros[campo] = valor; return this; },
        maybeSingle() { return this; },
        then(resolve, reject) {
          const operacao = `${tabela}.${acao}`;
          chamadas.push({ operacao, ...argumentos });
          const passo = passos.shift();
          if (!passo || passo[0] !== operacao) {
            inesperadas.push({ esperado: passo?.[0], recebido: operacao });
            throw new Error('Consulta inesperada');
          }
          return Promise.resolve(typeof passo[1] === 'function' ? passo[1](argumentos) : (passo[1] ?? { data: [], error: null })).then(resolve, reject);
        },
      };
      return consulta;
    },
  };
  return {
    admin, chamadas,
    conferir() { assert.deepEqual(inesperadas, []); assert.equal(passos.length, 0); },
  };
}

const usuarioEncontrado = () => ['usuario.select', { data: usuario, error: null }];
const vinculos = (...data) => ['vinculo.select', { data, error: null }];
const estabelecimentos = (...data) => ['estabelecimento.select', { data, error: null }];

async function executar(passos, corpo = entrada(), authResultado = {
  data: { user: { id: ID }, session: { access_token: TOKEN, refresh_token: 'nao-retornar' } }, error: null,
}) {
  const banco = clienteAdmin(passos);
  const chamadasAuth = [];
  const clienteIsolado = { auth: { signInWithPassword: async (credenciais) => {
    chamadasAuth.push(credenciais);
    return typeof authResultado === 'function' ? authResultado(credenciais) : authResultado;
  } } };
  let numeroClientesCriados = 0;
  const handler = criarAutenticarLogin(banco.admin, () => { numeroClientesCriados++; return clienteIsolado; });
  const res = {
    statusCode: 200,
    status(codigo) { this.statusCode = codigo; return this; },
    json(valor) { this.body = valor; return this; },
  };
  await handler({ body: corpo }, res);
  banco.conferir();
  return { ...banco, res, chamadasAuth, numeroClientesCriados, clienteIsolado };
}

test('login válido devolve JWT, usuário e vínculos ativos com perfil por barbearia', async () => {
  const links = [
    { estabelecimento_id: 'b1', perfil: 'dono', status: 'ativo' },
    { estabelecimento_id: 'b2', perfil: 'parceiro', status: 'ativo' },
    { estabelecimento_id: 'b3', perfil: 'recepcao', status: 'aguardando' },
    { estabelecimento_id: 'b4', perfil: 'dono', status: 'removido' },
  ];
  const r = await executar([
    usuarioEncontrado(), vinculos(...links),
    estabelecimentos({ id: 'b1', nome: 'Barbearia Um' }, { id: 'b2', nome: 'Barbearia Dois' }),
  ]);
  assert.equal(r.res.statusCode, 200);
  assert.deepEqual(r.res.body, {
    token: TOKEN,
    usuario: { id: ID, nome_completo: usuario.nome_completo, perfil: 'dono' },
    barbearias: [
      { id: 'b1', nome: 'Barbearia Um', perfil: 'dono' },
      { id: 'b2', nome: 'Barbearia Dois', perfil: 'parceiro' },
    ],
  });
  assert.equal(JSON.stringify(r.res.body).includes('nao-retornar'), false);
  assert.deepEqual(r.chamadasAuth, [{ email: usuario.email, password: 'SenhaTeste123' }]);
  assert.equal(r.numeroClientesCriados, 1);
  assert.notEqual(r.clienteIsolado, r.admin);
  assert.equal(r.chamadas[0].filtros.cpf, '52998224725');
  assert.equal(r.chamadas[1].filtros.usuario_id, ID);
  assert.equal(r.chamadas[2].filtros.id.includes('b3'), false);
});

test('CPF inexistente retorna o mesmo 401 genérico e não chama Auth', async () => {
  const r = await executar([['usuario.select', { data: null, error: null }]]);
  assert.equal(r.res.statusCode, 401);
  assert.deepEqual(r.res.body, { erro: 'credenciais_invalidas', mensagem: 'CPF ou senha inválidos.' });
  assert.equal(r.chamadasAuth.length, 0);
  assert.equal(r.numeroClientesCriados, 0);
});

test('CPF pontuado é buscado normalizado e usa email do banco', async () => {
  // O serviço recebe o corpo após o middleware Zod; a normalização HTTP é
  // verificada separadamente pela rota real no teste de integração local.
  const r = await executar([usuarioEncontrado(), vinculos({ estabelecimento_id: 'b1', perfil: 'dono', status: 'ativo' }), estabelecimentos({ id: 'b1', nome: 'Barbearia Um' })], entrada());
  assert.equal(r.res.statusCode, 200);
  assert.equal(r.chamadas[0].filtros.cpf, '52998224725');
  assert.deepEqual(r.chamadasAuth[0], { email: usuario.email, password: 'SenhaTeste123' });
});

test('senha incorreta recebe 401 genérico sem revelar email ou CPF', async () => {
  const r = await executar([usuarioEncontrado()], entrada(), { data: { user: null, session: null }, error: { status: 400, code: 'invalid_credentials', message: 'detalhe interno' } });
  assert.equal(r.res.statusCode, 401);
  assert.deepEqual(r.res.body, { erro: 'credenciais_invalidas', mensagem: 'CPF ou senha inválidos.' });
  assert.equal(JSON.stringify(r.res.body).includes(usuario.email), false);
});

test('conta autenticada sem vínculo ativo retorna 403 e não entrega token', async () => {
  const r = await executar([usuarioEncontrado(), vinculos(
    { estabelecimento_id: 'b1', perfil: 'parceiro', status: 'recusado' },
    { estabelecimento_id: 'b2', perfil: 'recepcao', status: 'removido' },
  )]);
  assert.equal(r.res.statusCode, 403);
  assert.equal(r.res.body.erro, 'sem_vinculo_ativo');
  assert.equal('token' in r.res.body, false);
});

test('vínculo aguardando retorna mensagem de aprovação e não entrega token', async () => {
  const r = await executar([usuarioEncontrado(), vinculos({ estabelecimento_id: 'b1', perfil: 'recepcao', status: 'aguardando' })]);
  assert.equal(r.res.statusCode, 403);
  assert.match(r.res.body.mensagem, /aguarda aprovação/);
  assert.equal('token' in r.res.body, false);
});

test('falha ao consultar usuario recebe 500 sanitizado e não chama Auth', async () => {
  const r = await executar([['usuario.select', { data: null, error: { code: '42501', message: 'segredo banco' } }]]);
  assert.equal(r.res.statusCode, 500);
  assert.deepEqual(r.res.body, { erro: 'falha_login', mensagem: 'Não foi possível concluir o login. Tente novamente.' });
  assert.equal(r.chamadasAuth.length, 0);
});

test('falha inesperada no Supabase Auth recebe resposta sanitizada', async () => {
  const r = await executar([usuarioEncontrado()], entrada(), { data: null, error: { status: 503, code: 'server_error', message: 'segredo auth' } });
  assert.equal(r.res.statusCode, 503);
  assert.equal(JSON.stringify(r.res.body).includes('segredo auth'), false);
});

test('UUID do Auth divergente do registro de usuario é negado sem token', async () => {
  const r = await executar([usuarioEncontrado()], entrada(), { data: { user: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, session: { access_token: TOKEN } }, error: null });
  assert.equal(r.res.statusCode, 401);
  assert.equal('token' in r.res.body, false);
  assert.equal(r.chamadas.length, 1);
});

test('vínculos ou estabelecimentos com falha não liberam JWT', async (t) => {
  await t.test('consulta vínculo', async () => {
    const r = await executar([usuarioEncontrado(), ['vinculo.select', { data: null, error: { message: 'segredo' } }]]);
    assert.equal(r.res.statusCode, 500);
    assert.equal('token' in r.res.body, false);
  });
  await t.test('consulta estabelecimento', async () => {
    const r = await executar([usuarioEncontrado(), vinculos({ estabelecimento_id: 'b1', perfil: 'dono', status: 'ativo' }), ['estabelecimento.select', { data: null, error: { message: 'segredo' } }]]);
    assert.equal(r.res.statusCode, 500);
    assert.equal('token' in r.res.body, false);
  });
});

test('retorna 429 do limite Auth de forma sanitizada', async () => {
  const r = await executar([usuarioEncontrado()], entrada(), { error: { status: 429, message: 'secret rate info' } });
  assert.equal(r.res.statusCode, 429);
  assert.equal(JSON.stringify(r.res.body).includes('secret rate info'), false);
});

test('JWT retornado pode ser verificado pelo middleware e selecionar a barbearia vinculada', async (t) => {
  let tokenVerificado;
  const vinculosAtivos = [
    { estabelecimento_id: 'b1', perfil: 'dono', escote_percentual: null },
    { estabelecimento_id: 'b2', perfil: 'parceiro', escote_percentual: 40 },
  ];
  const fakeAdmin = {
    auth: { getUser: async (token) => {
      tokenVerificado = token;
      return { data: { user: { id: ID } }, error: null };
    } },
    from(tabela) {
      let filtroUsuario;
      return {
        select() { return this; },
        eq(campo, valor) { if (campo === 'usuario_id') filtroUsuario = valor; return this; },
        then(resolve, reject) {
          assert.equal(tabela, 'vinculo');
          assert.equal(filtroUsuario, ID);
          return Promise.resolve({ data: vinculosAtivos, error: null }).then(resolve, reject);
        },
      };
    },
  };
  const fakeSupabasePath = require.resolve('../src/supabase');
  const middlewarePath = require.resolve('../src/middlewares/autenticar');
  const fakeAnterior = require.cache[fakeSupabasePath];
  const middlewareAnterior = require.cache[middlewarePath];
  let autenticarMockado;
  try {
    require.cache[fakeSupabasePath] = { id: fakeSupabasePath, filename: fakeSupabasePath, loaded: true, exports: fakeAdmin };
    delete require.cache[middlewarePath];
    autenticarMockado = require('../src/middlewares/autenticar').autenticar;
  } finally {
    if (fakeAnterior) require.cache[fakeSupabasePath] = fakeAnterior;
    else delete require.cache[fakeSupabasePath];
    if (middlewareAnterior) require.cache[middlewarePath] = middlewareAnterior;
    else delete require.cache[middlewarePath];
  }

  const req = { headers: { authorization: `Bearer ${TOKEN}`, 'x-barbearia': 'b2' } };
  const res = { status(codigo) { this.statusCode = codigo; return this; }, json(corpo) { this.body = corpo; return this; } };
  let proximo = false;
  await autenticarMockado(req, res, () => { proximo = true; });
  assert.equal(proximo, true);
  assert.equal(tokenVerificado, TOKEN);
  assert.deepEqual(req.usuario, { id: ID, perfil: 'parceiro', estabelecimento_id: 'b2', escote_percentual: 40 });

  const reqInvalida = { headers: { authorization: `Bearer ${TOKEN}`, 'x-barbearia': 'barbearia-sem-vinculo' } };
  const resInvalida = { status(codigo) { this.statusCode = codigo; return this; }, json(corpo) { this.body = corpo; return this; } };
  let liberada = false;
  await autenticarMockado(reqInvalida, resInvalida, () => { liberada = true; });
  assert.equal(liberada, false);
  assert.equal(resInvalida.statusCode, 403);
  assert.equal(resInvalida.body.erro, 'barbearia_invalida');
});

test('middleware não expõe erros internos do Auth ou PostgreSQL ao validar a sessão', async () => {
  for (const etapa of ['auth', 'vinculo']) {
    const fakeAdmin = {
      auth: { getUser: async () => {
        if (etapa === 'auth') throw new Error('DETALHE_AUTH_PRIVADO');
        return { data: { user: { id: ID } }, error: null };
      } },
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          then(resolve, reject) {
            return Promise.resolve({ data: null, error: { code: '42501', message: 'DETALHE_SQL_PRIVADO' } }).then(resolve, reject);
          },
        };
      },
    };
    const supabasePath = require.resolve('../src/supabase');
    const middlewarePath = require.resolve('../src/middlewares/autenticar');
    const supabaseAnterior = require.cache[supabasePath];
    const middlewareAnterior = require.cache[middlewarePath];
    let autenticar;
    try {
      require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: fakeAdmin };
      delete require.cache[middlewarePath];
      autenticar = require('../src/middlewares/autenticar').autenticar;
    } finally {
      if (supabaseAnterior) require.cache[supabasePath] = supabaseAnterior;
      else delete require.cache[supabasePath];
      if (middlewareAnterior) require.cache[middlewarePath] = middlewareAnterior;
      else delete require.cache[middlewarePath];
    }
    const res = {
      status(codigo) { this.statusCode = codigo; return this; },
      json(corpo) { this.body = corpo; return this; },
    };
    let autorizado = false;
    await autenticar({ headers: { authorization: `Bearer ${TOKEN}` } }, res, () => { autorizado = true; });
    assert.equal(autorizado, false);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { erro: 'servidor', mensagem: 'Não foi possível validar a sessão. Tente novamente.' });
  }
});

test('cliente Auth é construído separado e sem persistência, refresh ou sessão por URL', () => {
  const { criarClienteAuthIsolado } = require('../src/supabase-auth');
  const opcoes = [];
  const createClientFake = (url, chave, configuracao) => {
    opcoes.push({ url, chave, configuracao });
    return { auth: {} };
  };
  const primeiro = criarClienteAuthIsolado({ createClient: createClientFake, url: 'https://barberflow.invalid', chave: 'chave-falsa-de-teste' });
  const segundo = criarClienteAuthIsolado({ createClient: createClientFake, url: 'https://barberflow.invalid', chave: 'chave-falsa-de-teste' });
  assert.notEqual(primeiro, segundo);
  assert.equal(opcoes.length, 2);
  assert.deepEqual(opcoes[0].configuracao, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  assert.equal(opcoes[0].chave, 'chave-falsa-de-teste');
});

test('HTTP login real reutiliza Zod e schema rejeita corpo inválido', async (t) => {
  const mock = clienteAdmin([
    usuarioEncontrado(),
    vinculos({ estabelecimento_id: 'b1', perfil: 'dono', status: 'ativo' }),
    estabelecimentos({ id: 'b1', nome: 'Barbearia Um' }),
  ]);
  const mockDb = mock.admin;
  const { criarClienteAuthIsolado } = require('../src/supabase-auth');
  const clienteRealFalso = { auth: { signInWithPassword: async ({ email, password }) => ({
    data: { user: { id: ID }, session: { access_token: TOKEN } }, error: null,
  }) } };
  const cacheFake = new Map();
  const caminhos = [
    require.resolve('../src/supabase'), require.resolve('../src/supabase-auth'),
    require.resolve('../src/servicos/autenticar-login'), require.resolve('../src/rotas/auth'),
  ];
  for (const caminho of caminhos) cacheFake.set(caminho, require.cache[caminho]);
  let router;
  try {
    require.cache[caminhos[0]] = { id: caminhos[0], filename: caminhos[0], loaded: true, exports: mockDb };
    require.cache[caminhos[1]] = { id: caminhos[1], filename: caminhos[1], loaded: true, exports: {
      criarClienteAuthIsolado: () => clienteRealFalso,
    } };
    delete require.cache[caminhos[2]];
    delete require.cache[caminhos[3]];
    router = require('../src/rotas/auth');
  } finally {
    for (const caminho of caminhos) {
      if (cacheFake.get(caminho)) require.cache[caminho] = cacheFake.get(caminho);
      else delete require.cache[caminho];
    }
  }

  const app = express();
  app.use(express.json());
  app.use('/auth', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf: '11111111111', senha: 'SenhaTeste123' }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).erro, 'dados_invalidos');

  const validResponse = await fetch(`http://127.0.0.1:${server.address().port}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf: '529.982.247-25', senha: 'SenhaTeste123' }),
  });
  assert.equal(validResponse.status, 200);
  const validBody = await validResponse.json();
  assert.equal(validBody.token, TOKEN);
  assert.equal(mock.chamadas[0].filtros.cpf, '52998224725');
  mock.conferir();
});
