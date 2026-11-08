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

const formaPagamento = z.enum(['dinheiro', 'pix', 'cartao']);

function validar(schema) {
  return (req, res, next) => {
    const resultado = schema.safeParse(req.body);
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
    req.body = resultado.data;
    next();
  };
}

module.exports = { z, cpf, texto, telefone, percentual, formaPagamento, validar, cpfValido };