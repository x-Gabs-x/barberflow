const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { servicos } = require('../dados-teste');
const { z, texto, preco, validar } = require('../validar-dados');
const router = express.Router();

const novoServico = z.object({ nome: texto(80), preco }).strict();

const edicaoServico = z
  .object({
    nome: texto(80).optional(),
    preco: preco.optional(),
    ativo: z.boolean().optional(),
  })
  .strict()
  .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo');

router.get('/', (req, res) => res.json(servicos));
router.post('/', exigirPerfil('dono'), validar(novoServico), (req, res) =>
  res.status(201).json({ id: 's9', ativo: true, ...req.body })
);
router.patch('/:id', exigirPerfil('dono'), validar(edicaoServico), (req, res) =>
  res.json({ id: req.params.id, ...req.body })
);

module.exports = router;