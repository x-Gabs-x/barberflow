const { z } = require('zod');

function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (base.length + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return (
    digito(cpf.slice(0, 9)) === Number(cpf[9]) &&
    digito(cpf.slice(0, 10)) === Number(cpf[10])
  );
}

const cpf = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine(cpfValido, 'CPF inválido');

const texto = (max = 120) =>
  z.string().trim().min(1, 'Campo obrigatório').max(max, `Máximo de ${max} caracteres`);

const telefone = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 10 || v.length === 11, 'Telefone inválido');

const percentual = z.number().min(0, 'Mínimo 0').max(100, 'Máximo 100');

const preco = z
  .number()
  .min(0, 'Preço não pode ser negativo')
  .max(10000, 'Preço acima do limite')
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
    'Use no máximo 2 casas decimais'
  );

const formaPagamento = z.enum(['dinheiro', 'pix', 'cartao']);

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'E-mail muito longo')
  .email('E-mail inválido');

const senha = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'Use ao menos uma letra')
  .regex(/\d/, 'Use ao menos um número');

const codigo6 = z.string().regex(/^\d{6}$/, 'O código tem 6 números');

const aceiteTermos = z
  .boolean()
  .refine((v) => v === true, 'É preciso aceitar os termos e o aviso de privacidade');

const perfil = z.enum(['dono', 'parceiro', 'recepcao']);
const perfilEquipe = z.enum(['parceiro', 'recepcao']);

const idBarbearia = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^BRB-[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'ID da barbearia inválido');

const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')
  .refine((v) => {
    const d = new Date(v);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Data inválida');

const hora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Use o formato HH:MM')
  .transform((v) => v.slice(0, 5));

const idRota = z.string().regex(/^[\w-]{1,64}$/, 'Identificador inválido');

function validar(schema, onde = 'body') {
  return (req, res, next) => {
    const resultado = schema.safeParse(req[onde]);
    if (!resultado.success) {
      return res.status(400).json({
        erro: 'dados_invalidos',
        mensagem: 'Confira os campos informados.',
        campos: resultado.error.issues.map((i) => ({
          campo: i.path.join('.'),
          mensagem: i.message,
        })),
      });
    }
    if (onde === 'body') {
      req.body = resultado.data;
    } else {
      req.validado = { ...req.validado, [onde]: resultado.data };
    }
    next();
  };
}

const dataHora = z.iso.datetime({
  offset: true,
  error: 'Use data e hora com fuso, ex.: 2026-11-08T14:35:00-03:00',
});

const nsu = z.string().trim().regex(/^[A-Za-z0-9]{1,30}$/, 'NSU inválido');

module.exports = {
  z, cpf, texto, telefone, percentual, preco, formaPagamento,
  email, senha, codigo6, aceiteTermos, perfil, perfilEquipe, idBarbearia,
  data, hora, idRota, dataHora, nsu,
  validar, cpfValido,
};