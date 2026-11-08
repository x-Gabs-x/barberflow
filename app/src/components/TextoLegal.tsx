import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { cores } from '../theme';
import type { Secao } from '../legal/textos';

type Props = {
  titulo: string;
  introducao?: string;
  secoes: Secao[];
};

export default function TextoLegal({ titulo, introducao, secoes }: Props) {
  const router = useRouter();

  function voltar() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={estilos.conteudo}>
      <Pressable onPress={voltar}>
        <Text style={estilos.voltar}>‹ Voltar</Text>
      </Pressable>
      <Text style={estilos.titulo}>{titulo}</Text>
      {introducao ? <Text style={estilos.paragrafo}>{introducao}</Text> : null}
      {secoes.map((secao) => (
        <View key={secao.titulo} style={{ gap: 6 }}>
          <Text style={estilos.subtitulo}>{secao.titulo}</Text>
          {secao.texto ? <Text style={estilos.paragrafo}>{secao.texto}</Text> : null}
          {secao.itens?.map((item) => (
            <Text key={item.destaque} style={estilos.paragrafo}>
              {'• '}
              <Text style={{ fontWeight: '600' }}>{item.destaque}</Text> {item.texto}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  conteudo: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
    gap: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  voltar: { fontSize: 15, fontWeight: '600', color: cores.dourado },
  titulo: { fontSize: 28, fontWeight: '700', color: cores.marinho },
  subtitulo: { fontSize: 17, fontWeight: '600', color: cores.marinho },
  paragrafo: { fontSize: 15, lineHeight: 22, color: cores.texto },
});