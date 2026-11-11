import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import AceiteTermos from '../components/AceiteTermos';
import Botao from '../components/Botao';
import Campo from '../components/Campo';
import Card from '../components/Card';
import SeloStatus from '../components/SeloStatus';
import Tabela from '../components/Tabela';
import { cores } from '../theme';

export default function Componentes() {
  const [cpf, setCpf] = useState('');
  const [aceito, setAceito] = useState(false);
  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: 20, gap: 16, paddingTop: 60 }}>
      <Text style={{ fontSize: 30, fontWeight: '700', color: cores.marinho }}>Componentes</Text>
      <Card>
        <Campo rotulo="CPF" valor={cpf} onChangeText={setCpf} keyboardType="numeric" placeholder="000.000.000-00" />
        <Campo rotulo="Senha" valor="" onChangeText={() => {}} secureTextEntry erro="Exemplo de erro" />
        <AceiteTermos
          aceito={aceito}
          onChange={setAceito}
          erro={aceito ? undefined : 'É preciso aceitar os termos e o aviso de privacidade'}
        />
      </Card>
      <Card>
        <SeloStatus tipo="registrado" />
        <SeloStatus tipo="validado" />
        <SeloStatus tipo="pendente" />
        <SeloStatus tipo="ativo" />
      </Card>
      <Text style={{ fontSize: 20, fontWeight: '600', color: cores.marinho }}>Tabela</Text>
      <Tabela
        colunas={[
          { chave: 'nome', titulo: 'Barbeiro', flex: 2 },
          { chave: 'total', titulo: 'Total', alinhar: 'right' },
          { chave: 'status', titulo: 'Situação', alinhar: 'right', flex: 2 },
        ]}
        linhas={[
          { id: 'u7', nome: 'Rafael Souza', total: 'R$ 145,00', status: <SeloStatus tipo="validado" /> },
          { id: 'u8', nome: 'Marcos Lima', total: 'R$ 98,00', status: <SeloStatus tipo="pendente" /> },
        ]}
      />
      <Tabela colunas={[{ chave: 'nome', titulo: 'Barbeiro' }]} linhas={[]} vazio="Nenhum atendimento neste dia." />
      <Botao titulo="Entrar" />
      <Botao titulo="Cancelar" variante="secundario" />
      <Botao titulo="Remover" variante="perigo" />
      <Botao titulo="Desabilitado" desabilitado />
    </ScrollView>
  );
}