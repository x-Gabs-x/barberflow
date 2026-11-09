import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Botao from '../../components/Botao';
import Campo from '../../components/Campo';
import { api, definirSessao, ErroApi, errosPorCampo } from '../../api/cliente';
import { cores, raio } from '../../theme';

type Perfil = 'dono' | 'parceiro' | 'recepcao';
type Barbearia = { id: string; nome: string; perfil: Perfil };
type RespostaLogin = {
  token: string;
  usuario: { id: string; nome_completo: string; perfil: Perfil };
  barbearias: Barbearia[];
};

function rotaDoPerfil(perfil: Perfil) {
  switch (perfil) {
    case 'dono': return '/dono/agenda';
    case 'parceiro': return '/parceiro/agenda';
    case 'recepcao': return '/recepcao/atendimentos';
  }
}

function mensagemDoErro(erro: unknown) {
  if (!(erro instanceof ErroApi)) return 'Não foi possível acessar a API. Verifique sua conexão e tente novamente.';
  if (erro.status === 429) return 'Há muitas tentativas de login. Aguarde um pouco e tente novamente.';
  return erro.message;
}

export default function TelaLogin() {
  const router = useRouter();
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [resposta, setResposta] = useState<RespostaLogin | null>(null);

  async function entrar() {
    if (carregando) return;
    setCarregando(true);
    setMensagemErro('');
    setErros({});
    setResposta(null);
    // Login é público: não envie ao endpoint uma sessão de teste ou anterior.
    definirSessao({ token: null, perfilDeTeste: null, barbearia: null });
    try {
      const dados = await api.post<RespostaLogin>('/auth/login', { cpf, senha });
      if (!dados.barbearias?.length) {
        setMensagemErro('Sua conta não possui uma barbearia ativa para acessar.');
        return;
      }
      definirSessao({ token: dados.token, perfilDeTeste: null, barbearia: null });
      if (dados.barbearias.length === 1) {
        selecionarBarbearia(dados, dados.barbearias[0]);
      } else {
        setResposta(dados);
      }
    } catch (erro) {
      setErros(errosPorCampo(erro));
      setMensagemErro(mensagemDoErro(erro));
    } finally {
      setCarregando(false);
    }
  }

  function selecionarBarbearia(dados: RespostaLogin, barbearia: Barbearia) {
    definirSessao({ token: dados.token, perfilDeTeste: null, barbearia: barbearia.id });
    router.replace(rotaDoPerfil(barbearia.perfil));
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={estilos.conteudo}
      >
        <View style={estilos.cartao}>
          <Text style={estilos.marca}>BARBERFLOW</Text>
          <Text style={estilos.titulo}>{resposta ? 'Escolha sua barbearia' : 'Acesse sua conta'}</Text>
          <Text style={estilos.subtitulo}>
            {resposta
              ? 'Sua conta tem mais de uma barbearia ativa. Selecione onde deseja entrar.'
              : 'Entre com seu CPF e sua senha para continuar.'}
          </Text>

          {resposta ? (
            <View style={estilos.lista}>
              {resposta.barbearias.map((barbearia) => (
                <Pressable
                  key={barbearia.id}
                  onPress={() => selecionarBarbearia(resposta, barbearia)}
                  accessibilityRole="button"
                  accessibilityLabel={`Entrar em ${barbearia.nome}`}
                  style={({ pressed }) => [estilos.opcao, pressed && estilos.opcaoPressionada]}
                >
                  <View style={estilos.opcaoTexto}>
                    <Text style={estilos.nomeBarbearia}>{barbearia.nome}</Text>
                    <Text style={estilos.perfil}>{barbearia.perfil === 'dono' ? 'Dono' : barbearia.perfil === 'parceiro' ? 'Parceiro' : 'Recepção'}</Text>
                  </View>
                  <Text style={estilos.seta}>›</Text>
                </Pressable>
              ))}
              <Botao titulo="Voltar ao login" variante="secundario" onPress={() => setResposta(null)} />
            </View>
          ) : (
            <View style={estilos.formulario}>
              <Campo
                rotulo="CPF"
                valor={cpf}
                onChangeText={setCpf}
                placeholder="000.000.000-00"
                keyboardType="numeric"
                erro={erros.cpf}
              />
              <Campo
                rotulo="Senha"
                valor={senha}
                onChangeText={setSenha}
                placeholder="Sua senha"
                secureTextEntry
                erro={erros.senha}
              />
              {mensagemErro ? <Text accessibilityRole="alert" style={estilos.erroGeral}>{erros.geral ?? mensagemErro}</Text> : null}
              <Botao titulo={carregando ? 'Entrando…' : 'Entrar'} onPress={entrar} desabilitado={carregando} />
              <View style={estilos.rodape}>
                <Text style={estilos.textoRodape}>Ainda não tem conta?</Text>
                <Pressable onPress={() => router.push('/acesso/cadastro')} accessibilityRole="link">
                  <Text style={estilos.link}>Criar conta</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingVertical: 32 },
  cartao: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: cores.branco, borderRadius: raio.card, padding: 24, gap: 12, borderWidth: 1, borderColor: cores.borda },
  marca: { color: cores.dourado, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  titulo: { color: cores.marinho, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  subtitulo: { color: cores.textoSuave, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  formulario: { gap: 18 },
  lista: { gap: 12, marginTop: 8 },
  opcao: { minHeight: 68, borderRadius: raio.campo, borderWidth: 1, borderColor: cores.borda, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: cores.branco },
  opcaoPressionada: { backgroundColor: cores.fundo },
  opcaoTexto: { gap: 4 },
  nomeBarbearia: { color: cores.texto, fontSize: 16, fontWeight: '600' },
  perfil: { color: cores.textoSuave, fontSize: 13 },
  seta: { color: cores.dourado, fontSize: 28, lineHeight: 30 },
  erroGeral: { color: cores.erro, backgroundColor: cores.erroFundo, borderRadius: 8, padding: 12, fontSize: 14, lineHeight: 20 },
  rodape: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 },
  textoRodape: { color: cores.textoSuave, fontSize: 14 },
  link: { color: cores.dourado, fontSize: 14, fontWeight: '700' },
});
