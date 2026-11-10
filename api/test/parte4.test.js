const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const moduloSupabase = require.resolve('../src/supabase');
const chamadas = [];
let erroRpc = null;
let retornoRpc = { data: { ok: true }, error: null };
require.cache[moduloSupabase] = {
  id: moduloSupabase,
  filename: moduloSupabase,
  loaded: true,
  exports: {
    rpc: async (nome, parametros) => {
      chamadas.push({ nome, parametros });
      return { ...retornoRpc, error: erroRpc };
    },
  },
};

const fechamento = require('../src/servicos/fechamento');
const demoAtendimentos = require('../src/servicos/demo-parte3');
const demoValidacao = require('../src/servicos/demo-validacao');

test('resumo do fechamento é escopado por barbearia, data e usuário', async () => {
  chamadas.length = 0;
  retornoRpc = { data: { data: '2026-11-10', status: 'aberto', total: 0 }, error: null };
  erroRpc = null;
  const resultado = await fechamento.resumo(
    { id: 'dono-1', estabelecimento_id: 'barbearia-1', perfil: 'dono' },
    '2026-11-10'
  );
  assert.equal(resultado.status, 'aberto');
  assert.deepEqual(chamadas[0], {
    nome: 'bf_fechamento_resumo',
    parametros: { p_estabelecimento: 'barbearia-1', p_usuario: 'dono-1', p_data: '2026-11-10' },
  });
});

test('confirmar e devolver chamam as operações transacionais e convertem conflito', async () => {
  chamadas.length = 0;
  retornoRpc = { data: { ok: true, status: 'confirmado' }, error: null };
  erroRpc = null;
  await fechamento.confirmar(
    { id: 'dono-1', estabelecimento_id: 'barbearia-1', perfil: 'dono' },
    '2026-11-10'
  );
  assert.equal(chamadas[0].nome, 'bf_fechamento_confirmar');

  erroRpc = { message: 'BF_FECHAMENTO_STATUS_INVALIDO', code: 'P0001' };
  await assert.rejects(
    fechamento.devolver(
      { id: 'dono-1', estabelecimento_id: 'barbearia-1', perfil: 'dono' },
      '2026-11-10',
      'Revisar valores'
    ),
    (erro) => erro.status === 409 && erro.codigo === 'fechamento_status_invalido'
  );
  erroRpc = null;
});

test('modo de teste confirma os valores e devolve os atendimentos à recepção', async () => {
  const data = '2026-11-09';
  const parceiro = { usuario: { id: 'usuario-de-teste', perfil: 'parceiro' } };
  const recepcao = { usuario: { id: 'usuario-de-teste', perfil: 'recepcao' } };
  const dono = { id: 'usuario-de-teste', perfil: 'dono' };
  const atendimento = demoAtendimentos.iniciar(parceiro, `${data}T13:00:00-03:00`);
  const cliente = demoAtendimentos.cadastrarCliente({ cpf: '11144477735', nome_completo: 'Cliente teste' });
  demoAtendimentos.salvar(parceiro, atendimento.id, {
    cliente_id: cliente.id,
    servicos: ['s3'],
    forma_pagamento: 'pix',
  });
  demoAtendimentos.salvar(parceiro, atendimento.id, { fim: `${data}T13:30:00-03:00` }, true);
  demoAtendimentos.comprovante(parceiro, atendimento.id);
  demoValidacao.atualizar(recepcao, atendimento.id, 'validar');

  const antes = await fechamento.resumo(dono, data);
  assert.equal(antes.total, 40);
  assert.equal(antes.por_barbeiro[0].valor_barbeiro, 16);
  assert.equal(antes.por_forma_pagamento.pix, 40);

  await fechamento.confirmar(dono, data);
  assert.equal(demoAtendimentos.obter(parceiro, atendimento.id).status, 'validado_dono');
  await fechamento.devolver(dono, data, 'Conferir novamente');
  assert.equal(demoAtendimentos.obter(parceiro, atendimento.id).status, 'validado_recepcao');
});

test('SQL faz confirmação e devolução na mesma transação e filtra o estabelecimento', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../sql/20261110_parte4_fechamento.sql'), 'utf8');
  assert.match(sql, /from public\.fechamento[\s\S]*for update/i);
  assert.match(sql, /set status = 'validado_dono'[\s\S]*status = 'validado_recepcao'/i);
  assert.match(sql, /set status = 'validado_recepcao'[\s\S]*status = 'validado_dono'/i);
  assert.match(sql, /where estabelecimento_id = p_estabelecimento and data = p_data/i);
  assert.match(sql, /validado_dono_por = p_usuario, validado_dono_em = now\(\)/i);
  assert.match(sql, /corrigido_por = p_usuario,[\s\S]*corrigido_em = now\(\)/i);
});
