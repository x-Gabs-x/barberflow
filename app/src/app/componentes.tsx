import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import Botao from '../components/Botao';
import Campo from '../components/Campo';
import Card from '../components/Card';
import SeloStatus from '../components/SeloStatus';
import { cores } from '../theme';

export default function Componentes() {
  const [cpf, setCpf] = useState('');
  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: 20, gap: 16, paddingTop: 60 }}>
      <Text style={{ fontSize: 30, fontWeight: '700', color: cores.marinho }}>Componentes</Text>
      <Card>
        <Campo rotulo="CPF" valor={cpf} onChangeText={setCpf} keyboardType="numeric" placeholder="000.000.000-00" />
        <Campo rotulo="Senha" valor="" onChangeText={() => {}} secureTextEntry erro="Exemplo de erro" />
      </Card>
      <Card>
        <SeloStatus tipo="registrado" />
        <SeloStatus tipo="validado" />
        <SeloStatus tipo="pendente" />
        <SeloStatus tipo="ativo" />
      </Card>
      <Botao titulo="Entrar" />
      <Botao titulo="Cancelar" variante="secundario" />
      <Botao titulo="Remover" variante="perigo" />
      <Botao titulo="Desabilitado" desabilitado />
    </ScrollView>
  );
}