const crypto = require('node:crypto');
const supabase = require('../supabase');

const FUSO_PADRAO = 'America/Sao_Paulo';
const OFFSET_PADRAO = '-03:00';
const campos = 'id,estabelecimento_id,barbeiro_id,cliente_id,inicio,fim,observacoes,forma_pagamento,nsu,escote_percentual,valor_total,valor_barbeiro,valor_barbearia,status,justificativa_rejeicao,barbeiro:usuario!atendimento_barbeiro_id_fkey(id,nome_completo),cliente:cliente!atendimento_cliente_id_fkey(id,nome_completo,cpf),servicos:servico_atendimento(id,servico_id,nome,preco),comprovantes:comprovante(id,caminho,criado_em)';

class FalhaParte3 extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}
function falha(status, codigo, mensagem) { return new FalhaParte3(status, codigo, mensagem); }
function conferirBanco(error) {
  if (!error) return;
  const codigo = String(error.message || '');
  const conhecidos = {
    BF_NAO_ENCONTRADO: [404, 'nao_encontrado', 'Atendimento não encontrado.'],
    BF_ATENDIMENTO_FECHADO: [409, 'atendimento_fechado', 'Este atendimento não está mais em andamento.'],
    BF_VINCULO_INATIVO: [403, 'vinculo_inativo', 'Seu vínculo com esta barbearia não está ativo.'],
    BF_CLIENTE_INVALIDO: [400, 'cliente_invalido', 'Cliente não pertence a esta barbearia.'],
    BF_SERVICOS_INVALIDOS: [400, 'servicos_invalidos', 'Selecione apenas serviços ativos desta barbearia, sem repetição.'],
    BF_SERVICOS_SOBREPOSTOS: [400, 'servicos_sobrepostos', 'O combo já inclui um dos serviços selecionados.'],
    BF_CLIENTE_OBRIGATORIO: [400, 'cliente_obrigatorio', 'Selecione o cliente antes de encerrar.'],
    BF_SERVICOS_OBRIGATORIOS: [400, 'servicos_obrigatorios', 'Selecione pelo menos um serviço.'],
    BF_PAGAMENTO_OBRIGATORIO: [400, 'pagamento_obrigatorio', 'Informe a forma de pagamento.'],
    BF_ESCOTE_NAO_CONFIGURADO: [409, 'escote_nao_configurado', 'O escote deste barbeiro ainda não foi configurado pela barbearia.'],
    BF_FIM_INVALIDO: [400, 'fim_invalido', 'O término deve ser posterior ao início.'],
    BF_PAGAMENTO_INVALIDO: [400, 'pagamento_invalido', 'Forma de pagamento inválida.'],
  };
  for (const [identificador, [status, chave, mensagem]] of Object.entries(conhecidos)) {
    if (codigo.includes(identificador)) throw falha(status, chave, mensagem);
  }
  if (error.code === '23P01') throw falha(409, 'atendimento_sobreposto', 'Existe outro atendimento sobreposto para este barbeiro.');
  if (error.code === '23505') throw falha(409, 'registro_duplicado', 'Este registro já existe.');
  if (error.code === '22P02') throw falha(400, 'identificador_invalido', 'Identificador inválido.');
  if (error.code === '23503') throw falha(400, 'referencia_invalida', 'Cliente ou serviço inválido.');
  if (error.code === '23514') throw falha(400, 'dados_invalidos', 'Confira os horários e informações do atendimento.');
  if (error.code === 'PGRST202' || error.code === '42883') {
    throw falha(503, 'migracao_pendente', 'A atualização SQL da API ainda não foi aplicada no Supabase.');
  }
  console.error('Parte 3 / Supabase:', error);
  throw falha(500, 'erro_banco', 'Não foi possível concluir a operação no banco de dados.');
}
function dataLocalAgora() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: FUSO_PADRAO });
}
function periodoDoDia(dia) {
  const proximo = new Date(`${dia}T12:00:00Z`);
  proximo.setUTCDate(proximo.getUTCDate() + 1);
  return [`${dia}T00:00:00${OFFSET_PADRAO}`, `${proximo.toISOString().slice(0, 10)}T00:00:00${OFFSET_PADRAO}`];
}
async function listarDia(usuario, dia) {
  const [inicio, fim] = periodoDoDia(dia);
  let consulta = supabase.from('atendimento').select(campos).eq('estabelecimento_id', usuario.estabelecimento_id)
    .gte('inicio', inicio).lt('inicio', fim).order('inicio', { ascending: true }).limit(200);
  if (usuario.perfil === 'parceiro') consulta = consulta.eq('barbeiro_id', usuario.id);
  const { data, error } = await consulta;
  conferirBanco(error);
  return Promise.all((data || []).map(serializar));
}
async function obterEmAndamento(usuario) {
  const { data, error } = await supabase.from('atendimento').select(campos)
    .eq('estabelecimento_id', usuario.estabelecimento_id)
    .eq('barbeiro_id', usuario.id)
    .eq('status', 'em_andamento')
    .order('inicio', { ascending: false }).limit(1).maybeSingle();
  conferirBanco(error);
  return data ? serializar(data) : null;
}

async function obterAtendimento(id, usuario) {
  let consulta = supabase.from('atendimento').select(campos).eq('id', id)
    .eq('estabelecimento_id', usuario.estabelecimento_id);
  if (usuario.perfil === 'parceiro') consulta = consulta.eq('barbeiro_id', usuario.id);
  const { data, error } = await consulta.maybeSingle();
  conferirBanco(error);
  if (!data) throw falha(404, 'nao_encontrado', 'Atendimento não encontrado.');
  return serializar(data);
}
async function serializar(registro) {
  const comprovantes = [...(registro.comprovantes || [])].sort((a,b) => b.criado_em.localeCompare(a.criado_em));
  let comprovanteUrl = null;
  if (comprovantes.length) {
    const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(comprovantes[0].caminho, 900);
    if (error) console.error('Parte 3 / assinatura de comprovante:', error);
    else comprovanteUrl = data.signedUrl;
  }
  return {
    id: registro.id,
    barbeiro: registro.barbeiro || { id: registro.barbeiro_id, nome_completo: 'Barbeiro' },
    cliente: registro.cliente || null,
    inicio: registro.inicio,
    fim: registro.fim,
    servicos: (registro.servicos || []).map((s) => ({ id: s.servico_id, nome: s.nome, preco: Number(s.preco) })),
    valor_total: Number(registro.valor_total || 0),
    observacoes: registro.observacoes || '',
    forma_pagamento: registro.forma_pagamento,
    nsu: registro.nsu,
    comprovante_url: comprovanteUrl,
    comprovante_anexado: comprovantes.length > 0,
    escote_percentual: registro.escote_percentual === null ? null : Number(registro.escote_percentual),
    valor_barbeiro: Number(registro.valor_barbeiro || 0),
    valor_barbearia: Number(registro.valor_barbearia || 0),
    status: registro.status,
    justificativa_rejeicao: registro.justificativa_rejeicao || null,
  };
}
async function iniciar(usuario, inicio) {
  const { data, error } = await supabase.rpc('bf_atendimento_iniciar', {
    p_estabelecimento: usuario.estabelecimento_id,
    p_barbeiro: usuario.id,
    p_inicio: inicio || new Date().toISOString(),
  });
  conferirBanco(error);
  return obterAtendimento(data, usuario);
}
async function salvar(usuario, id, body, encerrar = false) {
  const { error } = await supabase.rpc('bf_atendimento_salvar', {
    p_id: id, p_estabelecimento: usuario.estabelecimento_id, p_barbeiro: usuario.id,
    p_cliente: body.cliente_id ?? null,
    p_definir_cliente: Object.hasOwn(body, 'cliente_id'),
    p_servicos: body.servicos ?? null,
    p_observacoes: body.observacoes ?? null,
    p_definir_observacoes: Object.hasOwn(body, 'observacoes'),
    p_forma_pagamento: body.forma_pagamento ?? null,
    p_definir_forma_pagamento: Object.hasOwn(body, 'forma_pagamento'),
    p_nsu: body.nsu ?? null,
    p_definir_nsu: Object.hasOwn(body, 'nsu'),
    p_inicio: body.inicio ?? null,
    p_fim: encerrar ? (body.fim ?? new Date().toISOString()) : null,
    p_encerrar: encerrar,
  });
  conferirBanco(error);
  return obterAtendimento(id, usuario);
}
async function comprovante(usuario, id, bytes, tipo) {
  const eRecepcao = usuario.perfil === 'recepcao';
  let consulta = supabase.from('atendimento').select('id,status,barbeiro_id')
    .eq('id', id).eq('estabelecimento_id', usuario.estabelecimento_id);
  if (!eRecepcao) consulta = consulta.eq('barbeiro_id', usuario.id);
  const { data: registro, error: erroAtendimento } = await consulta.maybeSingle();
  conferirBanco(erroAtendimento);
  if (!registro) throw falha(404, 'nao_encontrado', 'Atendimento não encontrado.');
  if (eRecepcao && registro.status !== 'registrado')
    throw falha(409, 'atendimento_fechado', 'A recepção só pode anexar comprovantes em atendimentos pendentes de validação.');
  if (!eRecepcao && !['em_andamento', 'registrado'].includes(registro.status))
    throw falha(409, 'atendimento_fechado', 'Não é possível anexar comprovante após a validação.');
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' }[tipo];
  const caminho = `${usuario.estabelecimento_id}/${registro.barbeiro_id}/${id}/${crypto.randomUUID()}.${ext}`;
  const { error: erroUpload } = await supabase.storage.from('comprovantes').upload(caminho, bytes, { contentType: tipo, upsert: false });
  conferirBanco(erroUpload);
  const { error: erroRegistro } = await supabase.from('comprovante').insert({ atendimento_id: id, caminho });
  if (erroRegistro) {
    await supabase.storage.from('comprovantes').remove([caminho]);
    conferirBanco(erroRegistro);
  }
  return obterAtendimento(id, eRecepcao ? { ...usuario, perfil: 'dono' } : usuario);
}
function responderFalha(res, erro) {
  if (erro instanceof FalhaParte3) return res.status(erro.status).json({ erro: erro.codigo, mensagem: erro.message });
  console.error('Parte 3 / erro inesperado:', erro);
  return res.status(500).json({ erro: 'erro_interno', mensagem: 'Não foi possível completar esta operação.' });
}
module.exports = { conferirBanco, falha, listarDia, dataLocalAgora, obterEmAndamento, obterAtendimento, iniciar, salvar, comprovante, responderFalha, serializar };
