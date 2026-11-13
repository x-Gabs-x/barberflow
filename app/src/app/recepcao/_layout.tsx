import { Tabs } from 'expo-router';
import NavegacaoOperacional from '../../components/NavegacaoOperacional';

export default function Layout() {
  return (
    <NavegacaoOperacional perfil="recepcao">
      <Tabs.Screen name="atendimentos" options={{ title: 'Atendimentos' }} />
    </NavegacaoOperacional>
  );
}
