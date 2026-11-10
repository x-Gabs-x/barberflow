const { test } = require('node:test');
const assert = require('node:assert/strict');

// Dublê do Supabase: guarda cada consulta (tabela, operação, filtros e dados)
// e devolve as respostas da fila na ordem em que foram pedidas.
const consultas = [];
const respostas = [];
const moduloSupabase = require.resolve('../src/supabase');
require.cache[moduloSupabase] = {
  id: moduloSupabase, filename: moduloSupabase, loaded: true,
  exports: {
    from(tabela) {
      const consulta = { tabela, operacao: 'select', filtros: {}, dados: null };
      consultas.push(consulta);
      const query = {
        select() { return this; },
        insert(dados) { consulta.operacao = 'insert'; consulta.dados = dados; return this; },
        update(dados) { consulta.operacao = 'update'; consulta.dados = dados; return this; },
        eq(campo, valor) { consulta.filtros[campo] = valor; return this; },
        order() { return this; },
        single() { return this; },
        maybeSingle() { return this; },
        then(resolve) { resolve(respostas.shift() ?? { data: null, error: null }); },
      };
      return query;
    },
  },
};

const parte5 = require('../src/servicos/parte5');
const dados = require('../src/dados-teste');

const demo = { id: 'usuario-de-teste', perfil: 'dono', estabelecimento_id: 'barbearia-de-teste' };
const dono = { id: 'u-dono', perfil: 'dono', estabelecimento_id: 'b-minha' };

function preparar(...lista) {
  consultas.length = 0;
  respostas.length = 0;
  respostas.push(...lista);
}

const vinculo = (perfil, status, escote = null) => ({
  data: { id: 'v9', perfil, status, escote_percentual: escote, usuario: { id: 'u9', nome_completo: 'Pessoa Nova' } },
  error: null,
});
const ok = { data: { id: 'v9' }, error: null };

// ---------- Perfil de teste: dados ficam na memória da API ----------

test('demo: serviço criado continua na lista depois', async () => {
  const criado = await parte5.criarServico(demo, { nome: 'Sobrancelha', preco: 15 });
  const lista = await parte5.listarServicos(demo);
  assert.ok(lista.some((s) => s.id === criado.id && s.nome === 'Sobrancelha' && s.ativo));
});

test('demo: preço e desativação do serviço ficam salvos', async () => {
  await parte5.editarServico(demo, 's1', { preco: 45, ativo: false });
  const corte = (await parte5.listarServicos(demo)).find((s) => s.id === 's1');
  assert.equal(corte.preco, 45);
  assert.equal(corte.ativo, false);
  await assert.rejects(parte5.editarServico(demo, 'nao-existe', { preco: 1 }), (e) => e.status === 404);
});

test('demo: parceiro recebe escote fixo de 40% ao ser aprovado', async () => {
  await parte5.aprovarPedido(demo, 'v3');
  assert.equal((await parte5.listarEquipe(demo, 'aguardando')).length, 0);
  const diego = (await parte5.listarEquipe(demo, 'ativo')).find((m) => m.id === 'v3');
  assert.equal(diego.escote_percentual, 40);
});

test('demo: escote do dono pode mudar, mas o dono não pode ser removido', async () => {
  const r = await parte5.alterarEscote(demo, 'v1', 80);
  assert.deepEqual(r, { ok: true, percentual_anterior: 70, percentual_novo: 80 });
  await assert.rejects(parte5.removerMembro(demo, 'v1'), (e) => e.codigo === 'dono_nao_removivel');
});

test('demo: remover tira a pessoa da equipe ativa', async () => {
  await parte5.removerMembro(demo, 'v2');
  assert.ok(!(await parte5.listarEquipe(demo, 'ativo')).some((m) => m.id === 'v2'));
  await assert.rejects(parte5.removerMembro(demo, 'v2'), (e) => e.status === 404);
});

test('demo: configurações e novo código ficam salvos', async () => {
  await parte5.editarBarbearia(demo, { cidade: 'Campina Grande', hora_abertura: '09:00' });
  const { codigo } = await parte5.gerarNovoCodigo(demo);
  const b = await parte5.obterBarbearia(demo);
  assert.equal(b.cidade, 'Campina Grande');
  assert.equal(b.hora_abertura, '09:00');
  assert.equal(b.codigo, codigo);
  assert.match(codigo, /^BRB-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
});

test('demo: abertura depois do fechamento atual é recusada mesmo enviando só um horário', async () => {
  await assert.rejects(parte5.editarBarbearia(demo, { hora_abertura: '20:00' }), (e) => e.codigo === 'horario_invalido');
  assert.equal(dados.barbearia.hora_abertura, '09:00');
});

// ---------- Login de verdade: grava no Supabase ----------

test('banco: lista de serviços é filtrada pela barbearia do usuário', async () => {
  preparar({ data: [{ id: 'x', nome: 'Corte', preco: '40.00', ativo: true }], error: null });
  const lista = await parte5.listarServicos(dono);
  assert.deepEqual(lista, [{ id: 'x', nome: 'Corte', preco: 40, ativo: true }]);
  assert.equal(consultas[0].tabela, 'servico');
  assert.equal(consultas[0].filtros.estabelecimento_id, 'b-minha');
});

test('banco: criar serviço grava na barbearia do usuário', async () => {
  preparar({ data: { id: 'novo', nome: 'Sobrancelha', preco: 15, ativo: true }, error: null });
  const criado = await parte5.criarServico(dono, { nome: 'Sobrancelha', preco: 15 });
  assert.equal(criado.id, 'novo');
  assert.deepEqual(consultas[0].dados, { estabelecimento_id: 'b-minha', nome: 'Sobrancelha', preco: 15, ativo: true });
});

test('banco: editar serviço de outra barbearia responde 404', async () => {
  preparar({ data: null, error: null });
  await assert.rejects(parte5.editarServico(dono, 'de-outro', { preco: 10 }), (e) => e.status === 404);
  assert.equal(consultas[0].filtros.estabelecimento_id, 'b-minha');
});

test('banco: aprovar parceiro ativa o vínculo e registra o histórico do escote', async () => {
  preparar(vinculo('parceiro', 'aguardando', 40), ok);
  const r = await parte5.aprovarPedido(dono, 'v9');
  assert.deepEqual(r, { ok: true, escote_percentual: 40 });
  const [busca, atualizacao, historico] = consultas;
  assert.deepEqual(busca.filtros, { id: 'v9', estabelecimento_id: 'b-minha', status: 'aguardando' });
  assert.deepEqual(atualizacao.dados, { status: 'ativo', escote_percentual: 40 });
  assert.equal(consultas.length, 2);
});

test('banco: recepção é aprovada sem escote e sem histórico', async () => {
  preparar(vinculo('recepcao', 'aguardando'), ok);
  const r = await parte5.aprovarPedido(dono, 'v9', 50);
  assert.equal(r.escote_percentual, null);
  assert.equal(consultas.length, 2);
  assert.equal(consultas[1].dados.escote_percentual, null);
});

test('banco: recusar marca o pedido como recusado', async () => {
  preparar(vinculo('parceiro', 'aguardando'), ok);
  await parte5.recusarPedido(dono, 'v9');
  assert.deepEqual(consultas[1].dados, { status: 'recusado' });
});

test('banco: mudar escote guarda o valor anterior no histórico', async () => {
  preparar(vinculo('dono', 'ativo', 70), ok, { data: null, error: null });
  const r = await parte5.alterarEscote(dono, 'v9', 65);
  assert.deepEqual(r, { ok: true, percentual_anterior: 70, percentual_novo: 65 });
  assert.equal(consultas[2].dados.percentual_anterior, 70);
});

test('banco: escote de parceiro não pode ser alterado dos 40%', async () => {
  preparar(vinculo('parceiro', 'ativo', 40));
  await assert.rejects(parte5.alterarEscote(dono, 'v9', 60), (e) => e.codigo === 'escote_fixo');
  assert.equal(consultas.length, 1);
});

test('migração ajusta vínculos existentes e fixa parceiros em 40%', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const sql = fs.readFileSync(path.join(__dirname, '../sql/20261110_escote_parceiros_40.sql'), 'utf8');
  assert.match(sql, /update public\.vinculo[\s\S]*set escote_percentual = 40[\s\S]*perfil = 'parceiro'/i);
  assert.match(sql, /before insert or update on public\.vinculo/i);
  assert.match(sql, /new\.escote_percentual := 40/i);
  assert.match(sql, /vinculo_parceiro_escote_40[\s\S]*is not distinct from 40/i);
});

test('banco: recepção não tem escote', async () => {
  preparar(vinculo('recepcao', 'ativo'));
  await assert.rejects(parte5.alterarEscote(dono, 'v9', 10), (e) => e.codigo === 'sem_escote');
});

test('banco: remover marca o vínculo como removido e não remove o dono', async () => {
  preparar(vinculo('parceiro', 'ativo', 60), ok);
  await parte5.removerMembro(dono, 'v9');
  assert.deepEqual(consultas[1].dados, { status: 'removido' });

  preparar(vinculo('dono', 'ativo'));
  await assert.rejects(parte5.removerMembro(dono, 'v9'), (e) => e.codigo === 'dono_nao_removivel');
});

test('banco: id inválido vira 404 e erro desconhecido vira 500 sem vazar detalhes', async () => {
  preparar({ data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid' } });
  await assert.rejects(parte5.removerMembro(dono, 'abc'), (e) => e.status === 404);

  const original = console.error;
  console.error = () => {};
  preparar({ data: null, error: { code: 'XX000', message: 'SEGREDO_SQL' } });
  await assert.rejects(parte5.listarServicos(dono), (e) => e.status === 500 && !e.message.includes('SEGREDO'));
  console.error = original;
});

test('banco: barbearia vem no formato do contrato (HH:MM e criada_em)', async () => {
  preparar({ data: { id: 'b-minha', nome: 'X', codigo: 'BRB-AAAA-BBBB', data_inicio: null, criado_em: '2026-11-08T10:00:00Z',
    telefone: null, cidade: null, hora_abertura: '08:00:00', hora_fechamento: '19:00:00' }, error: null });
  const b = await parte5.obterBarbearia(dono);
  assert.equal(b.hora_abertura, '08:00');
  assert.equal(b.hora_fechamento, '19:00');
  assert.equal(b.criada_em, '2026-11-08T10:00:00Z');
  assert.equal(consultas[0].filtros.id, 'b-minha');
});

test('banco: novo código tenta de novo se o código sorteado já existir', async () => {
  preparar({ data: null, error: { code: '23505' } }, { data: { codigo: 'BRB-CCCC-DDDD' }, error: null });
  const r = await parte5.gerarNovoCodigo(dono);
  assert.equal(r.codigo, 'BRB-CCCC-DDDD');
  assert.equal(consultas.length, 2);
});
