const { servicos } = require('../dados-teste');
const { falha, dataLocalAgora } = require('./parte3');
const { validarSelecao } = require('./combinacoes');
const clientes = [{ id: 'c3', cpf: '52998224725', nome_completo: 'Renato Barros', telefone: '83900000000' }];
const atendimentos = [];
let seq = 0;
function ativo(req) { return req.usuario.id === 'usuario-de-teste'; }
function clonar(obj) { return JSON.parse(JSON.stringify(obj)); }
function identificador(req) {
  return `${req.usuario.id}:${req.usuario.perfil}`;
}
function obter(id, req) {
  const a = atendimentos.find((item) => item.id === id);
  if (!a || (req && req.usuario.perfil !== 'dono' && a.barbeiro.id !== identificador(req)))
    throw falha(404, 'nao_encontrado', 'Atendimento não encontrado.');
  return a;
}
function listar(dia = dataLocalAgora(), req) {
  return clonar(atendimentos.filter((a) => {
    if (req?.usuario.perfil === 'parceiro' && a.barbeiro.id !== identificador(req)) return false;
    const dataDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(a.inicio));
    return dataDia === dia;
  }).sort((a, b) => a.inicio.localeCompare(b.inicio)));
}
function iniciar(req, inicio) {
  if (atendimentos.some((a) => a.status === 'em_andamento' && a.barbeiro.id === identificador(req)))
    throw falha(409, 'atendimento_sobreposto', 'Já existe um atendimento em andamento.');
  const a = { id: `demo-${++seq}`, barbeiro: { id: identificador(req), nome_completo: req.usuario.perfil === 'dono' ? 'Dono de Teste' : 'Parceiro de Teste' },
    cliente: null, inicio: inicio || new Date().toISOString(), fim: null, servicos: [], valor_total: 0,
    observacoes: '', forma_pagamento: null, nsu: null, comprovante_url: null, comprovante_anexado: false,
    escote_percentual: null, valor_barbeiro: 0, valor_barbearia: 0, status: 'em_andamento' };
  atendimentos.push(a);
  return clonar(a);
}
function salvar(req, id, body, encerrar = false) {
  const a = obter(id, req);
  if (a.barbeiro.id !== identificador(req)) throw falha(403, 'sem_permissao', 'Atendimento pertence a outro profissional.');
  if (a.status !== 'em_andamento') throw falha(409, 'atendimento_fechado', 'Atendimento já encerrado.');
  if (body.cliente_id !== undefined) {
    const cliente = body.cliente_id === null ? null : clientes.find((c) => c.id === body.cliente_id);
    if (body.cliente_id !== null && !cliente) throw falha(400, 'cliente_invalido', 'Cliente não encontrado.');
    a.cliente = cliente ? clonar(cliente) : null;
  }
  if (body.servicos !== undefined) {
    const ids = [...new Set(body.servicos)];
    if (ids.length !== body.servicos.length || ids.some((id) => !servicos.some((s) => s.id === id && s.ativo)))
      throw falha(400, 'servicos_invalidos', 'Selecione serviços ativos, sem repetir.');
    const lista = ids.map((id) => { const s = servicos.find((x) => x.id === id); return { id, nome: s.nome, preco: s.preco }; });
    if (!validarSelecao(lista)) throw falha(400, 'servicos_sobrepostos', 'O combo já inclui um dos serviços selecionados.');
    a.servicos = lista;
    a.valor_total = Math.round(a.servicos.reduce((n, s) => n + s.preco * 100, 0)) / 100;
  }
  for (const campo of ['observacoes', 'forma_pagamento', 'nsu', 'inicio']) {
    if (body[campo] !== undefined) a[campo] = body[campo];
  }
  if (encerrar) {
    if (!a.cliente) throw falha(400, 'cliente_obrigatorio', 'Informe o cliente.');
    if (!a.servicos.length) throw falha(400, 'servicos_obrigatorios', 'Selecione os serviços.');
    if (!a.forma_pagamento) throw falha(400, 'pagamento_obrigatorio', 'Informe a forma de pagamento.');
    const fim = body.fim || new Date().toISOString();
    if (Date.parse(fim) <= Date.parse(a.inicio)) throw falha(400, 'fim_invalido', 'O fim deve ser posterior ao início.');
    a.fim = fim;
    a.status = 'registrado';
    a.escote_percentual = req.usuario.perfil === 'dono' ? 70 : 60;
    a.valor_barbeiro = Math.round(a.valor_total * a.escote_percentual) / 100;
    a.valor_barbearia = Math.round((a.valor_total - a.valor_barbeiro) * 100) / 100;
  }
  return clonar(a);
}
function comprovante(req, id) {
  const eRecepcao = req.usuario.perfil === 'recepcao';
  const a = obter(id, eRecepcao ? undefined : req);
  if (!eRecepcao && a.barbeiro.id !== identificador(req))
    throw falha(403, 'sem_permissao', 'Atendimento pertence a outro profissional.');
  if (eRecepcao && a.status !== 'registrado')
    throw falha(409, 'atendimento_fechado', 'A recepção só pode anexar comprovantes em atendimentos pendentes de validação.');
  if (!eRecepcao && !['em_andamento', 'registrado'].includes(a.status))
    throw falha(409, 'atendimento_fechado', 'Atendimento já validado.');
  a.comprovante_anexado = true;
  return clonar(a);
}
function listarClientes(cpf) { return clonar(clientes.filter((c) => !cpf || c.cpf === cpf)); }
function cadastrarCliente(dados) {
  if (clientes.some((c) => c.cpf === dados.cpf)) throw falha(409, 'cliente_existente', 'Este CPF já está cadastrado.');
  const c = { id: `demo-cliente-${++seq}`, ...dados };
  clientes.push(c);
  return clonar(c);
}
function recepcaoEditar(req, id, acao, dados) {
  if (!['recepcao', 'dono'].includes(req.usuario.perfil)) throw falha(403, 'sem_permissao', 'Perfil sem permissão.');
  const a = obter(id);
  if (acao === 'validar') {
    if (req.usuario.perfil !== 'recepcao') throw falha(403, 'sem_permissao', 'Somente a recepção valida.');
    if (a.status !== 'registrado') throw falha(409, 'status_invalido', 'Atendimento indisponível para validação.');
    if (!a.comprovante_anexado) throw falha(409, 'comprovante_obrigatorio', 'Anexe um comprovante antes da validação.');
    a.status = 'validado_recepcao';
  } else if (acao === 'corrigir') {
    if (req.usuario.perfil !== 'recepcao') throw falha(403, 'sem_permissao', 'Somente a recepção corrige.');
    if (a.status !== 'registrado') throw falha(409, 'status_invalido', 'Atendimento indisponível para correção.');
    for (const campo of ['observacoes', 'forma_pagamento', 'nsu']) {
      if (Object.hasOwn(dados, campo)) a[campo] = dados[campo];
    }
  } else if (acao === 'rejeitar') {
    if (a.status !== 'registrado' && !(req.usuario.perfil === 'dono' && a.status === 'validado_recepcao'))
      throw falha(409, 'status_invalido', 'Atendimento indisponível para rejeição.');
    if (!dados.justificativa?.trim()) throw falha(400, 'justificativa_obrigatoria', 'Informe a justificativa.');
    a.status = 'rejeitado';
    a.justificativa_rejeicao = dados.justificativa.trim();
  }
  return clonar(a);
}
module.exports = { recepcaoEditar, ativo, listar, emAndamento: (req) => clonar(atendimentos.find((a) => a.status === 'em_andamento' && (!req || a.barbeiro.id === identificador(req))) || null), iniciar, salvar, obter: (req, id) => clonar(obter(id, req)), comprovante, listarClientes, cadastrarCliente };
