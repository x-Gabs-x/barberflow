const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  res.json({
    token: 'token-de-teste',
    usuario: { id: 'u1', nome_completo: 'Dono de Teste', perfil: 'dono' },
    barbearias: [{ id: 'b1', nome: '[Nome da barbearia]' }],
  });
});

router.post('/cadastro/dono', (req, res) => {
  res.status(201).json({ ok: true, mensagem: 'Código enviado por e-mail.' });
});

router.post('/cadastro/equipe', (req, res) => {
  res.status(201).json({ ok: true, status: 'aguardando', mensagem: 'Pedido enviado ao dono.' });
});

router.post('/verificar-email', (req, res) => res.json({ ok: true }));
router.post('/reenviar-codigo', (req, res) => res.json({ ok: true }));
router.post('/esqueci-senha', (req, res) => res.json({ ok: true }));
router.post('/redefinir-senha', (req, res) => res.json({ ok: true }));

module.exports = router;