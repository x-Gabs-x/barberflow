const supabase = require('../supabase');
const dados = require('../dados-teste');
const { gerarCodigo } = require('./cadastrar-dono');

// Parte 5: equipe, serviços e configurações da barbearia.
// Com o perfil de teste (x-dev-perfil) os dados ficam na memória da API;
// com login de verdade tudo é gravado no Supabase, sempre filtrado pela barbearia do usuário.

class FalhaParte5 extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}
const falha = (status, codigo, mensagem) => new FalhaParte5(status, codigo, mensagem);

function ehDemo(usuario) {
  return usuario.id === 'usuario-de-teste';
}

function conferirBanco(error) {
  if (!error) return;
  if (error.code === '22P02') throw falha(404, 'nao_encontrado', 'Registro não encontrado.');
  if (error.code === '23505') throw falha(409, 'registro_duplicado', 'Este registro já existe.');
  console.error('Parte 5 / Supabase:', error);
  throw falha(500, 'erro_banco', 'Não foi possível concluir a operação no banco de dados.');
}

function responderFalha(res, erro) {
  if (erro instanceof FalhaParte5) {
    return res.status(erro.status).json({ erro: erro.codigo, mensagem: erro.message });
  }
  console.error(erro);
  return res.status(500).json({ erro: 'erro_interno', mensagem: 'Algo deu errado. Tente novamente em instantes.' });
}

// Usado nas rotas: chama a função e responde com o resultado ou com o erro tratado.
const responder = (fn, status = 200) => async (req, res) => {
  try {
    res.status(status).json(await fn(req));
  } catch (erro) {
    responderFalha(res, erro);
  }
};

const numeroOuNulo =(v) => (v === null || v === undefined ? null : Number(v));

// ---------- Equipe ----------

const camposVinculo = 'id,perfil,status,escote_percentual,usuario:usuario!vinculo_usuario_id_fkey(id,nome_completo)';

function formatarMembro(v) {
  return {
    id: v.id,
    usuario: { id: v.usuario.id, nome_completo: v.usuario.nome_completo },
    perfil: v.perfil,
    escote_percentual: numeroOuNulo(v.escote_percentual),
    status: v.status,
  };
}

async function listarEquipe(usuario, status) {
  if (ehDemo(usuario)) return dados.equipe.filter((m) => m.status === status);
  const { data, error } = await supabase.from('vinculo').select(camposVinculo)
    .eq('estabelecimento_id', usuario.estabelecimento_id)
    .eq('status', status)
    .order('criado_em', { ascending: true });
  conferirBanco(error);
  return data.map(formatarMembro);
}

async function buscarVinculo(usuario, id, status) {
  if (ehDemo(usuario)) {
    const membro = dados.equipe.find((m) => m.id === id && m.status === status);
    if (!membro) throw falha(404, 'nao_encontrado', 'Pessoa não encontrada.');
    return membro;
  }
  const { data, error } = await supabase.from('vinculo').select(camposVinculo)
    .eq('id', id)
    .eq('estabelecimento_id', usuario.estabelecimento_id)
    .eq('status', status)
    .maybeSingle();
  conferirBanco(error);
  if (!data) throw falha(404, 'nao_encontrado', 'Pessoa não encontrada.');
  return formatarMembro(data);
}

// Só altera se o vínculo ainda estiver no status esperado (evita aprovar duas vezes, por exemplo).
async function atualizarVinculo(usuario, id, statusAtual, mudancas) {
  if (ehDemo(usuario)) {
    Object.assign(dados.equipe.find((m) => m.id === id), mudancas);
    return;
  }
  const { data, error } = await supabase.from('vinculo').update(mudancas)
    .eq('id', id)
    .eq('estabelecimento_id', usuario.estabelecimento_id)
    .eq('status', statusAtual)
    .select('id')
    .maybeSingle();
  conferirBanco(error);
  if (!data) throw falha(404, 'nao_encontrado', 'Pessoa não encontrada.');
}

async function registrarEscote(usuario, vinculoId, anterior, novo) {
  if (ehDemo(usuario)) return;
  const { error } = await supabase.from('historico_escote').insert({
    vinculo_id: vinculoId,
    percentual_anterior: anterior,
    percentual_novo: novo,
    alterado_por: usuario.id,
  });
  conferirBanco(error);
}

async function aprovarPedido(usuario, id) {
  const pedido = await buscarVinculo(usuario, id, 'aguardando');
  const escoteFinal = pedido.perfil === 'parceiro' ? 40 : null;
  await atualizarVinculo(usuario, id, 'aguardando', { status: 'ativo', escote_percentual: escoteFinal });
  if (escoteFinal !== null && pedido.escote_percentual !== escoteFinal) {
    await registrarEscote(usuario, id, pedido.escote_percentual, escoteFinal);
  }
  return { ok: true, escote_percentual: escoteFinal };
}

async function recusarPedido(usuario, id) {
  await buscarVinculo(usuario, id, 'aguardando');
  await atualizarVinculo(usuario, id, 'aguardando', { status: 'recusado' });
  return { ok: true };
}

async function alterarEscote(usuario, id, percentual) {
  const membro = await buscarVinculo(usuario, id, 'ativo');
  if (membro.perfil === 'recepcao') {
    throw falha(400, 'sem_escote', 'A recepção não recebe escote.');
  }
  if (membro.perfil === 'parceiro') {
    throw falha(400, 'escote_fixo', 'O escote dos barbeiros é fixo em 40%.');
  }
  const anterior = membro.escote_percentual;
  await atualizarVinculo(usuario, id, 'ativo', { escote_percentual: percentual });
  await registrarEscote(usuario, id, anterior, percentual);
  return { ok: true, percentual_anterior: anterior, percentual_novo: percentual };
}

async function removerMembro(usuario, id) {
  const membro = await buscarVinculo(usuario, id, 'ativo');
  if (membro.perfil === 'dono') {
    throw falha(400, 'dono_nao_removivel', 'O dono não pode ser removido da equipe.');
  }
  await atualizarVinculo(usuario, id, 'ativo', { status: 'removido' });
  return { ok: true };
}

// ---------- Serviços ----------

const formatarServico = (s) => ({ id: s.id, nome: s.nome, preco: Number(s.preco), ativo: s.ativo });

async function listarServicos(usuario) {
  if (ehDemo(usuario)) return dados.servicos;
  const { data, error } = await supabase.from('servico').select('id,nome,preco,ativo')
    .eq('estabelecimento_id', usuario.estabelecimento_id)
    .order('nome', { ascending: true });
  conferirBanco(error);
  return data.map(formatarServico);
}

async function criarServico(usuario, { nome, preco }) {
  if (ehDemo(usuario)) {
    const novo = { id: `s${dados.servicos.length + 1}`, nome, preco, ativo: true };
    dados.servicos.push(novo);
    return novo;
  }
  const { data, error } = await supabase.from('servico')
    .insert({ estabelecimento_id: usuario.estabelecimento_id, nome, preco, ativo: true })
    .select('id,nome,preco,ativo')
    .single();
  conferirBanco(error);
  return formatarServico(data);
}

async function editarServico(usuario, id, mudancas) {
  if (ehDemo(usuario)) {
    const servico = dados.servicos.find((s) => s.id === id);
    if (!servico) throw falha(404, 'nao_encontrado', 'Serviço não encontrado.');
    return Object.assign(servico, mudancas);
  }
  const { data, error } = await supabase.from('servico').update(mudancas)
    .eq('id', id)
    .eq('estabelecimento_id', usuario.estabelecimento_id)
    .select('id,nome,preco,ativo')
    .maybeSingle();
  conferirBanco(error);
  if (!data) throw falha(404, 'nao_encontrado', 'Serviço não encontrado.');
  return formatarServico(data);
}

// ---------- Barbearia ----------

const camposBarbearia = 'id,nome,codigo,data_inicio,criado_em,telefone,cidade,hora_abertura,hora_fechamento';

function formatarBarbearia(b) {
  return {
    id: b.id,
    nome: b.nome,
    codigo: b.codigo,
    data_inicio: b.data_inicio,
    criada_em: b.criado_em ?? b.criada_em,
    telefone: b.telefone,
    cidade: b.cidade,
    hora_abertura: String(b.hora_abertura).slice(0, 5),
    hora_fechamento: String(b.hora_fechamento).slice(0, 5),
  };
}

async function obterBarbearia(usuario) {
  if (ehDemo(usuario)) return formatarBarbearia(dados.barbearia);
  const { data, error } = await supabase.from('estabelecimento').select(camposBarbearia)
    .eq('id', usuario.estabelecimento_id)
    .maybeSingle();
  conferirBanco(error);
  if (!data) throw falha(404, 'nao_encontrado', 'Barbearia não encontrada.');
  return formatarBarbearia(data);
}

async function editarBarbearia(usuario, mudancas) {
  const atual = await obterBarbearia(usuario);
  const abertura = mudancas.hora_abertura ?? atual.hora_abertura;
  const fechamento = mudancas.hora_fechamento ?? atual.hora_fechamento;
  if (abertura >= fechamento) {
    throw falha(400, 'horario_invalido', 'O fechamento deve ser depois da abertura.');
  }
  if (ehDemo(usuario)) {
    Object.assign(dados.barbearia, mudancas);
    return formatarBarbearia(dados.barbearia);
  }
  const { data, error } = await supabase.from('estabelecimento').update(mudancas)
    .eq('id', usuario.estabelecimento_id)
    .select(camposBarbearia)
    .single();
  conferirBanco(error);
  return formatarBarbearia(data);
}

async function gerarNovoCodigo(usuario) {
  if (ehDemo(usuario)) {
    dados.barbearia.codigo = gerarCodigo();
    return { codigo: dados.barbearia.codigo };
  }
  // O código é único no banco; em caso raro de repetição, tenta outro.
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const { data, error } = await supabase.from('estabelecimento').update({ codigo: gerarCodigo() })
      .eq('id', usuario.estabelecimento_id)
      .select('codigo')
      .single();
    if (error?.code === '23505') continue;
    conferirBanco(error);
    return { codigo: data.codigo };
  }
  throw falha(500, 'erro_banco', 'Não foi possível gerar um novo código. Tente novamente.');
}

module.exports = {
  responder, responderFalha,
  listarEquipe, aprovarPedido, recusarPedido, alterarEscote, removerMembro,
  listarServicos, criarServico, editarServico,
  obterBarbearia, editarBarbearia, gerarNovoCodigo,
};
