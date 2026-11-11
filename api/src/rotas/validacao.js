const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { z, data, idRota, texto, formaPagamento, nsu, validar } = require('../validar-dados');
const parte3 = require('../servicos/parte3');
const validacao = require('../servicos/validacao');
const router = express.Router();
const parametroId = z.object({ id: idRota });
const status = z.enum(['em_andamento', 'registrado', 'validado_recepcao', 'validado_dono', 'rejeitado']);
const consulta = z.object({ data: data.optional(), barbeiro: idRota.optional(), status: status.optional() });
const rejeicao = z.object({ justificativa: texto(300) }).strict();
const correcao = z.object({
  observacoes: z.string().trim().max(500).nullable().optional(),
  forma_pagamento: formaPagamento.optional(),
  nsu: nsu.nullable().optional(),
}).strict().refine((d) => Object.keys(d).length > 0, 'Informe ao menos um campo');
router.get('/', exigirPerfil('recepcao', 'dono'), validar(consulta, 'query'), async (req, res) => {
  try { return res.json(await validacao.lista(req.usuario, req.validado.query)); }
  catch (e) { return parte3.responderFalha(res, e); }
});
router.post('/:id/validar', exigirPerfil('recepcao'), validar(parametroId, 'params'), async (req, res) => {
  try { return res.json(await validacao.executar(req.usuario, req.params.id, 'validar')); }
  catch (e) { return parte3.responderFalha(res, e); }
});
router.post('/:id/rejeitar', exigirPerfil('recepcao', 'dono'), validar(parametroId, 'params'), validar(rejeicao), async (req, res) => {
  try { return res.json(await validacao.executar(req.usuario, req.params.id, 'rejeitar', req.body)); }
  catch (e) { return parte3.responderFalha(res, e); }
});
router.patch('/:id/corrigir', exigirPerfil('recepcao'), validar(parametroId, 'params'), validar(correcao), async (req, res) => {
  try { return res.json(await validacao.executar(req.usuario, req.params.id, 'corrigir', req.body)); }
  catch (e) { return parte3.responderFalha(res, e); }
});
module.exports = router;
