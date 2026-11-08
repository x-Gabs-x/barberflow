const { criarClienteAuthIsolado } = require('../supabase-auth');

function respostaErro(res, status, erro, mensagem) {
  return res.status(status).json({ erro, mensagem });
}

function credenciaisInvalidas(res) {
  return respostaErro(res, 401, 'credenciais_invalidas', 'CPF ou senha inválidos.');
}

function criarAutenticarLogin(supabaseAdmin, criarAuthIsolado = criarClienteAuthIsolado) {
  return async (req, res) => {
    const { cpf, senha } = req.body; // CPF já normalizado pelo schema Zod da rota.

    try {
      const { data: usuario, error: erroUsuario } = await supabaseAdmin
        .from('usuario')
        .select('id, nome_completo, email')
        .eq('cpf', cpf)
        .maybeSingle();

      if (erroUsuario) {
        return respostaErro(res, 500, 'falha_login', 'Não foi possível concluir o login. Tente novamente.');
      }
      // CPF ausente e senha incorreta têm o mesmo status, código e mensagem.
      if (!usuario) return credenciaisInvalidas(res);

      const supabaseAuth = criarAuthIsolado();
      const { data: autenticacao, error: erroAuth } = await supabaseAuth.auth.signInWithPassword({
        email: usuario.email,
        password: senha,
      });

      if (erroAuth) {
        if (erroAuth.status === 429) {
          return respostaErro(res, 429, 'muitas_tentativas', 'Muitas tentativas. Aguarde e tente novamente.');
        }
        if ([400, 401].includes(erroAuth.status) || erroAuth.code === 'invalid_credentials') {
          return credenciaisInvalidas(res);
        }
        return respostaErro(res, 503, 'falha_login', 'Não foi possível concluir o login. Tente novamente.');
      }

      const authUserId = autenticacao?.user?.id;
      const token = autenticacao?.session?.access_token;
      if (!authUserId || authUserId !== usuario.id || typeof token !== 'string' || !token) {
        return credenciaisInvalidas(res);
      }

      const { data: vinculos, error: erroVinculo } = await supabaseAdmin
        .from('vinculo')
        .select('estabelecimento_id, perfil, status')
        .eq('usuario_id', usuario.id);

      if (erroVinculo || !Array.isArray(vinculos)) {
        return respostaErro(res, 500, 'falha_login', 'Não foi possível concluir o login. Tente novamente.');
      }

      const ativos = vinculos.filter((v) => v.status === 'ativo');
      if (!ativos.length) {
        const aguardando = vinculos.some((v) => v.status === 'aguardando');
        const mensagem = aguardando
          ? 'Seu pedido de acesso aguarda aprovação do dono da barbearia.'
          : 'Sua conta não tem vínculo ativo com uma barbearia.';
        return respostaErro(res, 403, 'sem_vinculo_ativo', mensagem);
      }

      const ids = [...new Set(ativos.map((v) => v.estabelecimento_id))];
      const { data: estabelecimentos, error: erroEstabelecimento } = await supabaseAdmin
        .from('estabelecimento')
        .select('id, nome')
        .in('id', ids);

      if (erroEstabelecimento || !Array.isArray(estabelecimentos)) {
        return respostaErro(res, 500, 'falha_login', 'Não foi possível concluir o login. Tente novamente.');
      }

      const porId = new Map(estabelecimentos.map((e) => [e.id, e]));
      const barbearias = ativos.flatMap((v) => {
        const estabelecimento = porId.get(v.estabelecimento_id);
        return estabelecimento
          ? [{ id: estabelecimento.id, nome: estabelecimento.nome, perfil: v.perfil }]
          : [];
      });

      // Sem um estabelecimento resolvido não há vínculo utilizável no middleware.
      if (!barbearias.length) {
        return respostaErro(res, 500, 'falha_login', 'Não foi possível concluir o login. Tente novamente.');
      }

      return res.json({
        token,
        usuario: {
          id: usuario.id,
          nome_completo: usuario.nome_completo,
          // Campo legado: cada barbearia também carrega seu próprio perfil.
          perfil: barbearias[0].perfil,
        },
        barbearias,
      });
    } catch {
      return respostaErro(res, 503, 'falha_login', 'Não foi possível concluir o login. Tente novamente.');
    }
  };
}

module.exports = { criarAutenticarLogin };
