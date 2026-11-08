const express = require('express');
const { exigirPerfil } = require('../middlewares/autenticar');
const { barbearia } = require('../dados-teste');
const { z, texto, telefone, hora, validar } = require('../validar-dados');
const router = express.Router();

const vazioViraNulo = (valor) => (valor === '' ? null : valor);

const edicaoBarbearia = z
  .object({
    nome: texto(80).optional(),
    telefone: z.preprocess(vazioViraNulo, telefone.nullable().optional()),
    cidade: z.preprocess(vazioViraNulo, texto(80).nullable().optional()),
    hora_abertura: hora.optional(),
    hora_fechamento: hora.optional(),
  })
  .strict()
  .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo')
  .refine(
    (dados) =>
      !(dados.hora_abertura && dados.hora_fechamento) ||
      dados.hora_abertura < dados.hora_fechamento,
    { message: 'O fechamento deve ser depois da abertura', path: ['hora_fechamento'] }
  );

router.use(exigirPerfil('dono'));

router.get('/', (req, res) => res.json(barbearia));
router.patch('/', validar(edicaoBarbearia), (req, res) => res.json({ ...barbearia, ...req.body }));
router.post('/novo-id', (req, res) => res.json({ codigo: 'BRB-NOVO-0000' }));

module.exports = router;