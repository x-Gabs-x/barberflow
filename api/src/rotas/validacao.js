const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { atendimento } = require('../dados-teste');
const { z, data, idRota, texto, formaPagamento, nsu, validar } = require('../validar-dados');
const router = express.Router();

const parametroId = z.object({ id: idRota });

const statusAtendimento = z.enum([
  'em_andamento',
  'registrado',
  'validado_recepcao',
  'validado_dono',
  'rejeitado',
]);

const consultaLista = z.object({
  data: data.optional(),
  barbeiro: idRota.optional(),
  status: statusAtendimento.optional(),
});

const rejeicao = z.object({ justificativa: texto(300) }).strict();

const correcao = z
  .object({
    observacoes: z.string().trim().max(500, 'Máximo de 500 caracteres').optional(),
    forma_pagamento: formaPagamento.optional(),
    nsu: nsu.optional(),
  })
  .strict()
  .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo');

router.get('/', exigirPerfil('recepcao', 'dono'), validar(consultaLista, 'query'), (req, res) => {
  res.json([atendimento]);
});

router.post('/:id/validar', exigirPerfil('recepcao'), validar(parametroId, 'params'), (req, res) => {
  res.json({ ...atendimento, id: req.params.id, status: 'validado_recepcao' });
});

router.post('/:id/rejeitar', exigirPerfil('recepcao', 'dono'), validar(parametroId, 'params'), validar(rejeicao), (req, res) => {
  res.json({ ...atendimento, id: req.params.id, status: 'rejeitado', justificativa_rejeicao: req.body.justificativa });
});

router.patch('/:id/corrigir', exigirPerfil('recepcao'), validar(parametroId, 'params'), validar(correcao), (req, res) => {
  res.json({ ...atendimento, id: req.params.id, ...req.body });
});

module.exports = router;