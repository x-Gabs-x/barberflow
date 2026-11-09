const demo = require('./demo-parte3');
const { falha } = require('./parte3');
const { dataLocalAgora } = require('./parte3');
function listar(req, query = {}) {
  return demo.listar(query.data || dataLocalAgora(), req)
    .filter((a) => !query.status || a.status === query.status)
    .filter((a) => !query.barbeiro || a.barbeiro.id === query.barbeiro)
    .map((a) => ({ ...a, demonstracao: true }));
}
function atualizar(req, id, acao, dados = {}) {
  const a = demo.recepcaoEditar(req, id, acao, dados);
  return { ...a, demonstracao: true };
}
module.exports = { listar, atualizar };
