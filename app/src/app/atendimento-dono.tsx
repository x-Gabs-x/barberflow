import { Redirect, useLocalSearchParams } from 'expo-router';

export default function AtendimentoDonoLegado() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={{ pathname: '/dono/novo', params: id ? { id } : {} }} />;
}
