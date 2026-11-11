const express = require('express');
const { z, cpf, texto, telefone, validar } = require('../validar-dados');
const supabase = require('../supabase');
const parte3 = require('../servicos/parte3');
const demo = require('../servicos/demo-parte3');
const router = express.Router();
const consulta = z.object({ cpf: cpf.optional(), q: z.string().trim().min(1).max(120).optional() }).strict();
const novoCliente = z.object({ cpf, nome_completo: texto(), telefone: telefone.optional() }).strict();

router.get('/', validar(consulta, 'query'), async (req, res) => {
  try {
    const { cpf: filtro, q } = req.validado.query;
    if (demo.ativo(req)) return res.json(demo.listarClientes(q || filtro));
    if (q) {
      const digitos = q.replace(/\D/g, '');
      const buscaNome = q.replace(/[\\%_]/g, '\\$&');
      const consultas = [
        supabase.from('cliente').select('id,cpf,nome_completo,telefone')
          .eq('estabelecimento_id', req.usuario.estabelecimento_id)
          .ilike('nome_completo', `%${buscaNome}%`).order('nome_completo').limit(50),
      ];
      if (digitos.length && digitos.length <= 11) {
        consultas.push(supabase.from('cliente').select('id,cpf,nome_completo,telefone')
          .eq('estabelecimento_id', req.usuario.estabelecimento_id)
          .ilike('cpf', `%${digitos}%`).order('nome_completo').limit(50));
      }
      const resultados = await Promise.all(consultas);
      resultados.forEach(({ error }) => parte3.conferirBanco(error));
      const unicos = new Map();
      resultados.forEach(({ data }) => (data || []).forEach((cliente) => unicos.set(cliente.id, cliente)));
      return res.json([...unicos.values()].sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR')).slice(0, 50));
    }
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
