require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./supabase');
const { autenticar } = require('./middlewares/autenticar');

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGEM ? process.env.CORS_ORIGEM.split(',') : true }));
app.use(express.json({ limit: '100kb' }));

app.get('/saude', async (req, res) => {
  const { error } = await supabase
    .from('estabelecimento')
    .select('id', { head: true, count: 'exact' });

  if (error) {
    console.error(error);
    return res.status(500).json({ erro: 'banco', mensagem: 'Não foi possível falar com o banco.' });
  }
  res.json({ ok: true, banco: 'conectado' });
});

app.use('/auth', require('./rotas/auth'));

app.use('/me', autenticar, require('./rotas/me'));
app.use('/agenda', autenticar, require('./rotas/agenda'));
app.use('/atendimentos', autenticar, require('./rotas/atendimentos'));
app.use('/atendimentos', autenticar, require('./rotas/validacao'));
app.use('/clientes', autenticar, require('./rotas/clientes'));
app.use('/fechamento', autenticar, require('./rotas/fechamento'));
app.use('/notificacoes', autenticar, require('./rotas/notificacoes'));
app.use('/equipe', autenticar, require('./rotas/equipe'));
app.use('/servicos', autenticar, require('./rotas/servicos'));
app.use('/barbearia', autenticar, require('./rotas/barbearia'));

app.use((req, res) => {
  res.status(404).json({ erro: 'nao_encontrado', mensagem: 'Rota não encontrada.' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'json_invalido', mensagem: 'O corpo da requisição não é um JSON válido.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'corpo_grande', mensagem: 'O corpo da requisição é grande demais.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'erro_interno', mensagem: 'Algo deu errado. Tente novamente em instantes.' });
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => {
  console.log(`API rodando em http://localhost:${porta}`);
});
