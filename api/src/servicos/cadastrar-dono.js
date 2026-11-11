const { randomInt, randomUUID } = require('node:crypto');
const { VERSAO_TERMOS } = require('../termos');

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MAX_TENTATIVAS_CODIGO = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Estas violações de integridade rejeitam a instrução INSERT no PostgreSQL.
// Não generalizar pelo formato SQLSTATE: 08007 e 40003 indicam resultado
// desconhecido. Falhas de comunicação e códigos não listados são incertos.
const REJEICOES_DE_INSERCAO = new Set([
  '23502', // not_null_violation
  '23503', // foreign_key_violation
  '23505', // unique_violation
  '23514', // check_violation
  '23P01', // exclusion_violation
]);

function insercaoFoiRejeitada(erro) {
  return REJEICOES_DE_INSERCAO.has(erro?.code);
}

function gerarCodigo() {
  const bloco = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
  return `BRB-${bloco()}-${bloco()}`;
}

function conflito(campo, mensagem) {
  return { status: 409, corpo: { erro: `${campo}_duplicado`, mensagem, campos: [{ campo, mensagem }] } };
}

// A fábrica permite testar sem carregar .env nem conectar ao Supabase.
function criarCadastroDono(supabase, registrarErro = (evento) => console.error(evento)) {
  return async (req, res) => {
    const operacaoId = randomUUID();
    const { nome_completo, cpf, email, telefone, senha, barbearia } = req.body;
    let usuarioId = null;
    let estabelecimentoId = null;
    let etapa = 'consultar_cpf';
    let resposta = null;
    const pendencias = [];

    const buscarCpf = () => supabase.from('usuario').select('id').eq('cpf', cpf).maybeSingle();

    try {
      const existente = await buscarCpf();
      if (existente.error) throw existente.error;
      if (existente.data) {
        const duplicado = conflito('cpf', 'CPF já cadastrado. Use sua conta existente.');
        return res.status(duplicado.status).json(duplicado.corpo);
      }

      etapa = 'criar_auth';
      const auth = await supabase.auth.admin.createUser({ email, password: senha, email_confirm: true });
      if (auth.error) {
        if (['email_exists', 'user_already_exists'].includes(auth.error.code)) {
          resposta = conflito('email', 'E-mail já cadastrado. A regra de e-mail por barbearia (RN13) está pendente de definição.');
        } else if (!auth.error.status || auth.error.status >= 500) {
          pendencias.push('verificar_criacao_auth');
        }
        throw auth.error;
      }
      if (!UUID.test(auth.data?.user?.id ?? '')) {
        pendencias.push('verificar_criacao_auth');
        throw new Error('auth_sem_id');
      }
      usuarioId = auth.data.user.id;

      etapa = 'inserir_usuario';
      const pessoa = await supabase.from('usuario').insert({
        id: usuarioId,
        nome_completo,
        cpf,
        email,
        telefone,
        termos_aceitos_em: new Date().toISOString(),
        termos_versao: VERSAO_TERMOS,
      });
      if (pessoa.error) {
        if (pessoa.error.code === '23505') {
          // Não presumimos o nome da constraint: confirmamos o conflito de CPF.
          const concorrente = await buscarCpf();
          if (!concorrente.error && concorrente.data && concorrente.data.id !== usuarioId) {
            resposta = conflito('cpf', 'CPF já cadastrado. Use sua conta existente.');
          }
        }
        throw pessoa.error;
      }

      etapa = 'inserir_estabelecimento';
      for (let tentativa = 0; tentativa < MAX_TENTATIVAS_CODIGO; tentativa++) {
        const codigo = gerarCodigo();
        // UUID reservado por esta tentativa, inclusive se a resposta da inserção se perder.
        estabelecimentoId = randomUUID();
        const estabelecimento = await supabase.from('estabelecimento').insert({
          id: estabelecimentoId,
          nome: barbearia.nome,
          codigo,
          data_inicio: barbearia.data_inicio,
          ...(barbearia.telefone !== undefined ? { telefone: barbearia.telefone } : {}),
          ...(barbearia.cidade !== undefined ? { cidade: barbearia.cidade } : {}),
        }).select('id').single();

        if (estabelecimento.error) {
          // Só descartar o UUID quando houver rejeição definitiva conhecida.
          if (insercaoFoiRejeitada(estabelecimento.error)) estabelecimentoId = null;
          if (estabelecimento.error.code === '23505') {
            const colisao = await supabase.from('estabelecimento').select('id').eq('codigo', codigo).maybeSingle();
            if (!colisao.error && colisao.data && tentativa + 1 < MAX_TENTATIVAS_CODIGO) continue;
          }
          throw estabelecimento.error;
        }
        if (estabelecimento.data?.id !== estabelecimentoId) throw new Error('estabelecimento_sem_id');
        break;
      }

      etapa = 'inserir_vinculo';
      const vinculo = await supabase.from('vinculo').insert({
        usuario_id: usuarioId,
        estabelecimento_id: estabelecimentoId,
        perfil: 'dono',
        status: 'ativo',
        escote_percentual: 100,
      });
      if (vinculo.error) throw vinculo.error;

      return res.status(201).json({ ok: true, mensagem: 'Cadastro realizado.' });
    } catch (erro) {
      // Uma exceção de rede pode ocorrer depois do commit remoto. Não é seguro
      // repetir a criação no Auth nem procurar uma conta por e-mail para excluí-la.
      if (etapa === 'criar_auth' && !usuarioId && !resposta && !erro?.status) {
        if (!pendencias.includes('verificar_criacao_auth')) pendencias.push('verificar_criacao_auth');
      }
      if (etapa.startsWith('inserir_') && !insercaoFoiRejeitada(erro)) {
        // A gravação original pode continuar em andamento. Mesmo uma exclusão
        // bem-sucedida agora não dispensa verificar o resultado remoto depois.
        pendencias.push('verificar_resultado_da_gravacao');
      }

      // A ordem é importante: excluir Auth NÃO remove o estabelecimento.
      if (estabelecimentoId) {
        try {
          const remocao = await supabase.from('estabelecimento').delete().eq('id', estabelecimentoId);
          // PostgREST confirma o DELETE com HTTP 2xx e error: null.
          // Uma resposta ausente/incompleta não comprova a exclusão.
          if (remocao?.error !== null || !Number.isInteger(remocao.status) ||
              remocao.status < 200 || remocao.status >= 300) {
            throw new Error('exclusao_estabelecimento_nao_confirmada');
          }
        } catch {
          pendencias.push('excluir_estabelecimento');
        }
      }
      if (usuarioId) {
        try {
          const remocao = await supabase.auth.admin.deleteUser(usuarioId);
          // O SDK devolve o usuário excluído; não aceitar sucesso sem o UUID
          // esperado. user_not_found também confirma ausência da conta alvo.
          if (remocao?.error?.code !== 'user_not_found' &&
              (remocao?.error !== null || remocao.data?.user?.id !== usuarioId)) {
            throw new Error('exclusao_auth_nao_confirmada');
          }
        } catch {
          pendencias.push('excluir_auth');
        }
      }

      // Não registrar erro original, payload, CPF, e-mail, senha, token ou chave.
      registrarErro({
        evento: 'cadastro_dono_falhou',
        operacao_id: operacaoId,
        etapa,
        usuario_id: usuarioId,
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
      if (resposta) return res.status(resposta.status).json(resposta.corpo);
      return res.status(500).json({ erro: 'cadastro_falhou', mensagem: 'Não foi possível concluir o cadastro. Tente novamente mais tarde.' });
    }
  };
}

module.exports = { criarCadastroDono, gerarCodigo };
