const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const moduloSupabase = require.resolve('../src/supabase');
const chamadas = [];
const registro = {
  id: 'id-mock',
  barbeiro_id: 'barbeiro-real',
  barbeiro: { id: 'barbeiro-real', nome_completo: 'Barbeiro Teste' },
  cliente: null,
  inicio: '2026-11-09T13:00:00-03:00',
  fim: '2026-11-09T14:00:00-03:00',
  servicos: [],
  comprovantes: [],
  status: 'registrado',
};
const mock = {
  from: (tabela) => ({
    select: (colunas) => {
      const consulta = {
        eq: () => consulta,
        maybeSingle: async () => ({
          data: colunas === 'barbeiro_id' ? { barbeiro_id: 'barbeiro-real' } : registro,
          error: null,
        }),
      };
      return consulta;
    },
  }),
  storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://example.invalid/signed' } }) }) },
  rpc: async (nome, dados) => { chamadas.push({ nome, dados }); return { data: 'id-mock', error: null }; },
};
require.cache[moduloSupabase] = { id: moduloSupabase, filename: moduloSupabase, loaded: true, exports: mock };
const parte3 = require('../src/servicos/parte3');
const demo = require('../src/servicos/demo-parte3');

test('demo: iniciar, buscar/cadastrar cliente, salvar, encerrar e comprovante', () => {
  const req = { usuario: { id: 'usuario-de-teste', perfil: 'parceiro' } };
  assert.equal(demo.listarClientes('Renato')[0].cpf, '52998224725');
  assert.equal(demo.listarClientes('5299')[0].nome_completo, 'Renato Barros');
  const inicio = demo.iniciar(req, '2026-11-09T13:00:00-03:00');
  assert.equal(inicio.status, 'em_andamento');
  assert.throws(() => demo.iniciar(req), /em andamento/);
  const cliente = demo.cadastrarCliente({ cpf: '11144477735', nome_completo: 'Maria Teste' });
  assert.equal(demo.listarClientes(cliente.cpf).length, 1);
  const editado = demo.salvar(req, inicio.id, { cliente_id: cliente.id, servicos: ['s1', 's2'], forma_pagamento: 'pix' });
  assert.equal(editado.valor_total, 50);
  const encerrado = demo.salvar(req, inicio.id, { fim: '2026-11-09T14:00:00-03:00' }, true);
  assert.equal(encerrado.status, 'registrado');
  assert.equal(encerrado.escote_percentual, 40);
  assert.equal(encerrado.valor_barbeiro, 20);
  assert.equal(encerrado.valor_barbearia, 30);
  assert.equal(demo.comprovante(req, inicio.id).comprovante_anexado, true);
  assert.equal(demo.listar('2026-11-09').length, 1);
  assert.throws(() => demo.salvar(req, inicio.id, { observacoes: 'tentar mudar' }), /encerrado/);
});

test('demo: bloqueia cliente inválido e serviços inexistentes', () => {
  const req = { usuario: { id: 'usuario-de-teste', perfil: 'dono' } };
  const a = demo.iniciar(req, '2026-11-09T14:10:00-03:00');
  assert.throws(() => demo.salvar(req, a.id, { cliente_id: 'outro' }), /Cliente/);
  assert.throws(() => demo.salvar(req, a.id, { servicos: ['s1', 's1'] }), /repetir/);
  assert.throws(() => demo.salvar(req, a.id, { servicos: ['servico-fora'] }), /serviços ativos/);
});

test('data de agenda preserva início e fim do dia local', () => {
  assert.deepEqual(parte3.dataLocalAgora().length, 10);
  const { conferirBanco } = parte3;
  assert.throws(() => conferirBanco({ code: '23P01', message: 'conflict' }), (e) => e.status === 409 && e.codigo === 'atendimento_sobreposto');
  assert.throws(() => conferirBanco({ code: 'PGRST202', message: 'missing RPC' }), (e) => e.status === 503);
});

test('migração mantém gravação transacional e permissão apenas para a API', () => {
  const fs = require('node:fs');
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '20261109_parte3_atendimento.sql'), 'utf8');
  assert.match(sql, /for update/i);
  assert.match(sql, /insert into public\.servico_atendimento/i);
  assert.match(sql, /status\s*=\s*'registrado'/i);
  assert.match(sql, /round\(v_total \* v_escote \/ 100, 2\)/i);
  assert.match(sql, /revoke all on function public\.bf_atendimento_salvar/i);
  assert.match(sql, /grant execute on function public\.bf_atendimento_salvar[\s\S]*to service_role/i);
});

test('demo: atendimento aberto continua localizável após mudar de dia', () => {
  const a = demo.emAndamento();
  assert.ok(a);
  assert.match(a.id, /^demo-/);
  assert.equal(a.status, 'em_andamento');
  assert.equal(demo.listar('2026-11-10').length, 0);
});

test('demo: dono consegue iniciar atendimento sem herdar atendimento aberto do parceiro', () => {
  const parceiro = { usuario: { id: 'usuario-de-teste', perfil: 'parceiro' } };
  const dono = { usuario: { id: 'usuario-de-teste', perfil: 'dono' } };
  const anterior = demo.emAndamento(dono);
  if (anterior) {
    assert.equal(anterior.barbeiro.id, 'usuario-de-teste:dono');
    assert.equal(demo.emAndamento(parceiro), null);
    assert.throws(() => demo.salvar(parceiro, anterior.id, { observacoes: 'x' }), /não encontrado/);
    return;
  }
  const iniciado = demo.iniciar(dono, '2026-11-09T15:00:00-03:00');
  assert.equal(iniciado.barbeiro.nome_completo, 'Dono de Teste');
  assert.equal(demo.emAndamento(dono).id, iniciado.id);
  assert.equal(demo.emAndamento(parceiro), null);
  assert.throws(() => demo.salvar(parceiro, iniciado.id, { observacoes: 'x' }), /não encontrado/);
});

test('navegação: novo atendimento do Dono abre rota fora das abas', () => {
  const fs = require('node:fs');
  const ler = (arquivo) => fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'src', arquivo), 'utf8');
  assert.match(ler('components/AgendaParte3.tsx'), /'\/atendimento-dono'/);
  assert.match(ler('app/atendimento-dono.tsx'), /AtendimentoParte3 perfil=\"dono\"/);
  assert.doesNotMatch(ler('app/dono/_layout.tsx'), /name=\"novo\"/);
  assert.match(ler('components/AgendaParte3.tsx'), /Ver atendimento/);
});

test('demo: Dono e Parceiro podem manter atendimentos independentes', () => {
  const dono = { usuario: { id: 'usuario-de-teste', perfil: 'dono' } };
  const parceiro = { usuario: { id: 'usuario-de-teste', perfil: 'parceiro' } };
  const idDono = demo.emAndamento(dono).id;
  const doParceiro = demo.iniciar(parceiro, '2026-11-09T15:20:00-03:00');
  assert.equal(demo.emAndamento(dono).id, idDono);
  assert.equal(demo.emAndamento(parceiro).id, doParceiro.id);
  assert.notEqual(demo.emAndamento(dono).barbeiro.id, demo.emAndamento(parceiro).barbeiro.id);
  demo.salvar(parceiro, doParceiro.id, { cliente_id: 'c3', servicos: ['s1'], forma_pagamento: 'pix' });
  assert.equal(demo.salvar(dono, doParceiro.id, {}, true).status, 'registrado');
  assert.equal(demo.listar('2026-11-09', parceiro).filter((a) => a.id === idDono).length, 0);
  assert.ok(demo.listar('2026-11-09', dono).some((a) => a.id === doParceiro.id));
});

test('dono encerra atendimento do barbeiro usando o profissional vinculado ao registro', async () => {
  chamadas.length = 0;
  const resultado = await parte3.salvar({
    id: 'dono-id',
    perfil: 'dono',
    estabelecimento_id: 'barbearia-id',
  }, 'id-mock', {}, true);

  assert.equal(resultado.status, 'registrado');
  assert.equal(chamadas[0].nome, 'bf_atendimento_salvar');
  assert.equal(chamadas[0].dados.p_barbeiro, 'barbeiro-real');
});
