import { Tabs } from 'expo-router';
import NavegacaoOperacional from '../../components/NavegacaoOperacional';

export default function Layout() {
  return (
    <NavegacaoOperacional perfil="parceiro">
      <Tabs.Screen name="agenda" options={{ title: 'Agenda' }} />
      <Tabs.Screen name="novo" options={{ title: 'Atendimento', href: null }} />
    </NavegacaoOperacional>
  );
}
