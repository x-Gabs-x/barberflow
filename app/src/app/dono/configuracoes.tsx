import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Botao from '../../components/Botao';
import Campo from '../../components/Campo';
import Card from '../../components/Card';
import { api, ErroApi } from '../../api/cliente';
import { cores, raio } from '../../theme';

type Barbearia = {
  id: string;
  nome: string;
  codigo: string;
  data_inicio: string | null;
  criada_em: string;
  telefone: string | null;
  cidade: string | null;
  hora_abertura: string;
  hora_fechamento: string;
};

type Aviso = { texto: string; erro: boolean } | null;

const horaValida = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

export default function Configuracoes() {
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [abertura, setAbertura] = useState('');
  const [fechamento, setFechamento] = useState('');
  const [aviso, setAviso] = useState<Aviso>(null);
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);

  function avisar(texto: string, erro = false) {
    setAviso({ texto, erro });
    rolagem.current?.scrollTo({ y: 0, animated: true });
  }

  function mostrarErro(e: unknown) {
    avisar(e instanceof ErroApi ? e.message : 'Não consegui falar com a API.', true);
  }

  function preencher(b: Barbearia) {
    setCodigo(b.codigo);
    setNome(b.nome);
    setTelefone(b.telefone ?? '');
    setCidade(b.cidade ?? '');
    setAbertura(b.hora_abertura);
    setFechamento(b.hora_fechamento);
  }

  useEffect(() => {
    api.get<Barbearia>('/barbearia').then(preencher)
      .catch((e) => setAviso({ texto: e instanceof ErroApi ? e.message : 'Não consegui falar com a API.', erro: true }));
  }, []);

  async function salvar() {
    if (!nome.trim()) return avisar('O nome da barbearia é obrigatório.', true);
    if (!horaValida(abertura) || !horaValida(fechamento)) return avisar('Use o formato HH:MM nos horários.', true);
    if (abertura >= fechamento) return avisar('A abertura deve ser antes do fechamento.', true);
    try {
      const salva = await api.patch<Barbearia>('/barbearia', {
        nome: nome.trim(),
        telefone: telefone.trim() || null,
        cidade: cidade.trim() || null,
        hora_abertura: abertura,
        hora_fechamento: fechamento,
      });
      preencher(salva);
      avisar('Configurações salvas.');
    } catch (e) {
      mostrarErro(e);
    }
  }

  async function novoCodigo() {
    try {
      const r = await api.post<{ codigo: string }>('/barbearia/novo-id');
      setCodigo(r.codigo);
      avisar('Novo código gerado. O código antigo não serve mais.');
    } catch (e) {
      mostrarErro(e);
    }
  }

  return (
    <ScrollView ref={rolagem} style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      {aviso ? (
        <View style={[estilos.aviso, aviso.erro ? estilos.avisoErro : estilos.avisoOk]}>
          <Text style={{ color: aviso.erro ? cores.erro : cores.ok, fontWeight: '500' }}>{aviso.texto}</Text>
        </View>
      ) : null}

      <View style={estilos.cartaoCodigo}>
        <Text style={{ color: '#B9C2D0', fontSize: 14 }}>Código da barbearia</Text>
        <Text style={estilos.codigo}>{codigo}</Text>
        <Text style={{ color: '#B9C2D0', fontSize: 13 }}>Passe este código para a equipe pedir entrada.</Text>
        <Botao titulo="Gerar novo código" variante="secundario" onPress={novoCodigo} />
      </View>

      <Card>
        <Text style={estilos.titulo}>Dados da barbearia</Text>
        <Campo rotulo="Nome" valor={nome} onChangeText={setNome} />
        <Campo rotulo="Telefone" valor={telefone} onChangeText={setTelefone} keyboardType="phone-pad" placeholder="(83) 90000-0000" />
        <Campo rotulo="Cidade" valor={cidade} onChangeText={setCidade} />
      </Card>

      <Card>
        <Text style={estilos.titulo}>Horário de funcionamento</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Abre às" valor={abertura} onChangeText={setAbertura} placeholder="08:00" />
          </View>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Fecha às" valor={fechamento} onChangeText={setFechamento} placeholder="19:00" />
          </View>
        </View>
      </Card>

      <Botao titulo="Salvar configurações" onPress={salvar} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  titulo: { fontSize: 17, fontWeight: '600', color: cores.marinho },
  cartaoCodigo: { backgroundColor: cores.marinho, borderRadius: raio.card, padding: 20, gap: 8 },
  codigo: { color: cores.dourado, fontSize: 28, fontWeight: '700', letterSpacing: 2 },
  aviso: { padding: 12, borderRadius: 12 },
  avisoOk: { backgroundColor: cores.okFundo },
  avisoErro: { backgroundColor: cores.erroFundo },
});
