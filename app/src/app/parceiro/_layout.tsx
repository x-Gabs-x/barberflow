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
      <Tabs.Screen name="novo" options={{ title: 'Atendimento' }} />
    </Tabs>
  );
}
