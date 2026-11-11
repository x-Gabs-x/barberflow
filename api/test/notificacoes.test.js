const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('encerramento grava notificações para todos os donos ativos da barbearia', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../sql/20261110_notificacoes_atendimento.sql'), 'utf8');
  assert.match(sql, /after update of status on public\.atendimento/i);
  assert.match(sql, /new\.status <> 'registrado' or old\.status = 'registrado'/i);
  assert.match(sql, /from public\.vinculo v[\s\S]*v\.perfil = 'dono'[\s\S]*v\.status = 'ativo'/i);
  assert.match(sql, /v\.estabelecimento_id = new\.estabelecimento_id/i);
  assert.match(sql, /new\.id,[\s\S]*'Atendimento encerrado'/i);
  assert.match(sql, /notificacao_atendimento_usuario_data_idx/i);
});

test('notificações só podem ser consultadas e marcadas pelo dono da rota protegida', () => {
  const rota = fs.readFileSync(path.join(__dirname, '../src/rotas/notificacoes.js'), 'utf8');
  assert.match(rota, /router\.use\(exigirPerfil\('dono'\)\)/);
  assert.match(rota, /router\.get\('\//);
  assert.ok(rota.includes("router.patch('/:id/lida'"));
});
