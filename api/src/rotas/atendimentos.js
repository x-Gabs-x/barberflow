const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { atendimento } = require('../dados-teste');
const { z, idRota, dataHora, formaPagamento, nsu, validar } = require('../validar-dados');
const router = express.Router();

const quemAtende = exigirPerfil('parceiro', 'dono');

const parametroId = z.object({ id: idRota });

const camposAtendimento = {
  inicio: dataHora.optional(),
  fim: dataHora.optional(),
  cliente_id: idRota.optional(),
  servicos: z.array(idRota).max(20, 'Máximo de 20 serviços').optional(),
  observacoes: z.string().trim().max(500, 'Máximo de 500 caracteres').optional(),
  forma_pagamento: formaPagamento.optional(),
  nsu: nsu.optional(),
};

const fimDepoisDoInicio = (dados) =>
  !(dados.inicio && dados.fim) || Date.parse(dados.fim) > Date.parse(dados.inicio);

const erroFim = { message: 'O fim deve ser depois do início', path: ['fim'] };

const edicaoAtendimento = z
  .object(camposAtendimento)
  .strict()
  .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo')
  .refine(fimDepoisDoInicio, erroFim);

const encerramento = z
  .object(camposAtendimento)
  .strict()
  .refine(fimDepoisDoInicio, erroFim);

router.post('/iniciar', quemAtende, (req, res) => {
  res.status(201).json({ ...atendimento, fim: null, status: 'em_andamento' });
});

router.patch('/:id', quemAtende, validar(parametroId, 'params'), validar(edicaoAtendimento), (req, res) => {
  res.json({ ...atendimento, id: req.params.id });
});

router.post('/:id/encerrar', quemAtende, validar(parametroId, 'params'), validar(encerramento), (req, res) => {
  res.json({ ...atendimento, id: req.params.id, status: 'registrado' });
});

router.post('/:id/comprovante', quemAtende, validar(parametroId, 'params'), (req, res) => {
  res.status(201).json({ comprovante_url: 'https://exemplo.com/comprovante.jpg' });
});

module.exports = router;