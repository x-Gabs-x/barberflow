const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { atendimento } = require('../dados-teste');
const router = express.Router();

const quemAtende = exigirPerfil('parceiro', 'dono');

router.post('/iniciar', quemAtende, (req, res) => {
  res.status(201).json({ ...atendimento, fim: null, status: 'em_andamento' });
});

router.patch('/:id', quemAtende, (req, res) => {
  res.json({ ...atendimento, id: req.params.id });
});

router.post('/:id/encerrar', quemAtende, (req, res) => {
  res.json({ ...atendimento, id: req.params.id, status: 'registrado' });
});

router.post('/:id/comprovante', quemAtende, (req, res) => {
  res.status(201).json({ comprovante_url: 'https://exemplo.com/comprovante.jpg' });
});

module.exports = router;