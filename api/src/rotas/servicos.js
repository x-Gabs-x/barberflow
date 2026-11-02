const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { servicos } = require('../dados-teste');
const router = express.Router();

router.get('/', (req, res) => res.json(servicos));
router.post('/', exigirPerfil('dono'), (req, res) => res.status(201).json({ id: 's9', ativo: true, ...req.body }));
router.patch('/:id', exigirPerfil('dono'), (req, res) => res.json({ id: req.params.id, ...req.body }));

module.exports = router;