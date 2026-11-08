import { Pressable, Text, StyleSheet } from 'react-native';
import { cores, raio } from '../theme';

type Props = {
  titulo: string;
  onPress?: () => void;
  variante?: 'principal' | 'secundario' | 'perigo';
  desabilitado?: boolean;
};

export default function Botao({ titulo, onPress, variante = 'principal', desabilitado }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      style={[estilos.base, estilos[variante], desabilitado && estilos.desabilitado]}
    >
      <Text style={[estilos.texto, variante === 'principal' && { color: cores.marinho }]}>
        {titulo}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: { height: 52, borderRadius: raio.botao, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  principal: { backgroundColor: cores.dourado },
  secundario: { backgroundColor: cores.branco, borderWidth: 1, borderColor: cores.borda },
  perigo: { backgroundColor: cores.branco, borderWidth: 1, borderColor: '#C9A29E' },
  desabilitado: { backgroundColor: '#D9DEE6', borderColor: '#D9DEE6' },
  texto: { fontSize: 16, fontWeight: '600', color: cores.texto },
});