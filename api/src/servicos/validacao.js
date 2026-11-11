const supabase = require('../supabase');
const parte3 = require('./parte3');
const demo = require('./demo-validacao');
function parametros(usuario) {
  return { p_estabelecimento: usuario.estabelecimento_id, p_usuario: usuario.id };
}
async function lista(usuario, filtros) {
  if (usuario.id === 'usuario-de-teste') return demo.listar({ usuario }, filtros);
  const todos = await parte3.listarDia({ ...usuario, perfil: 'dono' }, filtros.data || parte3.dataLocalAgora());
  return todos.filter((a) => (!filtros.status || a.status === filtros.status) && (!filtros.barbeiro || a.barbeiro.id === filtros.barbeiro));
}
async function executar(usuario, id, acao, dados = {}) {
  if (usuario.id === 'usuario-de-teste') return demo.atualizar({ usuario }, id, acao, dados);
  const comandos = {
    validar: 'bf_recepcao_validar',
    corrigir: 'bf_recepcao_corrigir',
    rejeitar: 'bf_recepcao_rejeitar',
  };
  const p = { p_id: id, ...parametros(usuario) };
  if (acao === 'corrigir') {
    p.p_observacoes = dados.observacoes ?? null;
    p.p_definir_observacoes = Object.hasOwn(dados, 'observacoes');
    p.p_forma_pagamento = dados.forma_pagamento ?? null;
    p.p_definir_forma_pagamento = Object.hasOwn(dados, 'forma_pagamento');
    p.p_nsu = dados.nsu ?? null;
    p.p_definir_nsu = Object.hasOwn(dados, 'nsu');
  }
  if (acao === 'rejeitar') p.p_justificativa = dados.justificativa;
  const { error } = await supabase.rpc(comandos[acao], p);
  if (error) {
    const m = String(error.message || '');
    const conhecidos = {
      BF_RECEPCAO_SEM_PERMISSAO: [403, 'sem_permissao', 'Você não tem permissão nesta barbearia.'],
      BF_STATUS_INVALIDO: [409, 'status_invalido', 'O atendimento foi alterado e não pode mais receber esta ação.'],
      BF_COMPROVANTE_OBRIGATORIO: [409, 'comprovante_obrigatorio', 'É necessário anexar um comprovante antes de validar.'],
      BF_JUSTIFICATIVA_INVALIDA: [400, 'justificativa_invalida', 'Informe uma justificativa com até 300 caracteres.'],
      BF_PAGAMENTO_INVALIDO: [400, 'pagamento_invalido', 'Forma de pagamento inválida.'],
    };
    for (const [chave, [status, codigo, mensagem]] of Object.entries(conhecidos)) {
      if (m.includes(chave)) throw parte3.falha(status, codigo, mensagem);
    }
    parte3.conferirBanco(error);
  }
  return parte3.obterAtendimento(id, { ...usuario, perfil: 'dono' });
}
module.exports = { lista, executar };
