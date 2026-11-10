const supabase = require('../supabase');
const parte3 = require('./parte3');
const demo = require('./demo-fechamento');

function parametros(usuario) {
  return {
    p_estabelecimento: usuario.estabelecimento_id,
    p_usuario: usuario.id,
  };
}

function conferirErro(error) {
  if (!error) return;
  const mensagem = String(error.message || '');
  const conhecidos = {
    BF_FECHAMENTO_SEM_PERMISSAO: [403, 'sem_permissao', 'Você não tem permissão nesta barbearia.'],
    BF_FECHAMENTO_STATUS_INVALIDO: [409, 'fechamento_status_invalido', 'O fechamento foi alterado e não pode mais receber esta ação.'],
    BF_FECHAMENTO_NAO_ENCONTRADO: [404, 'fechamento_nao_encontrado', 'Fechamento não encontrado.'],
    BF_JUSTIFICATIVA_INVALIDA: [400, 'justificativa_invalida', 'Informe uma justificativa com até 300 caracteres.'],
  };
  for (const [chave, [status, codigo, texto]] of Object.entries(conhecidos)) {
    if (mensagem.includes(chave)) throw parte3.falha(status, codigo, texto);
  }
  parte3.conferirBanco(error);
}

async function resumo(usuario, dia) {
  if (usuario.id === 'usuario-de-teste') return demo.resumo(usuario, dia);
  const { data, error } = await supabase.rpc('bf_fechamento_resumo', {
    ...parametros(usuario),
    p_data: dia,
  });
  conferirErro(error);
  return data;
}

async function confirmar(usuario, dia) {
  if (usuario.id === 'usuario-de-teste') return demo.confirmar(usuario, dia);
  const { data, error } = await supabase.rpc('bf_fechamento_confirmar', {
    ...parametros(usuario),
    p_data: dia,
  });
  conferirErro(error);
  return data;
}

async function devolver(usuario, dia, justificativa) {
  if (usuario.id === 'usuario-de-teste') return demo.devolver(usuario, dia, justificativa);
  const { data, error } = await supabase.rpc('bf_fechamento_devolver', {
    ...parametros(usuario),
    p_data: dia,
    p_justificativa: justificativa,
  });
  conferirErro(error);
  return data;
}

module.exports = { resumo, confirmar, devolver };
