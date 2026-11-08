const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { z, data, texto, validar } = require('../validar-dados');
const router = express.Router();

const consultaDia = z.object({ data: data.optional() });
const confirmacao = z.object({ data }).strict();
const devolucao = z.object({ data, justificativa: texto(300) }).strict();

router.use(exigirPerfil('dono'));

router.get('/', validar(consultaDia, 'query'), (req, res) => {
  res.json({
    data: req.validado.query.data || new Date().toISOString().slice(0, 10),
    status: 'aberto',
    total: 350.0,
    por_barbeiro: [{ nome_completo: 'Rafael Souza', total: 145.0, valor_barbeiro: 87.0, valor_barbearia: 58.0 }],
    por_forma_pagamento: { pix: 110.0, dinheiro: 135.0, cartao: 105.0 },
  });
});

router.post('/confirmar', validar(confirmacao), (req, res) => res.json({ ok: true, status: 'confirmado' }));
router.post('/devolver', validar(devolucao), (req, res) => res.json({ ok: true, status: 'aberto' }));

module.exports = router;