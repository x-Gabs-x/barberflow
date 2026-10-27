require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

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

const porta = process.env.PORT || 3000;
app.listen(porta, () => {
  console.log(`API rodando em http://localhost:${porta}`);
});