const express = require('express');
const { z, cpf, texto, telefone, validar } = require('../validar-dados');
const router = express.Router();

const novoCliente = z
  .object({
    cpf,
    nome_completo: texto(),
    telefone: telefone.optional(),
  })
  .strict();

router.get('/', (req, res) => {
  res.json([{ id: 'c3', cpf: req.query.cpf || '00000000000', nome_completo: 'Renato Barros', telefone: '83900000000' }]);
});

router.post('/', validar(novoCliente), (req, res) => {
  res.status(201).json({ id: 'c9', ...req.body });
});

module.exports = router;