import { ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { NotificacaoAtendimento, notificacoesApi } from '../api/notificacoes';
import { dataLocal, mensagemErro } from '../api/parte3';
import { cores, raio } from '../theme';

type Perfil = 'dono' | 'parceiro' | 'recepcao';
const DURACAO_NOTIFICACAO = 5 * 60 * 1000;

function dataHoraNotificacao(data: string) {
  const instante = new Date(data);
  if (Number.isNaN(instante.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza',
  }).format(instante);
}

export default function NavegacaoOperacional({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [notificacoes, setNotificacoes] = useState<NotificacaoAtendimento[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [deslocamento, setDeslocamento] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState('');
  const [sinoAberto, setSinoAberto] = useState(false);
  const [agora, setAgora] = useState(0);

  useEffect(() => {
    let ativo = true;
    const atualizar = async () => {
      try {
        const pagina = await notificacoesApi.listar();
        if (!ativo) return;
        setNotificacoes((anteriores) => {
          if (!sinoAberto) return pagina.notificacoes;
          const ids = new Set(pagina.notificacoes.map((n) => n.id));
          return [...pagina.notificacoes, ...anteriores.filter((n) => !ids.has(n.id))];
        });
        setNaoLidas(pagina.nao_lidas);
        if (!sinoAberto) {
          setDeslocamento(pagina.notificacoes.length);
          setTemMais(pagina.tem_mais);
        }
        setAgora(Date.now());
        setErro('');
      } catch (e) {
        if (ativo) setErro(mensagemErro(e));
      }
    };
    atualizar();
    const intervalo = setInterval(atualizar, 30000);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [sinoAberto]);

  useEffect(() => {
    const proximaExpiracao = notificacoes
      .filter((n) => !n.lida_em)
      .map((n) => new Date(n.criado_em).getTime() + DURACAO_NOTIFICACAO)
      .filter((expiracao) => expiracao > agora)
      .sort((a, b) => a - b)[0];
    if (!proximaExpiracao) return;
    const temporizador = setTimeout(() => setAgora(Date.now()), Math.max(1, proximaExpiracao - Date.now() + 10));
    return () => clearTimeout(temporizador);
  }, [agora, notificacoes]);

  const recentes = notificacoes.filter((n) => {
    const idade = agora - new Date(n.criado_em).getTime();
    return !n.lida_em && idade >= 0 && idade < DURACAO_NOTIFICACAO;
  });

  function novoAtendimento() {
    router.navigate(perfil === 'dono' ? '/dono/novo' : '/parceiro/novo');
  }

  async function abrirNotificacao(notificacao: NotificacaoAtendimento) {
    setSinoAberto(false);
    if (!notificacao.lida_em) {
      try {
        const atualizada = await notificacoesApi.marcarLida(notificacao.id);
        setNotificacoes((anteriores) => anteriores.map((item) =>
          item.id === atualizada.id ? { ...item, lida_em: atualizada.lida_em } : item));
        setNaoLidas((total) => Math.max(0, total - 1));
        setErro('');
      } catch (e) {
        setErro(mensagemErro(e));
      }
    }
    if (perfil === 'recepcao') {
      router.navigate({
        pathname: '/recepcao/atendimentos',
        params: { id: notificacao.atendimento_id, data: dataLocal(new Date(notificacao.atendimento?.inicio || notificacao.criado_em)) },
      });
    } else {
      router.navigate({
        pathname: perfil === 'dono' ? '/dono/novo' : '/parceiro/novo',
        params: { id: notificacao.atendimento_id },
      });
    }
  }

  async function carregarMais() {
    if (!temMais || carregandoMais) return;
    setCarregandoMais(true);
    try {
      const pagina = await notificacoesApi.listar(deslocamento);
      setNotificacoes((anteriores) => {
        const ids = new Set(anteriores.map((n) => n.id));
        return [...anteriores, ...pagina.notificacoes.filter((n) => !ids.has(n.id))];
      });
      setDeslocamento((atual) => atual + pagina.notificacoes.length);
      setTemMais(pagina.tem_mais);
      setNaoLidas(pagina.nao_lidas);
      setErro('');
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregandoMais(false);
    }
  }

  function itemNotificacao(notificacao: NotificacaoAtendimento) {
    return (
      <Pressable
        key={notificacao.id}
        accessibilityRole="button"
        accessibilityLabel={`${notificacao.titulo}, ${dataHoraNotificacao(notificacao.criado_em)}. Ver atendimento`}
        onPress={() => abrirNotificacao(notificacao)}
        style={[estilos.notificacao, !notificacao.lida_em && estilos.notificacaoNova]}
      >
        <View style={estilos.notificacaoCabecalho}>
          <Text style={estilos.notificacaoTitulo}>{notificacao.titulo}</Text>
          <Text style={estilos.notificacaoData}>{dataHoraNotificacao(notificacao.criado_em)}</Text>
        </View>
        <Text style={estilos.suave}>{notificacao.mensagem}</Text>
        <Text style={estilos.link}>Ver atendimento →</Text>
      </Pressable>
    );
  }

  return (
    <View style={estilos.tela}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: cores.marinho },
          headerTintColor: cores.branco,
          tabBarStyle: { backgroundColor: cores.marinho },
          tabBarActiveTintColor: cores.dourado,
          tabBarInactiveTintColor: '#B9C2D0',
          headerRight: () => (
            <View style={estilos.acoesCabecalho}>
              {perfil !== 'recepcao' ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Novo atendimento" onPress={novoAtendimento} style={[estilos.botaoNovo, width < 400 && estilos.botaoNovoCompacto]}>
                  <Text style={[estilos.botaoNovoTexto, width < 400 && estilos.botaoNovoTextoCompacto]} numberOfLines={1}>+ Novo atendimento</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Notificações, ${naoLidas} não lidas`}
                accessibilityState={{ expanded: sinoAberto }}
                onPress={() => setSinoAberto((aberto) => !aberto)}
                style={[estilos.sino, naoLidas > 0 && estilos.sinoDestacado]}
              >
                <SymbolView name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }} size={23} tintColor={naoLidas > 0 ? cores.marinho : cores.branco} fallback={<Text style={estilos.sinoFallback}>🔔</Text>} />
                {naoLidas > 0 ? <View style={estilos.sinoContador}><Text style={estilos.sinoContadorTexto}>{naoLidas > 99 ? '99+' : naoLidas}</Text></View> : null}
              </Pressable>
            </View>
          ),
        }}
      >
        {children}
      </Tabs>
      {sinoAberto || recentes.length > 0 ? (
        <View style={[estilos.flutuante, { width: Math.min(width - 32, 410) }]}>
          {sinoAberto ? (
            <View style={estilos.painelNotificacoes}>
              <View style={estilos.linha}>
                <Text style={estilos.secao}>Notificações</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Fechar notificações" onPress={() => setSinoAberto(false)}>
                  <Text style={estilos.fecharPainel}>×</Text>
                </Pressable>
              </View>
              <Text style={estilos.suave}>{naoLidas} não lidas</Text>
              {erro ? <Text accessibilityRole="alert" style={estilos.erro}>{erro}</Text> : null}
              {!erro && !notificacoes.length ? <Text style={estilos.suave}>Nenhuma notificação.</Text> : null}
              <ScrollView style={estilos.listaNotificacoes} nestedScrollEnabled>{notificacoes.map(itemNotificacao)}</ScrollView>
              {temMais ? (
                <Pressable accessibilityRole="button" disabled={carregandoMais} onPress={carregarMais}>
                  <Text style={estilos.link}>{carregandoMais ? 'Carregando…' : 'Carregar mais notificações'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={estilos.painelNotificacoes}>
              <Text style={estilos.rotulo}>Notificações recentes</Text>
              <ScrollView style={estilos.listaRecentes} nestedScrollEnabled>{recentes.map(itemNotificacao)}</ScrollView>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  acoesCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 12 },
  botaoNovo: { backgroundColor: cores.dourado, borderRadius: raio.botao, minHeight: 36, justifyContent: 'center', paddingHorizontal: 12 },
  botaoNovoCompacto: { paddingHorizontal: 8 },
  botaoNovoTexto: { color: cores.marinho, fontSize: 13, fontWeight: '700' },
  botaoNovoTextoCompacto: { fontSize: 11 },
  sino: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sinoDestacado: { backgroundColor: cores.dourado },
  sinoFallback: { fontSize: 22, color: cores.branco },
  sinoContador: { position: 'absolute', top: -5, right: -7, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, backgroundColor: cores.erro, alignItems: 'center', justifyContent: 'center' },
  sinoContadorTexto: { color: cores.branco, fontSize: 11, fontWeight: '800' },
  flutuante: { position: 'absolute', top: 64, right: 16, zIndex: 10 },
  painelNotificacoes: { backgroundColor: cores.branco, borderColor: cores.borda, borderWidth: 1, borderRadius: raio.card, padding: 14, gap: 5, elevation: 8 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  secao: { color: cores.marinho, fontSize: 20, fontWeight: '700' },
  rotulo: { color: cores.marinho, fontWeight: '700', fontSize: 13 },
  suave: { color: cores.textoSuave, fontSize: 12 },
  link: { color: cores.dourado, fontWeight: '700', fontSize: 14 },
  erro: { color: cores.erro, backgroundColor: cores.erroFundo, padding: 12, borderRadius: raio.campo },
  listaNotificacoes: { maxHeight: 420 },
  listaRecentes: { maxHeight: 260 },
  fecharPainel: { color: cores.marinho, fontSize: 26, fontWeight: '600', paddingHorizontal: 8 },
  notificacao: { borderTopColor: cores.borda, borderTopWidth: 1, paddingTop: 10, marginTop: 8, gap: 5 },
  notificacaoNova: { borderLeftWidth: 3, borderLeftColor: cores.dourado, paddingLeft: 10 },
  notificacaoCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' },
  notificacaoTitulo: { color: cores.marinho, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  notificacaoData: { color: cores.textoSuave, fontSize: 11 },
});
