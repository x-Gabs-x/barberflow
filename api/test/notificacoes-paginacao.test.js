const test = require('node:test');
const assert = require('node:assert/strict');

const consultas = [];
const registros = Array.from({ length: 31 }, (_, indice) => ({
  id: `notificacao-${indice}`,
  criado_em: new Date(Date.UTC(2026, 10, 13, 18, indice)).toISOString(),
  lida_em: null,
}));

const supabaseMock = {
  from: (tabela) => ({
    select: (campos, opcoes) => {
      const chamada = { tabela, campos, opcoes, filtros: [], ordens: [], intervalo: null };
      consultas.push(chamada);
      const consulta = {
        eq: (campo, valor) => { chamada.filtros.push([campo, valor]); return consulta; },
        is: (campo, valor) => { chamada.filtros.push([campo, valor]); return consulta; },
        order: (campo, opcoesOrdem) => { chamada.ordens.push([campo, opcoesOrdem]); return consulta; },
        range: (inicio, fim) => { chamada.intervalo = [inicio, fim]; return consulta; },
        then: (resolver) => Promise.resolve(opcoes?.head
          ? { data: null, count: 42, error: null }
          : { data: registros, error: null }).then(resolver),
      };
      return consulta;
    },
  }),
};

const moduloSupabase = require.resolve('../src/supabase');
require.cache[moduloSupabase] = {
  id: moduloSupabase, filename: moduloSupabase, loaded: true, exports: supabaseMock,
};
const { listar } = require('../src/servicos/notificacoes');

test('pagina notificações do dono e conta todas as não lidas', async () => {
  const pagina = await listar({ id: 'dono-1', estabelecimento_id: 'barbearia-1' }, 30);
  assert.equal(pagina.notificacoes.length, 30);
  assert.equal(pagina.nao_lidas, 42);
  assert.equal(pagina.tem_mais, true);
  assert.equal(consultas.length, 2);
  for (const consulta of consultas) {
    assert.equal(consulta.tabela, 'notificacao_atendimento');
    assert.deepEqual(consulta.filtros.slice(0, 2), [
      ['estabelecimento_id', 'barbearia-1'],
      ['usuario_id', 'dono-1'],
    ]);
  }
  assert.deepEqual(consultas[0].intervalo, [30, 60]);
  assert.match(consultas[0].campos, /atendimento:atendimento!notificacao_atendimento_atendimento_id_fkey\(inicio\)/);
  assert.deepEqual(consultas[1].filtros[2], ['lida_em', null]);
});
