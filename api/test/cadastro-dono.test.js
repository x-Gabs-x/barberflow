const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { criarCadastroDono, gerarCodigo } = require('../src/servicos/cadastrar-dono');
const { VERSAO_TERMOS } = require('../src/termos');

const ID_AUTH = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_EXISTENTE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OK = { data: null, error: null, status: 204 };
const AUTH_EXCLUIDO = { data: { user: { id: ID_AUTH } }, error: null };
const FALHA_SQL = { code: '23514', message: 'SEGREDO_INTERNO', details: 'DADOS_PRIVADOS' };
const dados = () => ({
  nome_completo: 'Pessoa de Teste', cpf: '52998224725', email: 'teste@example.com',
  telefone: '83999990000', senha: 'SenhaTeste123', aceite_termos: true,
  barbearia: { nome: 'Barbearia de Teste', data_inicio: '2026-11-08' },
});

// Só simula as respostas do SDK; não representa um banco ou prova persistência.
function simular(passos) {
  const chamadas = [];
  const inesperadas = [];
  const executar = async (operacao, argumentos) => {
    const chamada = { operacao, ...argumentos };
    chamadas.push(chamada);
    const passo = passos.shift();
    if (!passo || passo[0] !== operacao) {
      inesperadas.push({ esperado: passo?.[0], recebido: operacao });
      throw new Error('Operação inesperada no teste');
    }
    const resposta = passo[1] ?? (operacao === 'auth.delete' ? AUTH_EXCLUIDO : OK);
    return typeof resposta === 'function' ? resposta(chamada) : resposta;
  };
  const supabase = {
    auth: { admin: {
      createUser: (payload) => executar('auth.create', { payload }),
      deleteUser: (id) => executar('auth.delete', { id }),
    } },
    from(tabela) {
      let acao;
      const argumentos = { filtros: {} };
      const consulta = {
        select(colunas) { acao ??= 'select'; argumentos.colunas = colunas; return this; },
        insert(payload) { acao = 'insert'; argumentos.payload = payload; return this; },
        delete() { acao = 'delete'; return this; },
        eq(campo, valor) { argumentos.filtros[campo] = valor; return this; },
        maybeSingle() { return this; },
        single() { return this; },
        then(resolve, reject) { return executar(`${tabela}.${acao}`, argumentos).then(resolve, reject); },
      };
      return consulta;
    },
  };
  return {
    supabase, chamadas,
    conferir() { assert.deepEqual(inesperadas, []); assert.equal(passos.length, 0, 'Todos os passos esperados devem executar'); },
  };
}

const inicio = () => [
  ['usuario.select'],
  ['auth.create', { data: { user: { id: ID_AUTH } }, error: null }],
];
const estabelecimentoCriado = () => ['estabelecimento.insert', ({ payload }) => ({ data: { id: payload.id }, error: null })];
const atePessoa = () => [...inicio(), ['usuario.insert']];
const ateEstabelecimento = () => [...atePessoa(), estabelecimentoCriado()];

async function executar(passos, corpo = dados()) {
  const mock = simular(passos);
  const logs = [];
  const resposta = { statusCode: 200, status(codigo) { this.statusCode = codigo; return this; }, json(valor) { this.body = valor; return this; } };
  const antes = Date.now();
  await criarCadastroDono(mock.supabase, (evento) => logs.push(evento))({ body: corpo }, resposta);
  mock.conferir();
  const serializado = JSON.stringify({ body: resposta.body, logs });
  for (const segredo of ['SEGREDO_INTERNO', 'DADOS_PRIVADOS', corpo.cpf, corpo.email, corpo.senha]) {
    assert.ok(!serializado.includes(segredo), 'Resposta e log não devem conter dados pessoais ou mensagens internas');
  }
  return { ...mock, resposta, logs, antes };
}

test('cadastro completo: dados mínimos, termos atuais, perfil fixo e contrato 201', async () => {
  const { chamadas, resposta, logs, antes } = await executar([...ateEstabelecimento(), ['vinculo.insert']]);
  assert.equal(resposta.statusCode, 201);
  assert.deepEqual(resposta.body, { ok: true, mensagem: 'Cadastro realizado.' });
  assert.deepEqual(logs, []);
  assert.deepEqual(chamadas[0].filtros, { cpf: dados().cpf });
  assert.deepEqual(chamadas[1].payload, { email: dados().email, password: dados().senha, email_confirm: true });
  const pessoa = chamadas[2].payload;
  assert.deepEqual(Object.keys(pessoa).sort(), ['id', 'nome_completo', 'cpf', 'email', 'telefone', 'termos_aceitos_em', 'termos_versao'].sort());
  assert.equal(pessoa.id, ID_AUTH);
  assert.equal(pessoa.termos_versao, VERSAO_TERMOS);
  assert.ok(Date.parse(pessoa.termos_aceitos_em) >= antes && Date.parse(pessoa.termos_aceitos_em) <= Date.now());
  const barbearia = chamadas[3].payload;
  assert.match(barbearia.codigo, /^BRB-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.ok(!('telefone' in barbearia) && !('cidade' in barbearia));
  assert.deepEqual(chamadas[4].payload, { usuario_id: ID_AUTH, estabelecimento_id: barbearia.id, perfil: 'dono', status: 'ativo' });
});

test('inclui telefone e cidade da barbearia quando informados', async () => {
  const corpo = dados();
  Object.assign(corpo.barbearia, { telefone: '8333334444', cidade: 'Campina Grande' });
  const { chamadas } = await executar([...ateEstabelecimento(), ['vinculo.insert']], corpo);
  assert.equal(chamadas[3].payload.telefone, corpo.barbearia.telefone);
  assert.equal(chamadas[3].payload.cidade, corpo.barbearia.cidade);
});

test('CPF existente: 409 sem criar nem excluir conta ou barbearia', async () => {
  const { resposta, chamadas } = await executar([['usuario.select', { data: { id: ID_EXISTENTE }, error: null }]]);
  assert.equal(resposta.statusCode, 409);
  assert.equal(resposta.body.erro, 'cpf_duplicado');
  assert.equal(chamadas.length, 1);
});

for (const code of ['email_exists', 'user_already_exists']) {
  test(`e-mail existente (${code}): 409, RN13 e nenhuma exclusão`, async () => {
    const { resposta } = await executar([['usuario.select'], ['auth.create', { error: { code, status: 422, message: 'SEGREDO_INTERNO' } }]]);
    assert.equal(resposta.statusCode, 409);
    assert.equal(resposta.body.erro, 'email_duplicado');
    assert.match(resposta.body.mensagem, /RN13/);
  });
}

test('falha ao consultar CPF impede criar Auth', async () => {
  const { resposta } = await executar([['usuario.select', { error: FALHA_SQL }]]);
  assert.equal(resposta.statusCode, 500);
});

test('rejeição na criação do Auth não dispara exclusão', async () => {
  const { resposta, logs } = await executar([['usuario.select'], ['auth.create', { error: { code: 'not_admin', status: 403, message: 'SEGREDO_INTERNO' } }]]);
  assert.equal(resposta.statusCode, 500);
  assert.deepEqual(logs[0].pendencias, []);
});

test('erro ao inserir usuario exclui somente a nova conta Auth', async () => {
  const { resposta, chamadas } = await executar([...inicio(), ['usuario.insert', { error: FALHA_SQL }], ['auth.delete']]);
  assert.equal(resposta.statusCode, 500);
  assert.equal(chamadas.at(-1).id, ID_AUTH);
});

test('CPF duplicado por concorrência: UNIQUE resulta em 409 e compensa a nova conta', async () => {
  const { resposta, chamadas } = await executar([
    ...inicio(), ['usuario.insert', { error: { code: '23505' } }],
    ['usuario.select', { data: { id: ID_EXISTENTE }, error: null }], ['auth.delete'],
  ]);
  assert.equal(resposta.statusCode, 409);
  assert.equal(chamadas.at(-1).id, ID_AUTH);
});

test('outra violação UNIQUE de usuario não é indevidamente anunciada como CPF duplicado', async () => {
  const { resposta } = await executar([...inicio(), ['usuario.insert', { error: { code: '23505' } }], ['usuario.select'], ['auth.delete']]);
  assert.equal(resposta.statusCode, 500);
  assert.equal(resposta.body.erro, 'cadastro_falhou');
});

test('rejeição SQL de estabelecimento compensa Auth sem excluir barbearia', async () => {
  const { resposta } = await executar([...atePessoa(), ['estabelecimento.insert', { error: FALHA_SQL }], ['auth.delete']]);
  assert.equal(resposta.statusCode, 500);
});

test('falha em vinculo exclui estabelecimento criado antes de Auth', async () => {
  const { resposta, chamadas } = await executar([...ateEstabelecimento(), ['vinculo.insert', { error: FALHA_SQL }], ['estabelecimento.delete'], ['auth.delete']]);
  assert.equal(resposta.statusCode, 500);
  assert.deepEqual(chamadas.at(-2).filtros, { id: chamadas[3].payload.id });
  assert.equal(chamadas.at(-1).id, ID_AUTH);
});

test('colisão de código confirmada: nova tentativa sem alterar a barbearia existente', async () => {
  const { resposta, chamadas } = await executar([
    ...atePessoa(), ['estabelecimento.insert', { error: { code: '23505' } }],
    ['estabelecimento.select', { data: { id: ID_EXISTENTE }, error: null }], estabelecimentoCriado(), ['vinculo.insert'],
  ]);
  assert.equal(resposta.statusCode, 201);
  assert.deepEqual(chamadas[4].filtros, { codigo: chamadas[3].payload.codigo });
  assert.notEqual(chamadas[3].payload.id, chamadas[5].payload.id);
  assert.equal(chamadas[6].payload.estabelecimento_id, chamadas[5].payload.id);
});

test('cinco colisões esgotam as tentativas e compensam Auth', async () => {
  const colisoes = Array.from({ length: 5 }, () => [
    ['estabelecimento.insert', { error: { code: '23505' } }],
    ['estabelecimento.select', { data: { id: ID_EXISTENTE }, error: null }],
  ]).flat();
  const { resposta, chamadas } = await executar([...atePessoa(), ...colisoes, ['auth.delete']]);
  assert.equal(resposta.statusCode, 500);
  assert.equal(chamadas.filter(c => c.operacao === 'estabelecimento.insert').length, 5);
  assert.equal(chamadas.at(-1).id, ID_AUTH);
});

test('colisão de outra chave de estabelecimento não causa repetição nem exclusão de registro existente', async () => {
  const { resposta } = await executar([...atePessoa(), ['estabelecimento.insert', { error: { code: '23505' } }], ['estabelecimento.select'], ['auth.delete']]);
  assert.equal(resposta.statusCode, 500);
});

test('falha nas duas exclusões mantém protocolo e log sanitizado para limpeza manual', async () => {
  const { resposta, logs, chamadas } = await executar([
    ...ateEstabelecimento(), ['vinculo.insert', { error: FALHA_SQL }],
    ['estabelecimento.delete', { error: FALHA_SQL }], ['auth.delete', { error: { message: 'SEGREDO_INTERNO' } }],
  ]);
  assert.equal(resposta.statusCode, 500);
  assert.equal(resposta.body.erro, 'cadastro_limpeza_pendente');
  assert.equal(resposta.body.protocolo, logs[0].operacao_id);
  assert.deepEqual(logs[0].pendencias, ['excluir_estabelecimento', 'excluir_auth']);
  assert.equal(logs[0].estabelecimento_id, chamadas[3].payload.id);
  assert.equal(logs[0].usuario_id, ID_AUTH);
});

test('exceção na exclusão de estabelecimento não impede tentativa de remover Auth', async () => {
  const { logs } = await executar([
    ...ateEstabelecimento(), ['vinculo.insert', { error: FALHA_SQL }],
    ['estabelecimento.delete', () => { throw new Error('SEGREDO_INTERNO'); }], ['auth.delete'],
  ]);
  assert.deepEqual(logs[0].pendencias, ['excluir_estabelecimento']);
});

test('Auth já ausente durante compensação conta como limpeza concluída', async () => {
  const { resposta } = await executar([...inicio(), ['usuario.insert', { error: FALHA_SQL }], ['auth.delete', { error: { code: 'user_not_found' } }]]);
  assert.equal(resposta.body.erro, 'cadastro_falhou');
});

for (const retorno of [
  () => { throw new Error('SEGREDO_INTERNO'); },
  { error: { status: 503, message: 'SEGREDO_INTERNO' } },
  { data: { user: null }, error: null },
]) {
  test('criação Auth com resultado incerto: limpeza manual, sem excluir conta por CPF ou e-mail', async () => {
    const { resposta, logs } = await executar([['usuario.select'], ['auth.create', retorno]]);
    assert.equal(resposta.body.erro, 'cadastro_limpeza_pendente');
    assert.deepEqual(logs[0].pendencias, ['verificar_criacao_auth']);
    assert.equal(logs[0].usuario_id, null);
  });
}

test('resposta perdida de estabelecimento: limpa pelo UUID reservado e pede verificação', async () => {
  const { resposta, chamadas } = await executar([
    ...atePessoa(), ['estabelecimento.insert', () => { throw new Error('SEGREDO_INTERNO'); }],
    ['estabelecimento.delete'], ['auth.delete'],
  ]);
  assert.equal(resposta.body.erro, 'cadastro_limpeza_pendente');
  assert.deepEqual(chamadas.at(-2).filtros, { id: chamadas[3].payload.id });
});

function conferirPendencia({ resposta, logs }, esperadas, estabelecimentoId = null) {
  assert.equal(resposta.statusCode, 500);
  assert.equal(resposta.body.erro, 'cadastro_limpeza_pendente');
  assert.deepEqual(Object.keys(resposta.body).sort(), ['erro', 'mensagem', 'protocolo']);
  assert.match(resposta.body.protocolo, /^[0-9a-f-]{36}$/);
  assert.equal(logs.length, 1);
  assert.equal(resposta.body.protocolo, logs[0].operacao_id);
  assert.equal(logs[0].usuario_id, ID_AUTH);
  assert.equal(logs[0].estabelecimento_id, estabelecimentoId);
  assert.deepEqual(logs[0].pendencias, esperadas);
  for (const id of [ID_AUTH, ID_EXISTENTE, estabelecimentoId].filter(Boolean)) {
    assert.ok(!JSON.stringify(resposta.body).includes(id), 'UUID interno não deve aparecer na resposta pública');
  }
}

for (const [nome, resultadoIncerto] of [
  ['08007', () => ({ error: { code: '08007', message: 'SEGREDO_INTERNO' } })],
  ['40003', () => ({ error: { code: '40003', message: 'SEGREDO_INTERNO' } })],
  ['exceção de rede', () => { throw new Error('SEGREDO_INTERNO'); }],
  ['erro de comunicação do SDK', () => ({ error: { code: '', message: 'SEGREDO_INTERNO' }, status: 0 })],
  ['código desconhecido com cinco caracteres', () => ({ error: { code: 'ZZ999', message: 'SEGREDO_INTERNO' } })],
]) {
  test(`resultado incerto após gravação (${nome}): preserva UUID, compensa e protege preexistentes`, async () => {
    // Estado local para detectar resíduos e exclusões indevidas, sem banco real.
    const estabelecimentos = new Set([ID_EXISTENTE]);
    const contas = new Set([ID_EXISTENTE, ID_AUTH]);
    let reservado;
    const resultado = await executar([
      ...atePessoa(), ['estabelecimento.insert', ({ payload }) => {
        reservado = payload.id;
        estabelecimentos.add(reservado);
        return resultadoIncerto();
      }],
      ['estabelecimento.delete', ({ filtros }) => {
        assert.deepEqual(filtros, { id: reservado });
        estabelecimentos.delete(filtros.id);
        return OK;
      }],
      ['auth.delete', ({ id }) => { contas.delete(id); return AUTH_EXCLUIDO; }],
    ]);
    assert.deepEqual([...estabelecimentos], [ID_EXISTENTE]);
    assert.deepEqual([...contas], [ID_EXISTENTE]);
    assert.deepEqual(resultado.chamadas.slice(-2).map(c => c.operacao), ['estabelecimento.delete', 'auth.delete']);
    conferirPendencia(resultado, ['verificar_resultado_da_gravacao'], reservado);
  });
}

for (const codigo of ['08007', '40003']) {
  for (const exclusaoEfetivada of [false, true]) {
    test(`exclusão de estabelecimento incerta (${codigo}, efetivada=${exclusaoEfetivada}): mantém pendência`, async () => {
      const estabelecimentos = new Set([ID_EXISTENTE]);
      let reservado;
      const resultado = await executar([
        ...atePessoa(), ['estabelecimento.insert', ({ payload }) => {
          reservado = payload.id;
          estabelecimentos.add(reservado);
          return { data: { id: reservado }, error: null };
        }],
        ['vinculo.insert', { error: FALHA_SQL }],
        ['estabelecimento.delete', ({ filtros }) => {
          if (exclusaoEfetivada) estabelecimentos.delete(filtros.id);
          return { error: { code: codigo, message: 'SEGREDO_INTERNO' } };
        }], ['auth.delete'],
      ]);
      assert.ok(estabelecimentos.has(ID_EXISTENTE));
      assert.equal(estabelecimentos.has(reservado), !exclusaoEfetivada);
      conferirPendencia(resultado, ['excluir_estabelecimento'], reservado);
      assert.equal(resultado.chamadas.filter(c => c.operacao === 'estabelecimento.delete').length, 1);
    });
  }
}

for (const [nome, retorno] of [
  ['rejeição do Auth', { error: { code: 'not_admin', status: 403, message: 'SEGREDO_INTERNO' } }],
  ['resposta incerta do Auth', { error: { status: 503, message: 'SEGREDO_INTERNO' } }],
  ['exceção de rede', () => { throw new Error('SEGREDO_INTERNO'); }],
  ['resposta sem confirmação', { data: { user: null }, error: null }],
  ['resposta com outro UUID', { data: { user: { id: ID_EXISTENTE } }, error: null }],
]) {
  test(`falha na exclusão da conta (${nome}): mantém protocolo e UUID para limpeza`, async () => {
    const resultado = await executar([
      ...ateEstabelecimento(), ['vinculo.insert', { error: FALHA_SQL }],
      ['estabelecimento.delete'], ['auth.delete', retorno],
    ]);
    conferirPendencia(resultado, ['excluir_auth'], resultado.chamadas[3].payload.id);
    const exclusoes = resultado.chamadas.filter(c => c.operacao === 'auth.delete');
    assert.equal(exclusoes.length, 1);
    assert.equal(exclusoes[0].id, ID_AUTH);
  });
}

for (const retorno of [{}, { error: null, status: 0 }, { error: null, status: 503 }]) {
  test(`exclusão do estabelecimento sem confirmação HTTP (${retorno.status ?? 'ausente'}): não declara limpeza concluída`, async () => {
    const resultado = await executar([
      ...ateEstabelecimento(), ['vinculo.insert', { error: FALHA_SQL }],
      ['estabelecimento.delete', retorno], ['auth.delete'],
    ]);
    conferirPendencia(resultado, ['excluir_estabelecimento'], resultado.chamadas[3].payload.id);
  });
}

test('gravação e exclusões incertas preservam todos os identificadores e pendências', async () => {
  const resultado = await executar([
    ...atePessoa(), ['estabelecimento.insert', { error: { code: '08007' } }],
    ['estabelecimento.delete', { error: { code: '40003' } }],
    ['auth.delete', () => { throw new Error('SEGREDO_INTERNO'); }],
  ]);
  conferirPendencia(resultado, ['verificar_resultado_da_gravacao', 'excluir_estabelecimento', 'excluir_auth'], resultado.chamadas[3].payload.id);
});

for (const codigo of ['23502', '23503', '23514', '23P01']) {
  test(`restrição ${codigo} rejeita inserção: não tenta excluir estabelecimento`, async () => {
    const resultado = await executar([...atePessoa(), ['estabelecimento.insert', { error: { code: codigo } }], ['auth.delete']]);
    assert.equal(resultado.resposta.body.erro, 'cadastro_falhou');
    assert.deepEqual(resultado.logs[0].pendencias, []);
    assert.equal(resultado.logs[0].estabelecimento_id, null);
  });
}

test('gerador produz códigos no formato contratado', () => {
  for (let i = 0; i < 100; i++) assert.match(gerarCodigo(), /^BRB-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
});

test('HTTP: rota real reaproveita Zod e normaliza dados antes do serviço', async () => {
  const mock = simular([...ateEstabelecimento(), ['vinculo.insert']]);
  const caminhoCliente = require.resolve('../src/supabase');
  const caminhoRotas = require.resolve('../src/rotas/auth');
  const clienteAnterior = require.cache[caminhoCliente];
  const rotasAnteriores = require.cache[caminhoRotas];
  let router;
  try {
    require.cache[caminhoCliente] = { id: caminhoCliente, filename: caminhoCliente, loaded: true, exports: mock.supabase };
    delete require.cache[caminhoRotas];
    router = require('../src/rotas/auth');
  } finally {
    if (clienteAnterior) require.cache[caminhoCliente] = clienteAnterior;
    else delete require.cache[caminhoCliente];
    if (rotasAnteriores) require.cache[caminhoRotas] = rotasAnteriores;
    else delete require.cache[caminhoRotas];
  }
  const app = express();
  app.use(express.json());
  app.use('/auth', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const post = (corpo) => fetch(`http://127.0.0.1:${server.address().port}/auth/cadastro/dono`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  });
  try {
    for (const [alteracao, campo] of [
      [{ aceite_termos: false }, 'aceite_termos'], [{ aceite_termos: undefined }, 'aceite_termos'],
      [{ cpf: '11111111111' }, 'cpf'], [{ senha: '12345678' }, 'senha'],
      [{ perfil: 'recepcao' }, ''],
      [{ barbearia: { ...dados().barbearia, telefone: '' } }, 'barbearia.telefone'],
      [{ barbearia: { ...dados().barbearia, data_inicio: '2026-02-30' } }, 'barbearia.data_inicio'],
    ]) {
      const resposta = await post({ ...dados(), ...alteracao });
      assert.equal(resposta.status, 400);
      const body = await resposta.json();
      assert.equal(body.erro, 'dados_invalidos');
      assert.ok(body.campos.some(c => c.campo === campo));
    }
    assert.equal(mock.chamadas.length, 0);
    const resposta = await post({ ...dados(), cpf: '529.982.247-25', telefone: '(83) 99999-0000', email: ' TESTE@EXAMPLE.COM ' });
    assert.equal(resposta.status, 201);
    assert.deepEqual(await resposta.json(), { ok: true, mensagem: 'Cadastro realizado.' });
    assert.equal(mock.chamadas[2].payload.cpf, '52998224725');
    assert.equal(mock.chamadas[2].payload.telefone, '83999990000');
    assert.equal(mock.chamadas[2].payload.email, 'teste@example.com');
    mock.conferir();
  } finally {
    await new Promise((resolve, reject) => server.close(erro => erro ? reject(erro) : resolve()));
  }
});
