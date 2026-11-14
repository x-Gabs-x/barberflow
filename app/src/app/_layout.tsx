import { Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SessaoProvider, useSessao } from '../context/SessaoContext';
import { cores } from '../theme';

export default function RootLayout() {
  return <SessaoProvider><Navegador /></SessaoProvider>;
}

function Navegador() {
  const { situacao, tentarNovamente } = useSessao();
  if (situacao === 'carregando' || situacao === 'erro') {
    return <View style={estilos.carregamento}>
      <Text style={estilos.texto}>{situacao === 'carregando' ? 'Verificando sessão…' : 'Não foi possível verificar a sessão.'}</Text>
      {situacao === 'erro' ? <Pressable accessibilityRole="button" onPress={tentarNovamente} style={estilos.botao}>
        <Text style={estilos.botaoTexto}>Tentar novamente</Text>
      </Pressable> : null}
    </View>;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}

const estilos = StyleSheet.create({
  carregamento: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: cores.fundo },
  texto: { color: cores.marinho, fontSize: 16, textAlign: 'center' },
  botao: { backgroundColor: cores.dourado, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 8 },
  botaoTexto: { color: cores.marinho, fontWeight: '700' },
});
