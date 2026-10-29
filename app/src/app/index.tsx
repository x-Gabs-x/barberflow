import { ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Botao from '../components/Botao';
import { cores } from '../theme';

const atalhos: [string, string][] = [
  ['Login (Parte 2)', '/acesso/login'],
  ['Criar conta (Parte 2)', '/acesso/cadastro'],
  ['Dono: agenda', '/dono/agenda'],
  ['Parceiro: agenda', '/parceiro/agenda'],
  ['Recepção: atendimentos', '/recepcao/atendimentos'],
  ['Componentes', '/componentes'],
];

export default function Menu() {
  const router = useRouter();
  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: 20, gap: 12, paddingTop: 60 }}>
      <Text style={{ fontSize: 30, fontWeight: '700', color: cores.marinho }}>BarberFlow</Text>
      <Text style={{ color: cores.textoSuave }}>Menu de desenvolvimento: atalhos para todas as telas.</Text>
      {atalhos.map(([titulo, rota]) => (
        <Botao key={rota} titulo={titulo} variante="secundario" onPress={() => router.push(rota as any)} />
      ))}
    </ScrollView>
  );
}