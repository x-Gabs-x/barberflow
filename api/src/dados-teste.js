const atendimento = {
  id: 'a1',
  barbeiro: { id: 'u7', nome_completo: 'Rafael Souza' },
  cliente: { id: 'c3', nome_completo: 'Renato Barros' },
  inicio: '2026-10-22T14:35:00-03:00',
  fim: '2026-10-22T15:10:00-03:00',
  servicos: [{ id: 's2', nome: 'Barba', preco: 30.0 }],
  valor_total: 30.0,
  observacoes: 'Barba na navalha',
  forma_pagamento: 'pix',
  comprovante_url: 'https://exemplo.com/comprovante.jpg',
  escote_percentual: 40,
  valor_barbeiro: 12.0,
  valor_barbearia: 18.0,
  status: 'registrado',
};

const equipe = [
  { id: 'v1', usuario: { id: 'u1', nome_completo: 'Dono de Teste' }, perfil: 'dono', escote_percentual: 70, status: 'ativo' },
  { id: 'v2', usuario: { id: 'u7', nome_completo: 'Rafael Souza' }, perfil: 'parceiro', escote_percentual: 40, status: 'ativo' },
  { id: 'v3', usuario: { id: 'u8', nome_completo: 'Diego Lima' }, perfil: 'parceiro', escote_percentual: 40, status: 'aguardando' },
];

const servicos = [
  { id: 's1', nome: 'Corte', preco: 30.0, ativo: true },
  { id: 's2', nome: 'Barba', preco: 20.0, ativo: true },
  { id: 's3', nome: 'Corte + barba', preco: 40.0, ativo: true },
];

const barbearia = {
  id: 'b1',
  nome: '[Nome da barbearia]',
  codigo: 'BRB-7K4Q-92XM',
  data_inicio: '2019-03-03',
  criada_em: '2026-10-22T19:40:00-03:00',
  telefone: null,
  cidade: null,
  hora_abertura: '08:00',
  hora_fechamento: '19:00',
};

module.exports = { atendimento, equipe, servicos, barbearia };