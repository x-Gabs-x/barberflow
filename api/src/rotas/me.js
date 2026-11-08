const express = require('express');
const { z, telefone, texto, validar } = require('../validar-dados');
const router = express.Router();

const edicaoPerfil = z
  .object({
    telefone: telefone.optional(),
    foto_url: texto(500).optional(),
  })
  .strict()
  .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo');

router.get('/', (req, res) => {
  res.json({
    id: req.usuario.id,
    nome_completo: 'Dono de Teste',
    cpf: '52998224725',
    email: 'dono@teste.com',
    telefone: '83900000000',
    foto_url: null,
    perfil: req.usuario.perfil,
  });
});

router.patch('/', validar(edicaoPerfil), (req, res) => {
  res.json({ ok: true, ...req.body });
});

module.exports = router;