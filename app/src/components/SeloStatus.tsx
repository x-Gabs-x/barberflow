import { Text, View, StyleSheet } from 'react-native';
import { cores } from '../theme';

const tipos = {
  registrado: { texto: 'Registrado', fundo: cores.avisoFundo, cor: cores.aviso },
  validado: { texto: 'Validado', fundo: cores.infoFundo, cor: cores.info },
  pendente: { texto: 'Pendente', fundo: cores.erroFundo, cor: cores.erro },
  aguardando: { texto: 'Aguardando', fundo: cores.avisoFundo, cor: cores.aviso },
  ativo: { texto: 'Ativo', fundo: cores.okFundo, cor: cores.ok },
  inativo: { texto: 'Inativo', fundo: '#E6E9EE', cor: cores.textoSuave },
};

export default function SeloStatus({ tipo }: { tipo: keyof typeof tipos }) {
  const t = tipos[tipo];
  return (
    <View style={[estilos.selo, { backgroundColor: t.fundo }]}>
      <Text style={[estilos.texto, { color: t.cor }]}>{t.texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  selo: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  texto: { fontSize: 12, fontWeight: '600' },
});