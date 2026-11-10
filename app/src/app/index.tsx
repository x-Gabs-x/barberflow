import { ScrollView, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Botao from '../components/Botao';
import { cores } from '../theme';
import { definirSessao } from '../api/cliente';

const atalhos: [string, string][] = [
  ['Login', '/acesso/login'],
  ['Criar conta', '/acesso/cadastro'],
  ['Dono: agenda', '/dono/agenda'],
  ['Parceiro: agenda', '/parceiro/agenda'],
  ['Recepção: atendimentos', '/recepcao/atendimentos'],
  ['Componentes', '/componentes'],
  ['Teste da API', '/teste-api'],
];

export default function Menu() {
  const router = useRouter();
  const { atendimentoFinalizado } = useLocalSearchParams<{ atendimentoFinalizado?: string }>();
  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: 20, gap: 12, paddingTop: 60 }}>
      <Text style={{ fontSize: 30, fontWeight: '700', color: cores.marinho }}>BarberFlow</Text>
      <Text style={{ color: cores.textoSuave }}>Menu de desenvolvimento: atalhos para todas as telas.</Text>
      {atendimentoFinalizado === '1' ? (
        <Text accessibilityRole="alert" style={{ color: '#176B45', fontWeight: '700', padding: 12, backgroundColor: '#E8F5EC', borderRadius: 8 }}>
          Procedimento finalizado. Atendimento salvo e enviado para validação.
        </Text>
      ) : null}
      {atalhos.map(([titulo, rota]) => (
        <Botao key={rota} titulo={titulo} variante="secundario" onPress={() => {
          if (rota === '/dono/agenda' || rota === '/parceiro/agenda' || rota === '/recepcao/atendimentos') {
            definirSessao({ token: null, barbearia: null, perfilDeTeste: rota.startsWith('/dono') ? 'dono' : rota.startsWith('/recepcao') ? 'recepcao' : 'parceiro' });
          }
          router.push(rota as any);
        }} />
      ))}
    </ScrollView>
  );
}