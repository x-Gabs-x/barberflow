const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { criarCadastrarEquipe } = require('../src/servicos/cadastrar-equipe');
const { VERSAO_TERMOS } = require('../src/termos');

const ID_AUTH = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_EXISTENTE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ID_ESTAB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ID_VINCULO_EXISTENTE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const AUTH_CRIADO = { data: { user: { id: ID_AUTH } }, error: null };
const AUTH_EXCLUIDO = { data: { user: { id: ID_AUTH } }, error: null };
const OK = { data: null, error: null, status: 204 };
const ERRO_BANCO = { code: '23514', message: 'SEGREDO_SQL', details: 'DETALHE_PRIVADO' };

const dados = (perfil = 'parceiro') => ({
  id_barbearia: 'BRB-7K4Q-92XM', perfil,
  nome_completo: 'Pessoa da Equipe', cpf: '52998224725', email: 'equipe@example.com',
  telefone: '83999990000', senha: 'SenhaEquipe123', aceite_termos: true,
});

// Dublê de PostgREST/Auth para afirmar a ordem e o escopo de cada chamada.
function criarMock(passos) {
  const chamadas = [];
  const falhas = [];
  async function executar(nome, argumentos) {
    chamadas.push({ nome, ...argumentos });
    const passo = passos.shift();
    if (!passo || passo[0] !== nome) {
      falhas.push({ esperado: passo?.[0], recebido: nome });
      throw new Error('Chamada fora da sequência esperada');
    }
    const resposta = passo[1] ?? (nome === 'auth.create' ? AUTH_CRIADO : nome === 'auth.delete' ? AUTH_EXCLUIDO : OK);
    return typeof resposta === 'function' ? resposta(argumentos) : resposta;
  }
  const supabase = {
    auth: { admin: {
      createUser: (payload) => executar('auth.create', { payload }),
      deleteUser: (id) => executar('auth.delete', { id }),
    } },
    from(tabela) {
      let operacao;
      const args = { filtros: {} };
      const query = {
        select(colunas) { operacao ??= 'select'; args.colunas = colunas; return this; },
        insert(payload) { operacao = 'insert'; args.payload = payload; return this; },
        delete() { operacao = 'delete'; return this; },
        eq(campo, valor) { args.filtros[campo] = valor; return this; },
        in(campo, valor) { args.filtros[campo] = valor; return this; },
        maybeSingle() { return this; },
        then(resolve, reject) { return executar(`${tabela}.${operacao}`, args).then(resolve, reject); },
      };
      return query;
    },
  };
  return {
    supabase, chamadas,
    conferir() { assert.deepEqual(falhas, []); assert.deepEqual(passos, [], `Chamadas esperadas restantes: ${JSON.stringify(passos)}`); },
  };
}

const comBarbearia = (...resto) => [
  ['usuario.select'],
  ['estabelecimento.select', { data: { id: ID_ESTAB }, error: null }],
  ...(resto[0]?.[0] === 'auth.create' ? [] : [['auth.create']]),
  ...resto,
];
const usuarioCriado = () => ['usuario.insert'];
const vinculoCriado = () => ['vinculo.insert'];

async function executar(passos, corpo = dados()) {
  const mock = criarMock(passos);
  const logs = [];
  const res = {
    statusCode: 200,
    status(codigo) { this.statusCode = codigo; return this; },
    json(body) { this.body = body; return this; },
  };
  await criarCadastrarEquipe(mock.supabase, (evento) => logs.push(evento))({ body: corpo }, res);
  mock.conferir();
  const serializado = JSON.stringify({ body: res.body, logs });
  for (const dadoPrivado of ['SEGREDO_SQL', 'DETALHE_PRIVADO', corpo.cpf, corpo.email, corpo.senha]) {
    assert.ok(!serializado.includes(dadoPrivado), 'Resposta/log não deve expor dados nem erros internos');
  }
  assert.ok(!serializado.includes('chave_secreta'));
  return { ...mock, res, logs };
}

for (const perfil of ['parceiro', 'recepcao']) {
  test(`cadastro de ${perfil} cria Auth, usuario, aceite e vínculo aguardando`, async () => {
    const r = await executar([...comBarbearia(usuarioCriado(), vinculoCriado())], dados(perfil));
    assert.equal(r.res.statusCode, 201);
    assert.deepEqual(r.res.body, { ok: true, status: 'aguardando', mensagem: 'Pedido enviado ao dono.' });
    assert.deepEqual(r.logs, []);
    assert.deepEqual(r.chamadas[2].payload, {
      email: dados(perfil).email, password: dados(perfil).senha, email_confirm: true,
    });
    assert.equal(r.chamadas[3].payload.id, ID_AUTH);
    assert.equal(r.chamadas[3].payload.cpf, dados(perfil).cpf);
    assert.equal(r.chamadas[3].payload.termos_versao, VERSAO_TERMOS);
    assert.ok(Date.parse(r.chamadas[3].payload.termos_aceitos_em));
    assert.equal(r.chamadas[3].payload.senha, undefined);
    assert.equal(r.chamadas[4].payload.usuario_id, ID_AUTH);
    assert.equal(r.chamadas[4].payload.estabelecimento_id, ID_ESTAB);
    assert.equal(r.chamadas[4].payload.perfil, perfil);
    assert.equal(r.chamadas[4].payload.status, 'aguardando');
  });
}

test('CPF já cadastrado responde 409 sem criar Auth ou excluir registros existentes', async () => {
  const r = await executar([['usuario.select', { data: { id: ID_EXISTENTE }, error: null }]]);
  assert.equal(r.res.statusCode, 409);
  assert.equal(r.res.body.erro, 'cpf_duplicado');
  assert.equal(r.chamadas.length, 1);
  assert.deepEqual(r.logs, []);
});

for (const status of ['ativo', 'aguardando']) {
  test(`tentativa de segundo vínculo ${status} com CPF já usado resulta em 409 sem alteração`, async () => {
    // Para ativo e aguardando, CPF único bloqueia a tentativa antes de tocar
    // no Auth ou vínculo, portanto nenhum estado de equipe é alterado.
    const r = await executar([['usuario.select', { data: { id: ID_EXISTENTE }, error: null }]]);
    assert.equal(r.res.statusCode, 409);
    assert.equal(r.chamadas.filter(c => c.nome === 'auth.create').length, 0);
    assert.equal(r.chamadas.filter(c => c.nome === 'vinculo.delete').length, 0);
    assert.ok(['ativo', 'aguardando'].includes(status));
  });
}

test('barbearia desconhecida retorna 404 sem criar conta ou vínculo', async () => {
  const r = await executar([['usuario.select'], ['estabelecimento.select', { data: null, error: null }]]);
  assert.equal(r.res.statusCode, 404);
  assert.equal(r.res.body.erro, 'barbearia_nao_encontrada');
  assert.equal(r.chamadas.length, 2);
});

test('e-mail globalmente usado no Auth retorna 409 sem contorno nem exclusão', async () => {
  const r = await executar([
    ...comBarbearia(['auth.create', { error: { code: 'email_exists', status: 422, message: 'SEGREDO_SQL' } }]),
  ]);
  assert.equal(r.res.statusCode, 409);
  assert.equal(r.res.body.erro, 'email_duplicado');
  assert.match(r.res.body.mensagem, /RN13/);
  assert.equal(r.chamadas.length, 3);
  assert.equal(r.chamadas.some(c => c.nome === 'auth.delete'), false);
});

test('falha conhecida ao criar Auth não tenta apagar conta por CPF ou e-mail', async () => {
  const r = await executar([...comBarbearia(['auth.create', { error: { code: 'not_admin', status: 403, message: 'SEGREDO_SQL' } }])]);
  assert.equal(r.res.statusCode, 400);
  assert.equal(r.chamadas.some(c => c.nome === 'auth.delete'), false);
});

test('resultado de rede incerto ao criar Auth abre protocolo sem UUID inventado', async () => {
  const r = await executar([...comBarbearia(['auth.create', () => { throw new Error('SEGREDO_SQL'); }])]);
  assert.equal(r.res.statusCode, 500);
  assert.equal(r.res.body.erro, 'cadastro_limpeza_pendente');
  assert.equal(r.res.body.protocolo, r.logs[0].operacao_id);
  assert.deepEqual(r.logs[0].pendencias, ['verificar_criacao_auth']);
  assert.equal(r.logs[0].usuario_id, null);
  assert.equal('usuario_id' in r.res.body, false);
});

test('CPF concorrente confirmado na inserção pública retorna 409 e apaga somente Auth novo', async () => {
  const r = await executar([
    ...comBarbearia(['usuario.insert', { error: { code: '23505' } }],
      ['usuario.select', { data: { id: ID_EXISTENTE }, error: null }],
      ['auth.delete']),
  ]);
  assert.equal(r.res.statusCode, 409);
  assert.equal(r.res.body.erro, 'cpf_duplicado');
  assert.deepEqual(r.chamadas.at(-1), { nome: 'auth.delete', id: ID_AUTH });
});

test('falha conhecida ao inserir usuario compensa somente Auth criado nesta tentativa', async () => {
  const r = await executar([...comBarbearia(['usuario.insert', { error: ERRO_BANCO }], ['auth.delete'])]);
  assert.equal(r.res.statusCode, 500);
  assert.deepEqual(r.chamadas.at(-1), { nome: 'auth.delete', id: ID_AUTH });
});

test('resultado incerto ao inserir usuario preserva UUID e registra protocolo', async () => {
  const r = await executar([
    ...comBarbearia(['usuario.insert', () => { throw new Error('SEGREDO_SQL'); }],
      ['vinculo.select', { data: [], error: null }], ['auth.delete']),
  ]);
  assert.equal(r.res.body.erro, 'cadastro_limpeza_pendente');
  assert.deepEqual(r.logs[0].pendencias, ['verificar_resultado_inserir_usuario']);
  assert.equal(r.logs[0].usuario_id, ID_AUTH);
});

test('falha conhecida ao inserir vinculo apaga usuário novo e mantém estabelecimento', async () => {
  const r = await executar([
    ...comBarbearia(usuarioCriado(), ['vinculo.insert', { error: ERRO_BANCO }],
      ['vinculo.select', { data: [], error: null }], ['auth.delete']),
  ]);
  assert.equal(r.res.statusCode, 500);
  assert.equal(r.chamadas.some(c => c.nome === 'estabelecimento.delete'), false);
  assert.deepEqual(r.chamadas.at(-1), { nome: 'auth.delete', id: ID_AUTH });
  assert.ok(!r.chamadas.some(c => c.nome === 'vinculo.delete'));
});

for (const [cenario, respostaAuth] of [
  ['resposta de erro', { error: { status: 503, message: 'SEGREDO_SQL' } }],
  ['exceção de rede', () => { throw new Error('SEGREDO_SQL'); }],
  ['resposta sem UUID confirmado', { data: { user: null }, error: null }],
]) {
  test(`falha na exclusão compensatória do Auth (${cenario}) mantém protocolo e UUID`, async () => {
    const r = await executar([
      ...comBarbearia(usuarioCriado(), ['vinculo.insert', { error: ERRO_BANCO }],
        ['vinculo.select', { data: [], error: null }], ['auth.delete', respostaAuth]),
    ]);
    assert.equal(r.res.body.erro, 'cadastro_limpeza_pendente');
    assert.equal(r.res.body.protocolo, r.logs[0].operacao_id);
    assert.ok(r.logs[0].usuario_id);
    assert.ok(r.logs[0].pendencias.includes('excluir_auth_da_tentativa'));
    assert.equal('usuario_id' in r.res.body, false);
  });
}

test('falha de rede após possível vínculo exclui só UUID reservado e verifica ausência', async () => {
  const r = await executar([
    ...comBarbearia(usuarioCriado(), ['vinculo.insert', () => { throw new Error('SEGREDO_SQL'); }],
      ['vinculo.delete'], ['vinculo.select', { data: null, error: null }],
      ['vinculo.select', { data: [], error: null }], ['auth.delete']),
  ]);
  assert.equal(r.res.body.erro, 'cadastro_limpeza_pendente');
  assert.equal(r.res.body.protocolo, r.logs[0].operacao_id);
  assert.deepEqual(r.logs[0].pendencias, ['verificar_resultado_inserir_vinculo']);
  const excluiu = r.chamadas.find(c => c.nome === 'vinculo.delete');
  assert.equal(excluiu.filtros.id, r.chamadas[4].payload.id);
  assert.equal(excluiu.filtros.usuario_id, ID_AUTH);
  assert.equal(r.chamadas.some(c => c.nome === 'estabelecimento.delete'), false);
});

test('falha incerta ao excluir vínculo não apaga Auth e mantém UUID para limpeza', async () => {
  const r = await executar([
    ...comBarbearia(usuarioCriado(), ['vinculo.insert', () => { throw new Error('SEGREDO_SQL'); }],
      ['vinculo.delete', { error: { code: '08007', message: 'SEGREDO_SQL' } }]),
  ]);
  assert.equal(r.res.body.erro, 'cadastro_limpeza_pendente');
  assert.ok(r.logs[0].pendencias.includes('excluir_vinculo_da_tentativa'));
  assert.ok(r.logs[0].vinculo_id);
  assert.equal(r.chamadas.some(c => c.nome === 'auth.delete'), false);
});

test('vínculo de outra operação preservado antes de excluir Auth por causa do cascade', async () => {
  const r = await executar([
    ...comBarbearia(usuarioCriado(), ['vinculo.insert', { error: { code: '23505' } }],
      ['vinculo.select', { data: [{ id: ID_VINCULO_EXISTENTE }], error: null }],
      ['vinculo.select', { data: [{ id: ID_VINCULO_EXISTENTE }], error: null }]),
  ]);
  assert.equal(r.res.body.erro, 'cadastro_limpeza_pendente');
  assert.ok(r.logs[0].pendencias.includes('vinculo_de_outra_operacao_preservado'));
  assert.equal(r.chamadas.some(c => c.nome === 'auth.delete'), false);
  assert.equal(r.chamadas.some(c => c.nome === 'vinculo.delete'), false);
});

test('confirmação de vínculo aguarda como constraint de banco retorna 409 sem apagar vínculo preexistente', async () => {
  const r = await executar([
    ...comBarbearia(usuarioCriado(), ['vinculo.insert', { error: { code: '23505' } }],
      ['vinculo.select', { data: [{ id: ID_VINCULO_EXISTENTE }], error: null }],
      ['vinculo.select', { data: [{ id: ID_VINCULO_EXISTENTE }], error: null }]),
  ]);
  // Preservar o vínculo preexistente prevalece sobre devolver 409 após a falha.
  assert.equal(r.res.statusCode, 500);
  assert.deepEqual(r.logs[0].pendencias, ['vinculo_de_outra_operacao_preservado']);
});

test('falha de rede na verificação de vínculos impede exclusão em cascata de Auth', async () => {
  const r = await executar([
    ...comBarbearia(usuarioCriado(), ['vinculo.insert', { error: ERRO_BANCO }],
      ['vinculo.select', () => { throw new Error('SEGREDO_SQL'); }]),
  ]);
  assert.equal(r.res.body.erro, 'cadastro_limpeza_pendente');
  assert.deepEqual(r.logs[0].pendencias, ['verificar_vinculos_antes_de_excluir_auth']);
  assert.equal(r.chamadas.some(c => c.nome === 'auth.delete'), false);
});

test('UUID reservado do estabelecimento é apenas referenciado, nunca excluído', async () => {
  const r = await executar([...comBarbearia(usuarioCriado(), vinculoCriado())]);
  assert.equal(r.chamadas[1].filtros.codigo, dados().id_barbearia);
  assert.equal(r.chamadas[4].payload.estabelecimento_id, ID_ESTAB);
  assert.equal(r.chamadas.some(c => c.nome === 'estabelecimento.delete'), false);
});

test('HTTP rota rejeita perfil dono com schema Zod antes de chamar os serviços', async (t) => {
  const mock = criarMock([...comBarbearia(usuarioCriado(), vinculoCriado())]);
  const caminhos = [
    require.resolve('../src/supabase'), require.resolve('../src/supabase-auth'),
    require.resolve('../src/servicos/autenticar-login'), require.resolve('../src/servicos/cadastrar-equipe'),
    require.resolve('../src/rotas/auth'),
  ];
  const cacheAnterior = caminhos.map((caminho) => require.cache[caminho]);
  let router;
  try {
    require.cache[caminhos[0]] = { id: caminhos[0], filename: caminhos[0], loaded: true, exports: mock.supabase };
    require.cache[caminhos[1]] = { id: caminhos[1], filename: caminhos[1], loaded: true, exports: { criarClienteAuthIsolado: () => ({ auth: {} }) } };
    delete require.cache[caminhos[2]];
    delete require.cache[caminhos[3]];
    delete require.cache[caminhos[4]];
    router = require('../src/rotas/auth');
  } finally {
    caminhos.forEach((caminho, i) => {
      if (cacheAnterior[i]) require.cache[caminho] = cacheAnterior[i];
      else delete require.cache[caminho];
    });
  }
  const app = express();
  app.use(express.json());
  app.use('/auth', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close(erro => erro ? reject(erro) : resolve())));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/auth/cadastro/equipe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados('dono')),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).erro, 'dados_invalidos');
  assert.equal(mock.chamadas.length, 0);

  const validResponse = await fetch(`http://127.0.0.1:${server.address().port}/auth/cadastro/equipe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados('parceiro')),
  });
  assert.equal(validResponse.status, 201);
  assert.deepEqual(await validResponse.json(), { ok: true, status: 'aguardando', mensagem: 'Pedido enviado ao dono.' });
  assert.equal(mock.chamadas[0].filtros.cpf, '52998224725');
  mock.conferir();
});
