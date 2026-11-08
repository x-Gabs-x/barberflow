const express = require('express');
const supabase = require('../supabase');
const { criarCadastroDono } = require('../servicos/cadastrar-dono');
const { criarAutenticarLogin } = require('../servicos/autenticar-login');
const { criarCadastrarEquipe } = require('../servicos/cadastrar-equipe');
const {
  z, cpf, texto, telefone, email, senha,
  aceiteTermos, perfilEquipe, idBarbearia, data, validar,
} = require('../validar-dados');
const router = express.Router();

const dadosLogin = z
  .object({
    cpf,
    senha: z.string().min(1, 'Informe a senha').max(72, 'Senha muito longa'),
  })
  .strict();

const dadosCadastroDono = z
  .object({
    nome_completo: texto(),
    cpf,
    email,
    telefone,
    senha,
    aceite_termos: aceiteTermos,
    barbearia: z
      .object({
        nome: texto(80),
        data_inicio: data,
        telefone: telefone.optional(),
        cidade: texto(80).optional(),
      })
      .strict(),
  })
  .strict();

const dadosCadastroEquipe = z
  .object({
    id_barbearia: idBarbearia,
    perfil: perfilEquipe,
    nome_completo: texto(),
    cpf,
    email,
    telefone,
    senha,
    aceite_termos: aceiteTermos,
  })
  .strict();

router.post('/login', validar(dadosLogin), criarAutenticarLogin(supabase));

router.post('/cadastro/dono', validar(dadosCadastroDono), criarCadastroDono(supabase));

router.post('/cadastro/equipe', validar(dadosCadastroEquipe), criarCadastrarEquipe(supabase));

router.post('/verificar-email', (req, res) => res.json({ ok: true }));
router.post('/reenviar-codigo', (req, res) => res.json({ ok: true }));
router.post('/esqueci-senha', (req, res) => res.json({ ok: true }));
router.post('/redefinir-senha', (req, res) => res.json({ ok: true }));

module.exports = router;
