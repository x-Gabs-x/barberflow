const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { z, idRota, dataHora, formaPagamento, nsu, validar } = require('../validar-dados');
const parte3 = require('../servicos/parte3');
const demo = require('../servicos/demo-parte3');
const router = express.Router();
const quemAtende = exigirPerfil('parceiro', 'dono');
const quemAnexa = exigirPerfil('parceiro', 'dono', 'recepcao');
const parametroId = z.object({ id: idRota });
const inicio = z.object({ inicio: dataHora.optional() }).strict();
const campos = {
  inicio: dataHora.optional(),
  cliente_id: idRota.nullable().optional(),
  servicos: z.array(idRota).max(20, 'Máximo de 20 serviços').optional(),
  observacoes: z.string().trim().max(500, 'Máximo de 500 caracteres').nullable().optional(),
  forma_pagamento: formaPagamento.nullable().optional(),
  nsu: nsu.nullable().optional(),
};
const edicao = z.object({ ...campos, fim: dataHora.optional() }).strict().refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo');
const encerramento = z.object({ ...campos, fim: dataHora.optional() }).strict();

router.post('/iniciar', quemAtende, validar(inicio), async (req, res) => {
  try {
    const resultado = demo.ativo(req) ? { ...demo.iniciar(req, req.body.inicio), demonstracao: true } : await parte3.iniciar(req.usuario, req.body.inicio);
    return res.status(201).json(resultado);
  } catch (erro) { return parte3.responderFalha(res, erro); }
});
router.get('/:id', quemAtende, validar(parametroId, 'params'), async (req, res) => {
  try {
    const resultado = demo.ativo(req) ? { ...demo.obter(req, req.params.id), demonstracao: true } : await parte3.obterAtendimento(req.params.id, req.usuario);
    return res.json(resultado);
  } catch (erro) { return parte3.responderFalha(res, erro); }
});
router.patch('/:id', quemAtende, validar(parametroId, 'params'), validar(edicao), async (req, res) => {
  try {
    const encerrarViaPatch = !!req.body.fim;
    const resultado = demo.ativo(req) ? demo.salvar(req, req.params.id, req.body, encerrarViaPatch) : await parte3.salvar(req.usuario, req.params.id, req.body, encerrarViaPatch);
    return res.json(resultado);
  } catch (erro) { return parte3.responderFalha(res, erro); }
});
router.post('/:id/encerrar', quemAtende, validar(parametroId, 'params'), validar(encerramento), async (req, res) => {
  try {
    const resultado = demo.ativo(req) ? demo.salvar(req, req.params.id, req.body, true) : await parte3.salvar(req.usuario, req.params.id, req.body, true);
    return res.json(resultado);
  } catch (erro) { return parte3.responderFalha(res, erro); }
});

const receberComprovante = express.raw({ type: ['image/jpeg', 'image/png', 'application/pdf'], limit: '6mb' });
router.post('/:id/comprovante', quemAnexa, validar(parametroId, 'params'), receberComprovante, async (req, res) => {
  try {
    const tipo = req.headers['content-type']?.split(';')[0]?.toLowerCase();
    if (!['image/jpeg','image/png','application/pdf'].includes(tipo) || !Buffer.isBuffer(req.body) || !req.body.length)
      return res.status(400).json({ erro: 'arquivo_invalido', mensagem: 'Envie um JPG, PNG ou PDF de até 6 MB.' });
    const b = req.body;
    const assinaturaValida = tipo === 'image/jpeg' ? b.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))
      : tipo === 'image/png' ? b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : b.subarray(0,5).equals(Buffer.from('%PDF-'));
    if (!assinaturaValida) return res.status(400).json({ erro: 'arquivo_invalido', mensagem: 'O conteúdo não corresponde a um JPG, PNG ou PDF válido.' });
    const a = demo.ativo(req) ? demo.comprovante(req, req.params.id) : await parte3.comprovante(req.usuario, req.params.id, b, tipo);
    return res.status(201).json({ comprovante_url: a.comprovante_url, comprovante_anexado: a.comprovante_anexado });
  } catch (erro) { return parte3.responderFalha(res, erro); }
});
module.exports = router;
