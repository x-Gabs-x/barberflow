const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { equipe } = require('../dados-teste');
const router = express.Router();

router.use(exigirPerfil('dono'));

router.get('/', (req, res) => res.json(equipe.filter((m) => m.status === 'ativo')));
router.get('/pedidos', (req, res) => res.json(equipe.filter((m) => m.status === 'aguardando')));
router.post('/pedidos/:id/aprovar', (req, res) => res.json({ ok: true, escote_percentual: req.body.escote_percentual }));
router.post('/pedidos/:id/recusar', (req, res) => res.json({ ok: true }));
router.patch('/:id/escote', (req, res) => res.json({ ok: true, percentual_novo: req.body.percentual }));
router.delete('/:id', (req, res) => res.json({ ok: true }));

module.exports = router;