const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { atendimento } = require('../dados-teste');
const { z, data, validar } = require('../validar-dados');
const router = express.Router();

const consultaDia = z.object({ data: data.optional() });

router.get('/', exigirPerfil('parceiro', 'dono'), validar(consultaDia, 'query'), (req, res) => {
  res.json({
    data: req.validado.query.data || new Date().toISOString().slice(0, 10),
    hora_abertura: '08:00',
    hora_fechamento: '19:00',
    em_andamento: null,
    atendimentos: [atendimento],
  });
});

module.exports = router;