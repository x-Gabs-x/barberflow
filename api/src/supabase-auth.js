const { createClient } = require('@supabase/supabase-js');

// Cliente efêmero e isolado: signInWithPassword nunca altera o cliente admin.
// A chave é usada apenas no backend existente e não sai na resposta HTTP.
function criarClienteAuthIsolado({ createClient: criarCliente = createClient, url = process.env.SUPABASE_URL, chave = process.env.SUPABASE_SECRET_KEY } = {}) {
  const chaveSecreta = chave;
  if (!url || !chaveSecreta) throw new Error('supabase_auth_config_ausente');

  return criarCliente(url, chaveSecreta, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

module.exports = { criarClienteAuthIsolado };
