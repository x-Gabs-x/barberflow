const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const parte5 = require('../servicos/parte5');
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

const { responder } = parte5;

router.get('/', responder((req) => parte5.listarServicos(req.usuario)));
router.post('/', exigirPerfil('dono'), validar(novoServico),
  responder((req) => parte5.criarServico(req.usuario, req.body), 201));
router.patch('/:id', exigirPerfil('dono'), validar(edicaoServico),
  responder((req) => parte5.editarServico(req.usuario, req.params.id, req.body)));

module.exports = router;