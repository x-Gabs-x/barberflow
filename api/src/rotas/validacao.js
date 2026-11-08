const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { atendimento } = require('../dados-teste');
const router = express.Router();

router.get('/', exigirPerfil('recepcao', 'dono'), (req, res) => {
  res.json([atendimento]);
});

router.post('/:id/validar', exigirPerfil('recepcao'), (req, res) => {
  res.json({ ...atendimento, id: req.params.id, status: 'validado_recepcao' });
});

router.post('/:id/rejeitar', exigirPerfil('recepcao', 'dono'), (req, res) => {
  res.json({ ...atendimento, id: req.params.id, status: 'rejeitado', justificativa_rejeicao: req.body.justificativa });
});

router.patch('/:id/corrigir', exigirPerfil('recepcao'), (req, res) => {
  res.json({ ...atendimento, id: req.params.id, ...req.body });
});

module.exports = router;