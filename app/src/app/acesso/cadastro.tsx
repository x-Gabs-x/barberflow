import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import AceiteTermos from '../../components/AceiteTermos';
import Botao from '../../components/Botao';
import Campo from '../../components/Campo';
import { api, ErroApi, errosPorCampo } from '../../api/cliente';
import { cores, raio } from '../../theme';

type TipoCadastro = 'dono' | 'equipe';
type PerfilEquipe = 'parceiro' | 'recepcao';
type CamposComuns = {
  nome_completo: string;
  cpf: string;
  email: string;
  telefone: string;
  senha: string;
  aceite_termos: boolean;
};

function mensagemDoErro(erro: unknown) {
  if (erro instanceof ErroApi) return erro.message;
  return 'Não foi possível acessar a API. Verifique sua conexão e tente novamente.';
}

export default function TelaCadastro() {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoCadastro>('dono');
  const [perfil, setPerfil] = useState<PerfilEquipe>('parceiro');
  const [campos, setCampos] = useState<CamposComuns>({ nome_completo: '', cpf: '', email: '', telefone: '', senha: '', aceite_termos: false });
  const [nomeBarbearia, setNomeBarbearia] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [telefoneBarbearia, setTelefoneBarbearia] = useState('');
  const [cidade, setCidade] = useState('');
  const [codigoBarbearia, setCodigoBarbearia] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [sucesso, setSucesso] = useState<'dono' | 'equipe' | null>(null);

  function atualizar(campo: keyof CamposComuns, valor: string | boolean) {
    setCampos((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: '' }));
  }

  function trocarTipo(novoTipo: TipoCadastro) {
    setTipo(novoTipo);
    setMensagemErro('');
    setErros({});
    setSucesso(null);
  }

  async function cadastrar() {
    if (carregando) return;
    setCarregando(true);
    setMensagemErro('');
    setErros({});
    try {
      if (tipo === 'dono') {
        const telefoneOpcional = telefoneBarbearia.trim();
        const cidadeOpcional = cidade.trim();
        await api.post('/auth/cadastro/dono', {
          ...campos,
          barbearia: {
            nome: nomeBarbearia,
            data_inicio: dataInicio,
            ...(telefoneOpcional ? { telefone: telefoneOpcional } : {}),
            ...(cidadeOpcional ? { cidade: cidadeOpcional } : {}),
          },
        });
        setSucesso('dono');
      } else {
        await api.post('/auth/cadastro/equipe', {
          id_barbearia: codigoBarbearia,
          perfil,
          ...campos,
        });
        setSucesso('equipe');
      }
    } catch (erro) {
      setErros(errosPorCampo(erro));
      setMensagemErro(mensagemDoErro(erro));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={estilos.conteudo}>
        <View style={estilos.cartao}>
          <Text style={estilos.marca}>BARBERFLOW</Text>
          <Text style={estilos.titulo}>{sucesso ? 'Cadastro realizado' : 'Criar conta'}</Text>

          {sucesso ? (
            <View style={estilos.sucessoBox}>
              <Text style={estilos.sucessoTexto}>
                {sucesso === 'dono'
                  ? 'Seu cadastro foi realizado. Agora você já pode entrar no BarberFlow com seu CPF e senha.'
                  : 'Seu pedido foi enviado ao dono da barbearia. O acesso será liberado depois que ele aprovar sua solicitação.'}
              </Text>
              <Botao titulo="Ir para o login" onPress={() => router.replace('/acesso/login')} />
            </View>
          ) : (
            <>
              <Text style={estilos.subtitulo}>Escolha como deseja usar o BarberFlow.</Text>
              <View style={estilos.seletorTipo}>
                <Pressable
                  onPress={() => trocarTipo('dono')}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: tipo === 'dono' }}
                  style={[estilos.tipoBotao, tipo === 'dono' && estilos.tipoSelecionado]}
                >
                  <Text style={[estilos.tipoTitulo, tipo === 'dono' && estilos.tipoTituloSelecionado]}>Nova barbearia</Text>
                  <Text style={[estilos.tipoDetalhe, tipo === 'dono' && estilos.tipoTituloSelecionado]}>Vou cadastrar como dono</Text>
                </Pressable>
                <Pressable
                  onPress={() => trocarTipo('equipe')}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: tipo === 'equipe' }}
                  style={[estilos.tipoBotao, tipo === 'equipe' && estilos.tipoSelecionado]}
                >
                  <Text style={[estilos.tipoTitulo, tipo === 'equipe' && estilos.tipoTituloSelecionado]}>Entrar na equipe</Text>
                  <Text style={[estilos.tipoDetalhe, tipo === 'equipe' && estilos.tipoTituloSelecionado]}>Tenho um código de acesso</Text>
                </Pressable>
              </View>

              {tipo === 'equipe' ? (
                <View style={estilos.grupo}>
                  <Text style={estilos.rotuloGrupo}>Seu perfil na equipe</Text>
                  <View style={estilos.seletorPerfil}>
                    {(['parceiro', 'recepcao'] as const).map((opcao) => (
                      <Pressable
                        key={opcao}
                        onPress={() => setPerfil(opcao)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: perfil === opcao }}
                        style={[estilos.perfilBotao, perfil === opcao && estilos.perfilSelecionado]}
                      >
                        <Text style={[estilos.perfilTexto, perfil === opcao && estilos.perfilTextoSelecionado]}>
                          {opcao === 'parceiro' ? 'Parceiro' : 'Recepção'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Campo
                    rotulo="Código da barbearia"
                    valor={codigoBarbearia}
                    onChangeText={(valor) => { setCodigoBarbearia(valor); setErros((atual) => ({ ...atual, id_barbearia: '' })); }}
                    placeholder="BRB-XXXX-XXXX"
                    erro={erros.id_barbearia}
                  />
                </View>
              ) : null}

              <View style={estilos.grupo}>
                <Text style={estilos.rotuloGrupo}>Seus dados</Text>
                <Campo rotulo="Nome completo" valor={campos.nome_completo} onChangeText={(v) => atualizar('nome_completo', v)} placeholder="Seu nome completo" erro={erros.nome_completo} />
                <Campo rotulo="CPF" valor={campos.cpf} onChangeText={(v) => atualizar('cpf', v)} placeholder="000.000.000-00" keyboardType="numeric" erro={erros.cpf} />
                <Campo rotulo="E-mail" valor={campos.email} onChangeText={(v) => atualizar('email', v)} placeholder="voce@exemplo.com" keyboardType="email-address" erro={erros.email} />
                <Campo rotulo="Telefone" valor={campos.telefone} onChangeText={(v) => atualizar('telefone', v)} placeholder="(83) 90000-0000" keyboardType="phone-pad" erro={erros.telefone} />
                <View style={estilos.campoSenha}>
                  <Campo rotulo="Senha" valor={campos.senha} onChangeText={(v) => atualizar('senha', v)} placeholder="Crie uma senha" secureTextEntry erro={erros.senha} />
                  <Text style={estilos.ajuda}>Use de 8 a 72 caracteres, com ao menos uma letra e um número.</Text>
                </View>
              </View>

              {tipo === 'dono' ? (
                <View style={estilos.grupo}>
                  <Text style={estilos.rotuloGrupo}>Sua barbearia</Text>
                  <Campo rotulo="Nome da barbearia" valor={nomeBarbearia} onChangeText={(v) => { setNomeBarbearia(v); setErros((a) => ({ ...a, 'barbearia.nome': '' })); }} placeholder="Ex.: Barbearia Central" erro={erros['barbearia.nome']} />
                  <Campo rotulo="Data de início" valor={dataInicio} onChangeText={(v) => { setDataInicio(v); setErros((a) => ({ ...a, 'barbearia.data_inicio': '' })); }} placeholder="AAAA-MM-DD" erro={erros['barbearia.data_inicio']} />
                  <Campo rotulo="Telefone da barbearia (opcional)" valor={telefoneBarbearia} onChangeText={(v) => { setTelefoneBarbearia(v); setErros((a) => ({ ...a, 'barbearia.telefone': '' })); }} placeholder="(83) 3000-0000" keyboardType="phone-pad" erro={erros['barbearia.telefone']} />
                  <Campo rotulo="Cidade (opcional)" valor={cidade} onChangeText={(v) => { setCidade(v); setErros((a) => ({ ...a, 'barbearia.cidade': '' })); }} placeholder="Sua cidade" erro={erros['barbearia.cidade']} />
                </View>
              ) : null}

              <AceiteTermos aceito={campos.aceite_termos} onChange={(valor) => atualizar('aceite_termos', valor)} erro={erros.aceite_termos} />
              {mensagemErro ? <Text accessibilityRole="alert" style={estilos.erroGeral}>{erros.geral ?? mensagemErro}</Text> : null}
              <Botao titulo={carregando ? 'Enviando…' : tipo === 'dono' ? 'Cadastrar barbearia' : 'Enviar pedido'} onPress={cadastrar} desabilitado={carregando} />
              <View style={estilos.rodape}>
                <Text style={estilos.textoRodape}>Já tem conta?</Text>
                <Pressable onPress={() => router.replace('/acesso/login')} accessibilityRole="link">
                  <Text style={estilos.link}>Ir para o login</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1, alignItems: 'center', padding: 20, paddingVertical: 28 },
  cartao: { width: '100%', maxWidth: 560, backgroundColor: cores.branco, borderRadius: raio.card, padding: 24, gap: 16, borderWidth: 1, borderColor: cores.borda },
  marca: { color: cores.dourado, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  titulo: { color: cores.marinho, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  subtitulo: { color: cores.textoSuave, fontSize: 15, lineHeight: 22, marginTop: -10 },
  seletorTipo: { flexDirection: 'row', gap: 10 },
  tipoBotao: { flex: 1, minHeight: 76, justifyContent: 'center', borderWidth: 1, borderColor: cores.borda, borderRadius: raio.campo, padding: 12, gap: 5, backgroundColor: cores.branco },
  tipoSelecionado: { borderColor: cores.dourado, backgroundColor: cores.marinho },
  tipoTitulo: { color: cores.texto, fontSize: 14, fontWeight: '700' },
  tipoDetalhe: { color: cores.textoSuave, fontSize: 12, lineHeight: 16 },
  tipoTituloSelecionado: { color: cores.branco },
  grupo: { gap: 14 },
  rotuloGrupo: { color: cores.marinho, fontSize: 17, fontWeight: '700' },
  seletorPerfil: { flexDirection: 'row', gap: 10 },
  perfilBotao: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: cores.borda, borderRadius: raio.campo },
  perfilSelecionado: { borderColor: cores.dourado, backgroundColor: cores.avisoFundo },
  perfilTexto: { color: cores.texto, fontSize: 14, fontWeight: '600' },
  perfilTextoSelecionado: { color: cores.marinho },
  campoSenha: { gap: 6 },
  ajuda: { color: cores.textoSuave, fontSize: 12, lineHeight: 18 },
  erroGeral: { color: cores.erro, backgroundColor: cores.erroFundo, borderRadius: 8, padding: 12, fontSize: 14, lineHeight: 20 },
  sucessoBox: { gap: 20, backgroundColor: cores.okFundo, borderRadius: raio.campo, padding: 16 },
  sucessoTexto: { color: cores.ok, fontSize: 15, lineHeight: 23 },
  rodape: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 },
  textoRodape: { color: cores.textoSuave, fontSize: 14 },
  link: { color: cores.dourado, fontSize: 14, fontWeight: '700' },
});
