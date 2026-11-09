const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const moduloSupabase = require.resolve('../src/supabase');
require.cache[moduloSupabase] = {
  id: moduloSupabase, filename: moduloSupabase, loaded: true,
  exports: { rpc: async () => ({ error: null }), from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) },
};
const demo = require('../src/servicos/demo-parte3');
const recepcao = require('../src/servicos/demo-validacao');
const { validarSelecao } = require('../src/servicos/combinacoes');
const dono = { usuario: { id: 'usuario-de-teste', perfil: 'dono' } };
const atendente = { usuario: { id: 'usuario-de-teste', perfil: 'recepcao' } };
const parceiro = { usuario: { id: 'usuario-de-teste', perfil: 'parceiro' } };

test('combo não é somado aos seus próprios componentes e aceita serviço adicional independente', () => {
  assert.equal(validarSelecao([{ nome: 'Corte' }, { nome: 'Barba' }]), true);
  assert.equal(validarSelecao([{ nome: 'Corte' }, { nome: 'Corte + barba' }]), false);
  assert.equal(validarSelecao([{ nome: 'Corte + barba' }, { nome: 'Barba' }]), false);
  assert.equal(validarSelecao([{ nome: 'Corte + barba' }, { nome: 'Sobrancelha' }]), true);
  assert.equal(validarSelecao([{ nome: 'Tosa' }, { nome: 'Banho + tosa' }]), false);
});

test('o backend recusa 135 reais e aceita o combo de 65 reais', () => {
  const a = demo.iniciar(dono, '2026-11-09T13:00:00-03:00');
  assert.throws(() => demo.salvar(dono, a.id, { servicos: ['s1', 's2', 's3'] }), (e) => e.status === 400 && e.codigo === 'servicos_sobrepostos');
  assert.equal(demo.obter(dono, a.id).valor_total, 0);
  const salvo = demo.salvar(dono, a.id, { servicos: ['s3'] });
  assert.equal(salvo.valor_total, 65);
});

test('recepção só valida depois de comprovante e não altera valores em correções', () => {
  const a = demo.iniciar(parceiro, '2026-11-09T13:30:00-03:00');
  const cliente = demo.cadastrarCliente({ cpf: '93541134780', nome_completo: 'Cliente recepção' });
  demo.salvar(parceiro, a.id, { cliente_id: cliente.id, servicos: ['s3'], forma_pagamento: 'pix' });
  demo.salvar(parceiro, a.id, { fim: '2026-11-09T14:00:00-03:00' }, true);
  assert.equal(recepcao.listar(atendente, { data: '2026-11-09' }).find((x) => x.id === a.id).valor_total, 65);
  assert.throws(() => recepcao.atualizar(atendente, a.id, 'validar'), (e) => e.codigo === 'comprovante_obrigatorio');
  assert.throws(() => recepcao.atualizar(dono, a.id, 'validar'), (e) => e.status === 403);
  assert.throws(() => recepcao.atualizar(atendente, a.id, 'rejeitar', { justificativa: '' }), (e) => e.status === 400);
  const corrigido = recepcao.atualizar(atendente, a.id, 'corrigir', { observacoes: 'Pagamento confirmado', forma_pagamento: 'cartao', nsu: '1234' });
  assert.equal(corrigido.valor_total, 65);
  assert.equal(corrigido.forma_pagamento, 'cartao');
  demo.comprovante(parceiro, a.id);
  const validado = recepcao.atualizar(atendente, a.id, 'validar');
  assert.equal(validado.status, 'validado_recepcao');
  assert.throws(() => recepcao.atualizar(atendente, a.id, 'corrigir', { observacoes: 'x' }), (e) => e.status === 409);
});

test('a recepção anexa comprovante ao atendimento registrado, sem aceitar anexos após validação', () => {
  const a = demo.iniciar(parceiro, '2026-11-09T16:00:00-03:00');
  const cliente = demo.cadastrarCliente({ cpf: '82846097091', nome_completo: 'Cliente comprovante' });
  demo.salvar(parceiro, a.id, { cliente_id: cliente.id, servicos: ['s3'], forma_pagamento: 'dinheiro' });
  assert.throws(() => demo.comprovante(atendente, a.id), (e) => e.status === 409);
  demo.salvar(parceiro, a.id, { fim: '2026-11-09T16:20:00-03:00' }, true);
  const anexado = demo.comprovante(atendente, a.id);
  assert.equal(anexado.comprovante_anexado, true);
  const validado = recepcao.atualizar(atendente, a.id, 'validar');
  assert.equal(validado.status, 'validado_recepcao');
  assert.throws(() => demo.comprovante(atendente, a.id), (e) => e.status === 409);
});

test('rejeição exige motivo e não transforma atendimento em validado', () => {
  const a = demo.iniciar(parceiro, '2026-11-09T15:00:00-03:00');
  const cliente = demo.cadastrarCliente({ cpf: '29469079067', nome_completo: 'Cliente dois' });
  demo.salvar(parceiro, a.id, { cliente_id: cliente.id, servicos: ['s1'], forma_pagamento: 'dinheiro' });
  demo.salvar(parceiro, a.id, { fim: '2026-11-09T15:30:00-03:00' }, true);
  const rejeitado = recepcao.atualizar(atendente, a.id, 'rejeitar', { justificativa: 'Pagamento divergente' });
  assert.equal(rejeitado.status, 'rejeitado');
  assert.equal(rejeitado.justificativa_rejeicao, 'Pagamento divergente');
  assert.throws(() => recepcao.atualizar(atendente, a.id, 'validar'), (e) => e.status === 409);
});

test('migração SQL protege comprovante, estabelecimento, transação e combos', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/20261109_parte3_combo_recepcao.sql'), 'utf8');
  assert.match(sql, /BF_COMPROVANTE_OBRIGATORIO/);
  assert.match(sql, /from public\.comprovante where atendimento_id = p_id/);
  assert.match(sql, /estabelecimento_id = p_estabelecimento for update/);
  assert.match(sql, /BF_SERVICOS_SOBREPOSTOS/);
  assert.match(sql, /grant execute on function public\.bf_recepcao_validar/);
});
