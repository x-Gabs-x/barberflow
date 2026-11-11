const { falha } = require('./parte3');
const dados = require('./demo-parte3');

const fechamentos = new Map();
const statusSomaveis = new Set(['validado_recepcao', 'validado_dono']);

function chaveDia(dia) { return `usuario-de-teste:${dia}`; }

function resumo(usuario, dia) {
  const atendimentos = dados.listar(dia, { usuario }).filter((a) => statusSomaveis.has(a.status));
  const barbeiros = new Map();
  const pagamentos = { dinheiro: 0, pix: 0, cartao: 0 };
  let total = 0;
  for (const a of atendimentos) {
    total += a.valor_total;
    pagamentos[a.forma_pagamento] = (pagamentos[a.forma_pagamento] || 0) + a.valor_total;
    const atual = barbeiros.get(a.barbeiro.id) || {
      barbeiro_id: a.barbeiro.id,
      nome_completo: a.barbeiro.nome_completo,
      total: 0,
      valor_barbeiro: 0,
      valor_barbearia: 0,
    };
    atual.total += a.valor_total;
    atual.valor_barbeiro += a.valor_barbeiro;
    atual.valor_barbearia += a.valor_barbearia;
    barbeiros.set(a.barbeiro.id, atual);
  }
  return {
    data: dia,
    status: fechamentos.get(chaveDia(dia))?.status || 'aberto',
    total,
    quantidade_atendimentos: atendimentos.length,
    por_barbeiro: [...barbeiros.values()],
    por_forma_pagamento: pagamentos,
    demonstracao: true,
  };
}

function validarDono(usuario) {
  if (usuario.perfil !== 'dono') throw falha(403, 'sem_permissao', 'Seu perfil não pode fazer isso.');
}

function confirmar(usuario, dia) {
  validarDono(usuario);
  const chave = chaveDia(dia);
  if ((fechamentos.get(chave)?.status || 'aberto') !== 'aberto') {
    throw falha(409, 'fechamento_status_invalido', 'O fechamento foi alterado e não pode mais receber esta ação.');
  }
  const lista = dados.listar(dia, { usuario });
  for (const a of lista) {
    if (a.status === 'validado_recepcao') dados.definirStatus(a.id, 'validado_dono');
  }
  fechamentos.set(chave, { status: 'confirmado' });
  return { ok: true, data: dia, status: 'confirmado', demonstracao: true };
}

function devolver(usuario, dia, justificativa) {
  validarDono(usuario);
  const chave = chaveDia(dia);
  if (fechamentos.get(chave)?.status !== 'confirmado') {
    throw falha(409, 'fechamento_status_invalido', 'O fechamento foi alterado e não pode mais receber esta ação.');
  }
  if (!justificativa.trim() || justificativa.length > 300) {
    throw falha(400, 'justificativa_invalida', 'Informe uma justificativa com até 300 caracteres.');
  }
  for (const a of dados.listar(dia, { usuario })) {
    if (a.status === 'validado_dono') dados.definirStatus(a.id, 'validado_recepcao');
  }
  fechamentos.set(chave, { status: 'aberto', justificativa });
  return { ok: true, data: dia, status: 'aberto', demonstracao: true };
}

module.exports = { resumo, confirmar, devolver };
