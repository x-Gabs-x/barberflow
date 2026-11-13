const supabase = require('../supabase');
const parte3 = require('./parte3');

async function executar(consulta) {
  const resposta = await consulta;
  const { error } = resposta;
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      console.error('Notificações / migração pendente:', error);
      throw parte3.falha(503, 'migracao_notificacoes_pendente', 'A atualização de notificações ainda não foi aplicada no Supabase.');
    }
    parte3.conferirBanco(error);
  }
  return resposta;
}

async function listar(usuario, deslocamento = 0) {
  const filtrarUsuario = (consulta) => consulta
    .eq('estabelecimento_id', usuario.estabelecimento_id)
    .eq('usuario_id', usuario.id);
  const [{ data }, { count }] = await Promise.all([
    executar(
      filtrarUsuario(supabase.from('notificacao_atendimento')
        .select('id,atendimento_id,titulo,mensagem,criado_em,lida_em,atendimento:atendimento!notificacao_atendimento_atendimento_id_fkey(inicio)'))
        .order('criado_em', { ascending: false })
        .order('id', { ascending: false })
        .range(deslocamento, deslocamento + 30)
    ),
    executar(filtrarUsuario(supabase.from('notificacao_atendimento')
      .select('id', { count: 'exact', head: true })).is('lida_em', null)),
  ]);
  const lista = data || [];
  return { notificacoes: lista.slice(0, 30), nao_lidas: count || 0, tem_mais: lista.length > 30 };
}

async function marcarLida(usuario, id) {
  const { data } = await executar(
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
