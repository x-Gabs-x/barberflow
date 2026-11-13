const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { idRota, validar, z } = require('../validar-dados');
const parte3 = require('../servicos/parte3');
const notificacoes = require('../servicos/notificacoes');

const router = express.Router();
const parametros = z.object({ id: idRota });
const consulta = z.object({ deslocamento: z.coerce.number().int().min(0).default(0) }).strict();

router.use(exigirPerfil('dono'));

router.get('/', validar(consulta, 'query'), async (req, res) => {
  try {
    return res.json(await notificacoes.listar(req.usuario, req.validado.query.deslocamento));
  } catch (erro) {
    return parte3.responderFalha(res, erro);
  }
});

router.patch('/:id/lida', validar(parametros, 'params'), async (req, res) => {
  try {
    return res.json(await notificacoes.marcarLida(req.usuario, req.params.id));
  } catch (erro) {
    return parte3.responderFalha(res, erro);
  }
});

module.exports = router;
