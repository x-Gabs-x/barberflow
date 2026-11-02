const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { barbearia } = require('../dados-teste');
const router = express.Router();

router.use(exigirPerfil('dono'));

router.get('/', (req, res) => res.json(barbearia));
router.patch('/', (req, res) => res.json({ ...barbearia, ...req.body }));
router.post('/novo-id', (req, res) => res.json({ codigo: 'BRB-NOVO-0000' }));

module.exports = router;