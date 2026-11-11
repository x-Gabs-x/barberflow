const { randomUUID } = require('node:crypto');
const { VERSAO_TERMOS } = require('../termos');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lista explícita: erros não reconhecidos podem ocorrer depois de um commit.
const REJEICOES_DE_INSERCAO = new Set(['23502', '23503', '23505', '23514', '23P01']);

function conflito(erro, mensagem) {
  return { status: 409, corpo: { erro, mensagem } };
}

function statusHTTPConfirmado(resultado) {
  return resultado?.error === null && Number.isInteger(resultado.status) &&
    resultado.status >= 200 && resultado.status < 300;
}

function criarCadastrarEquipe(supabase, registrarErro = (evento) => console.error(evento)) {
  return async (req, res) => {
    const operacaoId = randomUUID();
    const { id_barbearia: codigo, perfil, nome_completo, cpf, email, telefone, senha } = req.body;
    let usuarioId = null;
    let vinculoId = null;
    let estabelecimentoId = null;
    let etapa = 'consultar_cpf';
    let corpoConflito = null;
    let authPodeTerSidoCriado = false;
    let usuarioPodeTerSidoCriado = false;
    let vinculoPodeTerSidoCriado = false;
    let preservarUsuarioEVinculos = false;
    const pendencias = [];

    const registrar = (pendencia) => {
      if (!pendencias.includes(pendencia)) pendencias.push(pendencia);
    };

    try {
      const existente = await supabase.from('usuario').select('id').eq('cpf', cpf).maybeSingle();
      if (existente.error) throw Object.assign(new Error('consultar_cpf'), { etapa, respostaIncerta: !existente.error.code });
      if (existente.data) {
        return res.status(409).json({ erro: 'cpf_duplicado', mensagem: 'CPF já cadastrado. Use a conta existente.' });
      }

      etapa = 'consultar_estabelecimento';
      const estabelecimento = await supabase.from('estabelecimento').select('id').eq('codigo', codigo).maybeSingle();
      if (estabelecimento.error) throw Object.assign(new Error('consultar_estabelecimento'), { etapa, respostaIncerta: !estabelecimento.error.code });
      if (!estabelecimento.data) {
        return res.status(404).json({ erro: 'barbearia_nao_encontrada', mensagem: 'Barbearia não encontrada.' });
      }
      estabelecimentoId = estabelecimento.data.id;

      etapa = 'criar_auth';
      authPodeTerSidoCriado = true;
      const auth = await supabase.auth.admin.createUser({ email, password: senha, email_confirm: true });
      if (auth.error) {
        if (['email_exists', 'user_already_exists'].includes(auth.error.code)) {
          authPodeTerSidoCriado = false;
          return res.status(409).json({ erro: 'email_duplicado', mensagem: 'E-mail já cadastrado. A regra de unicidade de e-mail por barbearia (RN13) segue pendente de definição.' });
        }
        if (auth.error.status && auth.error.status < 500) {
          authPodeTerSidoCriado = false;
          if (auth.error.status === 429) {
            return res.status(429).json({ erro: 'muitas_tentativas', mensagem: 'Muitas tentativas. Aguarde e tente novamente.' });
          }
          return res.status(400).json({ erro: 'cadastro_equipe_falhou', mensagem: 'Não foi possível criar o cadastro. Confira os dados e tente novamente.' });
        }
        throw Object.assign(new Error('criar_auth'), { etapa, respostaIncerta: true });
      }

      usuarioId = auth.data?.user?.id;
      if (!UUID.test(usuarioId ?? '')) throw Object.assign(new Error('auth_sem_uuid'), { etapa });

      etapa = 'inserir_usuario';
      usuarioPodeTerSidoCriado = true;
      const usuarioCriado = await supabase.from('usuario').insert({
        id: usuarioId,
        nome_completo,
        cpf,
        email,
        telefone,
        termos_aceitos_em: new Date().toISOString(),
        termos_versao: VERSAO_TERMOS,
      });
      if (usuarioCriado.error) {
        usuarioPodeTerSidoCriado = !REJEICOES_DE_INSERCAO.has(usuarioCriado.error.code);
        if (usuarioCriado.error.code === '23505') {
          const concorrente = await supabase.from('usuario').select('id').eq('cpf', cpf).maybeSingle();
          if (!concorrente.error && concorrente.data && concorrente.data.id !== usuarioId) {
            corpoConflito = conflito('cpf_duplicado', 'CPF já cadastrado. Use a conta existente.');
          }
        }
        throw Object.assign(new Error('inserir_usuario'), {
          etapa,
          respostaIncerta: usuarioPodeTerSidoCriado,
          erroPostgres: usuarioCriado.error.code,
        });
      }

      etapa = 'inserir_vinculo';
      vinculoId = randomUUID();
      // Reservar o UUID antes da chamada permite compensar uma resposta perdida
      // sem procurar nem apagar vínculos pertencentes a outra operação.
      vinculoPodeTerSidoCriado = true;
      const vinculo = await supabase.from('vinculo').insert({
        id: vinculoId,
        usuario_id: usuarioId,
        estabelecimento_id: estabelecimentoId,
        perfil,
        status: 'aguardando',
        ...(perfil === 'parceiro' ? { escote_percentual: 40 } : {}),
      });
      if (vinculo.error) {
        vinculoPodeTerSidoCriado = !REJEICOES_DE_INSERCAO.has(vinculo.error.code);
        if (vinculo.error.code === '23505') {
          const existentes = await supabase.from('vinculo').select('id').eq('usuario_id', usuarioId);
          if (!existentes.error && Array.isArray(existentes.data) && existentes.data.length) {
            corpoConflito = conflito('vinculo_duplicado', 'Esta conta já possui um vínculo de equipe ativo ou aguardando aprovação.');
          }
        }
        throw Object.assign(new Error('inserir_vinculo'), {
          etapa,
          respostaIncerta: vinculoPodeTerSidoCriado,
          erroPostgres: vinculo.error.code,
        });
      }

      return res.status(201).json({ ok: true, status: 'aguardando', mensagem: 'Pedido enviado ao dono.' });
    } catch (erro) {
      const falhaEtapa = erro?.etapa ?? etapa;
      if (erro?.respostaIncerta) registrar(`verificar_resultado_${falhaEtapa}`);
      if (falhaEtapa.startsWith('inserir_') &&
          !REJEICOES_DE_INSERCAO.has(erro?.erroPostgres ?? erro?.code)) {
        registrar(`verificar_resultado_${falhaEtapa}`);
      }

      // Só tenta apagar o vínculo com o UUID reservado por esta operação.
      if (vinculoPodeTerSidoCriado && vinculoId && usuarioId) {
        let exclusaoConfirmada = false;
        try {
          const exclusao = await supabase.from('vinculo').delete()
            .eq('id', vinculoId)
            .eq('usuario_id', usuarioId)
            .eq('estabelecimento_id', estabelecimentoId);
          if (!statusHTTPConfirmado(exclusao)) throw new Error('exclusao_vinculo_nao_confirmada');
          const restante = await supabase.from('vinculo').select('id').eq('id', vinculoId).maybeSingle();
          if (restante.error || restante.data) throw new Error('verificacao_vinculo_nao_confirmada');
          exclusaoConfirmada = true;
        } catch {
          registrar('excluir_vinculo_da_tentativa');
        }
        // Não chamar deleteUser: ON DELETE CASCADE apagaria todos os vínculos
        // desse usuário, inclusive um criado por outra operação concorrente.
        if (!exclusaoConfirmada) {
          usuarioPodeTerSidoCriado = false;
          preservarUsuarioEVinculos = true;
        }
      }

      if (usuarioId && usuarioPodeTerSidoCriado) {
        try {
          const outrosVinculos = await supabase.from('vinculo')
            .select('id')
            .eq('usuario_id', usuarioId);
          if (outrosVinculos.error || !Array.isArray(outrosVinculos.data)) {
            registrar('verificar_vinculos_antes_de_excluir_auth');
            usuarioPodeTerSidoCriado = false;
            preservarUsuarioEVinculos = true;
          } else if (outrosVinculos.data.some((v) => v.id !== vinculoId)) {
            // FK usuario_id ON DELETE CASCADE: preservar qualquer vínculo que
            // não tenha o UUID reservado por esta tentativa.
            registrar('vinculo_de_outra_operacao_preservado');
            usuarioPodeTerSidoCriado = false;
            preservarUsuarioEVinculos = true;
          }
        } catch {
          registrar('verificar_vinculos_antes_de_excluir_auth');
          usuarioPodeTerSidoCriado = false;
          preservarUsuarioEVinculos = true;
        }
      }

      if (usuarioId && authPodeTerSidoCriado && !preservarUsuarioEVinculos) {
        try {
          const exclusaoAuth = await supabase.auth.admin.deleteUser(usuarioId);
          if (exclusaoAuth?.error?.code !== 'user_not_found' &&
              (exclusaoAuth?.error !== null || exclusaoAuth.data?.user?.id !== usuarioId)) {
            throw new Error('exclusao_auth_nao_confirmada');
          }
          usuarioPodeTerSidoCriado = false;
        } catch {
          registrar('excluir_auth_da_tentativa');
        }
      } else if (authPodeTerSidoCriado && !usuarioId) {
        // Auth pode ter criado a conta antes de a resposta perder o UUID.
        registrar('verificar_criacao_auth');
      }

      // CPF/email/senha, resposta do SDK, SQLSTATE e stack não entram no log.
      registrarErro({
        evento: 'cadastro_equipe_falhou',
        operacao_id: operacaoId,
        etapa: falhaEtapa,
        usuario_id: usuarioId,
        vinculo_id: vinculoId,
        estabelecimento_id: estabelecimentoId,
        pendencias,
      });

      if (pendencias.length) {
        return res.status(500).json({
          erro: 'cadastro_limpeza_pendente',
          mensagem: 'Não foi possível concluir o cadastro. Existe pendência de verificação e limpeza manual. Informe o protocolo ao suporte.',
          protocolo: operacaoId,
        });
      }
      if (corpoConflito) return res.status(corpoConflito.status).json(corpoConflito.corpo);
      return res.status(500).json({ erro: 'cadastro_equipe_falhou', mensagem: 'Não foi possível concluir o cadastro. Tente novamente mais tarde.' });
    }
  };
}

module.exports = { criarCadastrarEquipe };
