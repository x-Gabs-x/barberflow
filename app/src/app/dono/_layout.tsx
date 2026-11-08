import { Tabs } from 'expo-router';
import { cores } from '../../theme';

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: cores.marinho },
        headerTintColor: '#FFFFFF',
        tabBarStyle: { backgroundColor: cores.marinho },
        tabBarActiveTintColor: cores.dourado,
        tabBarInactiveTintColor: '#B9C2D0',
      }}
    >
      <Tabs.Screen name="agenda" options={{ title: 'Agenda' }} />
      <Tabs.Screen name="fechamento" options={{ title: 'Fechamento' }} />
      <Tabs.Screen name="equipe" options={{ title: 'Equipe' }} />
      <Tabs.Screen name="servicos" options={{ title: 'Serviços' }} />
      <Tabs.Screen name="configuracoes" options={{ title: 'Configurações' }} />
    </Tabs>
  );
}
