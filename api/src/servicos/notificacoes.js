const supabase = require('../supabase');
const parte3 = require('./parte3');

async function executar(consulta) {
  const { data, error } = await consulta;
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      console.error('Notificações / migração pendente:', error);
      throw parte3.falha(503, 'migracao_notificacoes_pendente', 'A atualização de notificações ainda não foi aplicada no Supabase.');
    }
    parte3.conferirBanco(error);
  }
  return data;
}

async function listar(usuario) {
  const data = await executar(
    supabase.from('notificacao_atendimento')
      .select('id,atendimento_id,titulo,mensagem,criado_em,lida_em')
      .eq('estabelecimento_id', usuario.estabelecimento_id)
      .eq('usuario_id', usuario.id)
      .order('criado_em', { ascending: false })
      .limit(30)
  );
  return data || [];
}

async function marcarLida(usuario, id) {
  const data = await executar(
    supabase.from('notificacao_atendimento')
      .update({ lida_em: new Date().toISOString() })
      .eq('id', id)
      .eq('estabelecimento_id', usuario.estabelecimento_id)
      .eq('usuario_id', usuario.id)
      .is('lida_em', null)
      .select('id,lida_em')
      .maybeSingle()
  );
  if (!data) throw parte3.falha(404, 'notificacao_nao_encontrada', 'Notificação não encontrada.');
  return data;
}

module.exports = { listar, marcarLida };
