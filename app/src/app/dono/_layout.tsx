import { Tabs } from 'expo-router';
import NavegacaoOperacional from '../../components/NavegacaoOperacional';

export default function Layout() {
  return (
    <NavegacaoOperacional perfil="dono">
      <Tabs.Screen name="agenda" options={{ title: 'Agenda' }} />
      <Tabs.Screen name="fechamento" options={{ title: 'Fechamento' }} />
      <Tabs.Screen name="equipe" options={{ title: 'Equipe' }} />
      <Tabs.Screen name="servicos" options={{ title: 'Serviços' }} />
      <Tabs.Screen name="configuracoes" options={{ title: 'Configurações' }} />
      <Tabs.Screen name="novo" options={{ title: 'Atendimento', href: null }} />
    </NavegacaoOperacional>
  );
}
