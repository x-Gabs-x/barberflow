const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const router = express.Router();

router.use(exigirPerfil('dono'));

router.get('/', (req, res) => {
  res.json({
    data: req.query.data || new Date().toISOString().slice(0, 10),
    status: 'aberto',
    total: 350.0,
    por_barbeiro: [{ nome_completo: 'Rafael Souza', total: 145.0, valor_barbeiro: 87.0, valor_barbearia: 58.0 }],
    por_forma_pagamento: { pix: 110.0, dinheiro: 135.0, cartao: 105.0 },
  });
});

router.post('/confirmar', (req, res) => res.json({ ok: true, status: 'confirmado' }));
router.post('/devolver', (req, res) => res.json({ ok: true, status: 'aberto' }));

module.exports = router;