import { View, Text, TextInput, StyleSheet, KeyboardTypeOptions } from 'react-native';
import { cores, raio } from '../theme';

type Props = {
  rotulo: string;
  valor: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  erro?: string;
};

export default function Campo({ rotulo, valor, onChangeText, placeholder, secureTextEntry, keyboardType, erro }: Props) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        value={valor}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={[estilos.campo, erro ? { borderColor: cores.erro } : null]}
      />
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  rotulo: { fontSize: 14, fontWeight: '500', color: cores.textoSuave },
  campo: {
    height: 48, borderWidth: 1, borderColor: cores.borda, borderRadius: raio.campo,
    paddingHorizontal: 14, fontSize: 16, color: cores.texto, backgroundColor: cores.branco,
  },
  erro: { fontSize: 13, color: cores.erro },
});