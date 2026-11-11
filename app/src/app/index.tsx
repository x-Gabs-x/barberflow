import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

const linhas = Array.from({ length: 34 }, (_, index) => index);

export default function TelaInicial() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const telaLarga = width >= 820;
  const larguraTitulo = Math.max(220, width - 88);
  const tamanhoTitulo = telaLarga ? 66 : Math.min(46, larguraTitulo * 0.105);

  return (
    <View style={[estilos.tela, telaLarga ? estilos.ladoALado : estilos.empilhada]}>
      <StatusBar style="light" />

      <View style={[estilos.painelBoasVindas, telaLarga ? estilos.painelLargo : estilos.painelMovel]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={StyleSheet.absoluteFill}>
            {linhas.map((linha) => (
              <View key={linha} style={[estilos.linhaTextura, { top: linha * 19 - 180 }]} />
            ))}
          </View>
          <View style={estilos.faixaDourada} />
          <View style={estilos.faixaDouradaFina} />
        </View>

        <View style={estilos.conteudo}>
          <View style={estilos.titulo}>
            <Text
              style={[estilos.tituloPrincipal, { fontSize: tamanhoTitulo, lineHeight: tamanhoTitulo * 1.12 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              Sua Barbearia
            </Text>
            <Text
              style={[estilos.tituloDourado, { fontSize: tamanhoTitulo * (telaLarga ? 1.1 : 0.92), lineHeight: tamanhoTitulo * 1.12 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              no controle
            </Text>
          </View>

          <View style={[estilos.acoes, telaLarga ? estilos.acoesLargas : estilos.acoesMoveis]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/acesso/login')}
              style={({ pressed }) => [estilos.botao, pressed && estilos.botaoPressionado]}
            >
              <Text style={estilos.textoBotao}>Entrar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/acesso/cadastro')}
              style={({ pressed }) => [estilos.botao, estilos.botaoCadastro, pressed && estilos.botaoPressionado]}
            >
              <Text style={estilos.textoBotao}>Criar conta</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={[estilos.painelFoto, telaLarga ? estilos.fotoLarga : { height: height < 700 ? '32%' : '36%' }]}>
        <Image
          source={require('../../assets/images/barbearia-hero.png')}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Barbeiro com corte degradê"
        />
        <View style={estilos.marcaFoto}>
          <Text style={[estilos.nomeMarca, { fontSize: telaLarga ? 48 : 30 }]}>
            <Text style={estilos.barber}>BARBER</Text>
            <Text style={estilos.flow}>FLOW</Text>
          </Text>
          <Text style={[estilos.slogan, telaLarga ? estilos.sloganLargo : estilos.sloganMovel]}>
            Atendimentos, validação e fechamento no dia em um só lugar
          </Text>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#080B10', overflow: 'hidden' },
  ladoALado: { flexDirection: 'row' },
  empilhada: { flexDirection: 'column-reverse' },
  painelBoasVindas: { position: 'relative', backgroundColor: '#080B10', overflow: 'hidden', justifyContent: 'center' },
  painelLargo: { flex: 1.37 },
  painelMovel: { flex: 1, paddingHorizontal: 24 },
  linhaTextura: {
    position: 'absolute',
    left: '-35%',
    width: '170%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    transform: [{ rotate: '45deg' }],
  },
  faixaDourada: {
    position: 'absolute',
    left: '-28%',
    bottom: '17%',
    width: '160%',
    height: 74,
    backgroundColor: 'rgba(178,124,43,0.46)',
    transform: [{ rotate: '-25deg' }],
  },
  faixaDouradaFina: {
    position: 'absolute',
    left: '-28%',
    bottom: '25%',
    width: '160%',
    height: 16,
    backgroundColor: 'rgba(211,166,91,0.35)',
    transform: [{ rotate: '-25deg' }],
  },
  conteudo: { width: '100%', alignItems: 'center', justifyContent: 'center', zIndex: 1, paddingHorizontal: 12 },
  titulo: { width: '100%', maxWidth: 650, alignItems: 'center' },
  tituloPrincipal: {
    width: '100%',
    color: '#FFFFFF',
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -2,
    textAlign: 'center',
    includeFontPadding: false,
  },
  tituloDourado: {
    width: '100%',
    color: '#C58B2B',
    fontFamily: 'cursive',
    fontStyle: 'italic',
    fontWeight: '800',
    textAlign: 'center',
    marginTop: -8,
    includeFontPadding: false,
  },
  acoes: { alignItems: 'center' },
  acoesLargas: { marginTop: 64, gap: 48 },
  acoesMoveis: { marginTop: 30, gap: 18 },
  botao: {
    width: 194,
    minHeight: 48,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#A96F26',
  },
  botaoCadastro: { width: 210 },
  botaoPressionado: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  textoBotao: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', fontStyle: 'italic' },
  painelFoto: { position: 'relative', overflow: 'hidden', backgroundColor: '#080B10' },
  fotoLarga: { flex: 1 },
  marcaFoto: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: '18%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,11,16,0.96)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  nomeMarca: { letterSpacing: -1, fontWeight: '300' },
  barber: { color: '#FFFFFF', fontWeight: '300' },
  flow: { color: '#2186F5', fontWeight: '800' },
  slogan: { color: '#FFFFFF', fontStyle: 'italic', textAlign: 'center' },
  sloganLargo: { fontSize: 13 },
  sloganMovel: { fontSize: 10 },
});
