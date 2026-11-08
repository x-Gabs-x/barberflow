import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { cores } from '../theme';

type Props = {
  aceito: boolean;
  onChange: (valor: boolean) => void;
  erro?: string;
};

export default function AceiteTermos({ aceito, onChange, erro }: Props) {
  return (
    <View style={{ gap: 6 }}>
      <View style={estilos.linha}>
        <Pressable
          onPress={() => onChange(!aceito)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: aceito }}
          style={[estilos.caixa, aceito && estilos.marcada, erro ? { borderColor: cores.erro } : null]}
        >
          {aceito ? <Text style={estilos.marca}>✓</Text> : null}
        </Pressable>
        <Text style={estilos.texto}>
          Li e aceito os{' '}
          <Link href="/termos" style={estilos.link}>
            Termos de Uso
          </Link>{' '}
          e o{' '}
          <Link href="/privacidade" style={estilos.link}>
            Aviso de Privacidade
          </Link>
          .
        </Text>
      </View>
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  caixa: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderColor: cores.borda,
    borderRadius: 6,
    backgroundColor: cores.branco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcada: { backgroundColor: cores.dourado, borderColor: cores.dourado },
  marca: { color: cores.branco, fontWeight: '700', fontSize: 15 },
  texto: { flex: 1, fontSize: 14, lineHeight: 20, color: cores.texto },
  link: { color: cores.dourado, fontWeight: '600' },
  erro: { fontSize: 13, color: cores.erro },
});