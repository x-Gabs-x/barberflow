require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./supabase');
const {autenticar} = require('./middlewares/autenticar');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/saude', async (req, res) => {
  const { error } = await supabase
    .from('estabelecimento')
    .select('id', { head: true, count: 'exact' });

  if (error) {
    return res.status(500).json({ erro: 'banco', mensagem: error.message });
  }
  res.json({ ok: true, banco: 'conectado' });
});

app.use('/auth', require('./rotas/auth'));

app.use('/agenda', autenticar, require('./rotas/agenda'));
app.use('/atendimentos', autenticar, require('./rotas/atendimentos'));
app.use('/atendimentos', autenticar, require('./rotas/validacao'));
app.use('/clientes', autenticar, require('./rotas/clientes'));
app.use('/fechamento', autenticar, require('./rotas/fechamento'));
app.use('/equipe', autenticar, require('./rotas/equipe'));
app.use('/servicos', autenticar, require('./rotas/servicos'));
app.use('/barbearia', autenticar, require('./rotas/barbearia'));

const porta = process.env.PORT || 3000;
app.listen(porta, () => {
  console.log(`API rodando em http://localhost:${porta}`);
});