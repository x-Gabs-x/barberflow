const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { atendimento } = require('../dados-teste');
const router = express.Router();

router.get('/', exigirPerfil('parceiro', 'dono'), (req, res) => {
  res.json({
    data: req.query.data || new Date().toISOString().slice(0, 10),
    hora_abertura: '08:00',
    hora_fechamento: '19:00',
    em_andamento: null,
    atendimentos: [atendimento],
  });
});

module.exports = router;