const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { z, data, validar } = require('../validar-dados');
const parte3 = require('../servicos/parte3');
const demo = require('../servicos/demo-parte3');
const supabase = require('../supabase');
const router = express.Router();

const consultaDia = z.object({ data: data.optional() });
router.get('/', exigirPerfil('parceiro', 'dono'), validar(consultaDia, 'query'), async (req, res) => {
  try {
    const dia = req.validado.query.data || parte3.dataLocalAgora();
    if (demo.ativo(req)) {
      return res.json({ data: dia, hora_abertura: '08:00', hora_fechamento: '19:00',
        em_andamento: demo.emAndamento(req),
        atendimentos: demo.listar(dia, req), demonstracao: true });
    }
    const { data: estabelecimento, error } = await supabase.from('estabelecimento')
      .select('hora_abertura,hora_fechamento').eq('id', req.usuario.estabelecimento_id).single();
    parte3.conferirBanco(error);
    const [atendimentos, emAndamento] = await Promise.all([
      parte3.listarDia(req.usuario, dia), parte3.obterEmAndamento(req.usuario),
    ]);
    return res.json({ data: dia, hora_abertura: String(estabelecimento.hora_abertura).slice(0,5),
      hora_fechamento: String(estabelecimento.hora_fechamento).slice(0,5),
      em_andamento: emAndamento,
      atendimentos });
  } catch (erro) { return parte3.responderFalha(res, erro); }
});
module.exports = router;
