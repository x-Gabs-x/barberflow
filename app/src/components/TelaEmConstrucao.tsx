import { View, Text } from 'react-native';
import Card from './Card';
import { cores } from '../theme';

export default function TelaEmConstrucao({ titulo, parte }: { titulo: string; parte: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo, padding: 20, justifyContent: 'center' }}>
      <Card>
        <Text style={{ fontSize: 24, fontWeight: '700', color: cores.marinho }}>{titulo}</Text>
        <Text style={{ fontSize: 15, color: cores.textoSuave }}>Tela em construção ({parte}).</Text>
      </Card>
    </View>
  );
}