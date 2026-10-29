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
      <Tabs.Screen name="atendimentos" options={{ title: 'Atendimentos' }} />
    </Tabs>
  );
}
