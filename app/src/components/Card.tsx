import { View, StyleSheet, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { cores, raio } from '../theme';

export default function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[estilos.card, style]}>{children}</View>;
}

const estilos = StyleSheet.create({
  card: {
    backgroundColor: cores.branco, borderWidth: 1, borderColor: '#D9DEE6',
    borderRadius: raio.card, padding: 16, gap: 10,
  },
});