const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { data, texto, validar, z } = require('../validar-dados');
const parte3 = require('../servicos/parte3');
const fechamento = require('../servicos/fechamento');

const router = express.Router();
const consultaDia = z.object({ data: data.optional() });
const confirmacao = z.object({ data }).strict();
const devolucao = z.object({ data, justificativa: texto(300) }).strict();

router.use(exigirPerfil('dono'));

router.get('/', validar(consultaDia, 'query'), async (req, res) => {
  try {
    const dia = req.validado.query.data || parte3.dataLocalAgora();
    return res.json(await fechamento.resumo(req.usuario, dia));
  } catch (erro) {
    return parte3.responderFalha(res, erro);
  }
});

router.post('/confirmar', validar(confirmacao), async (req, res) => {
  try {
    return res.json(await fechamento.confirmar(req.usuario, req.body.data));
  } catch (erro) {
    return parte3.responderFalha(res, erro);
  }
});

router.post('/devolver', validar(devolucao), async (req, res) => {
  try {
    return res.json(await fechamento.devolver(req.usuario, req.body.data, req.body.justificativa));
  } catch (erro) {
    return parte3.responderFalha(res, erro);
  }
});

module.exports = router;
