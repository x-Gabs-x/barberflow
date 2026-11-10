const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const parte5 = require('../servicos/parte5');
const router = express.Router();
const { z, percentual, validar } = require('../validar-dados');
const aprovacao = z.object({ escote_percentual: percentual.nullable() }).strict();

const novoEscote = z.object({ percentual }).strict();

router.use(exigirPerfil('dono'));

const { responder } = parte5;

router.get('/', responder((req) => parte5.listarEquipe(req.usuario, 'ativo')));
router.get('/pedidos', responder((req) => parte5.listarEquipe(req.usuario, 'aguardando')));
router.post('/pedidos/:id/aprovar', validar(aprovacao), responder((req) =>
  parte5.aprovarPedido(req.usuario, req.params.id, req.body.escote_percentual)));
router.post('/pedidos/:id/recusar', responder((req) => parte5.recusarPedido(req.usuario, req.params.id)));
router.patch('/:id/escote', validar(novoEscote), responder((req) =>
  parte5.alterarEscote(req.usuario, req.params.id, req.body.percentual)));
router.delete('/:id', responder((req) => parte5.removerMembro(req.usuario, req.params.id)));

module.exports = router;