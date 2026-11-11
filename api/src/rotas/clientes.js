const express = require('express');
const { z, cpf, texto, telefone, validar } = require('../validar-dados');
const supabase = require('../supabase');
const parte3 = require('../servicos/parte3');
const demo = require('../servicos/demo-parte3');
const router = express.Router();
const consulta = z.object({ cpf: cpf.optional() }).strict();
const novoCliente = z.object({ cpf, nome_completo: texto(), telefone: telefone.optional() }).strict();

router.get('/', validar(consulta, 'query'), async (req, res) => {
  try {
    const { cpf: filtro } = req.validado.query;
    if (demo.ativo(req)) return res.json(demo.listarClientes(filtro));
    let busca = supabase.from('cliente').select('id,cpf,nome_completo,telefone')
      .eq('estabelecimento_id', req.usuario.estabelecimento_id).order('nome_completo').limit(50);
    if (filtro) busca = busca.eq('cpf', filtro);
    const { data, error } = await busca;
    parte3.conferirBanco(error);
    return res.json(data);
  } catch (erro) { return parte3.responderFalha(res, erro); }
});
router.post('/', validar(novoCliente), async (req, res) => {
  try {
    if (demo.ativo(req)) return res.status(201).json(demo.cadastrarCliente(req.body));
    const { data, error } = await supabase.from('cliente').insert({ ...req.body, estabelecimento_id: req.usuario.estabelecimento_id })
      .select('id,cpf,nome_completo,telefone').single();
    if (error?.code === '23505') {
      return res.status(409).json({ erro: 'cliente_existente', mensagem: 'CPF já cadastrado nesta barbearia.' });
    }
    parte3.conferirBanco(error);
    return res.status(201).json(data);
  } catch (erro) { return parte3.responderFalha(res, erro); }
});
module.exports = router;
