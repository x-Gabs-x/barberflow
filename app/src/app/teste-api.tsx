import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import Botao from '../components/Botao';
import Card from '../components/Card';
import { api, definirSessao, ErroApi, URL_API } from '../api/cliente';
import { cores } from '../theme';

export default function TesteApi() {
  const [resultado, setResultado] = useState('Toque em um botão.');

  async function testar(perfil: string | null, caminho: string) {
    definirSessao({ perfilDeTeste: perfil });
    setResultado('Carregando...');
    try {
      const dados = await api.get(caminho);
      setResultado(JSON.stringify(dados, null, 2));
    } catch (e) {
      if (e instanceof ErroApi) {
        setResultado(`Erro ${e.status} (${e.codigo}): ${e.message}`);
      } else {
        setResultado('Não consegui falar com a API. Ela está rodando? O celular está na mesma rede?');
      }
    }
  }

  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: 20, gap: 12, paddingTop: 60 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: cores.marinho }}>Teste da API</Text>
      <Text style={{ color: cores.textoSuave }}>API em: {URL_API}</Text>
      <Botao titulo="Parceiro vê a agenda" variante="secundario" onPress={() => testar('parceiro', '/agenda')} />
      <Botao titulo="Recepção vê a agenda" variante="secundario" onPress={() => testar('recepcao', '/agenda')} />
      <Botao titulo="Dono vê a equipe" variante="secundario" onPress={() => testar('dono', '/equipe')} />
      <Botao titulo="Parceiro vê a equipe" variante="secundario" onPress={() => testar('parceiro', '/equipe')} />
      <Botao titulo="Sem login" variante="secundario" onPress={() => testar(null, '/agenda')} />
      <Card>
        <Text style={{ fontFamily: 'monospace', fontSize: 12, color: cores.texto }}>{resultado}</Text>
      </Card>
    </ScrollView>
  );
}