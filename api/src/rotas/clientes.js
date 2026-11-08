const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json([{ id: 'c3', cpf: req.query.cpf || '00000000000', nome_completo: 'Renato Barros', telefone: '83900000000' }]);
});

router.post('/', (req, res) => {
  res.status(201).json({ id: 'c9', ...req.body });
});

module.exports = router;