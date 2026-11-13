import { useLocalSearchParams } from 'expo-router';
import RecepcaoAtendimentos from '../../components/RecepcaoAtendimentos';

export default function Tela() {
  const { id, data } = useLocalSearchParams<{ id?: string; data?: string }>();
  return <RecepcaoAtendimentos key={`${data || ''}-${id || ''}`} atendimentoInicial={id} dataInicial={data} />;
}
