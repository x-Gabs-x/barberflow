const supabase = require('../supabase');

async function autenticar(req, res, next) {
  try {
    // Atalho só para desenvolvimento: finge um login pelo cabeçalho x-dev-perfil
    if (process.env.DEV_SEM_LOGIN === 'true' && req.headers['x-dev-perfil']) {
      req.usuario = {
        id: 'usuario-de-teste',
        perfil: req.headers['x-dev-perfil'],
        estabelecimento_id: 'barbearia-de-teste',
      };
      return next();
    }
    const cabecalho = req.headers.authorization || '';
    const token = cabecalho.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ erro: 'sem_login', mensagem: 'Faça login para continuar.' });
    }
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ erro: 'token_invalido', mensagem: 'Sessão inválida ou expirada.' });
    }

    const { data: vinculos, error: erroVinculo } = await supabase
      .from('vinculo')
      .select('estabelecimento_id, perfil, escote_percentual')
      .eq('usuario_id', data.user.id)
      .eq('status', 'ativo');
    if (erroVinculo) throw erroVinculo;
    if (!vinculos.length) {
      return res.status(403).json({ erro: 'sem_vinculo', mensagem: 'Você ainda não faz parte de uma barbearia.' });
    }

    const escolhida = req.headers['x-barbearia'];
    const vinculo = escolhida
      ? vinculos.find((v) => v.estabelecimento_id === escolhida)
      : vinculos[0];
    if (!vinculo) {
      return res.status(403).json({ erro: 'barbearia_invalida', mensagem: 'Você não tem acesso a esta barbearia.' });
    }

    req.usuario = {
      id: data.user.id,
      perfil: vinculo.perfil,
      estabelecimento_id: vinculo.estabelecimento_id,
      escote_percentual: vinculo.escote_percentual,
    };
    next();
  } catch {
    res.status(500).json({ erro: 'servidor', mensagem: 'Não foi possível validar a sessão. Tente novamente.' });
  }
}
function exigirPerfil(...permitidos) {
  return (req, res, next) => {
    if (!permitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'sem_permissao', mensagem: 'Seu perfil não pode fazer isso.' });
    }
    next();
  };
}

module.exports = { autenticar, exigirPerfil };
