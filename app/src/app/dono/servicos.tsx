import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Botao from '../../components/Botao';
import Campo from '../../components/Campo';
import Card from '../../components/Card';
import SeloStatus from '../../components/SeloStatus';
import { api, ErroApi } from '../../api/cliente';
import { cores } from '../../theme';

type Servico = { id: string; nome: string; preco: number; ativo: boolean };

type Aviso = { texto: string; erro: boolean } | null;

function lerPreco(texto: string) {
  const n = Number(texto.replace(',', '.'));
  return texto !== '' && !isNaN(n) && n > 0 ? n : null;
}

function mostrarPreco(preco: number) {
  return preco.toFixed(2).replace('.', ',');
}

export default function Servicos() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [precos, setPrecos] = useState<Record<string, string>>({});
  const [novoNome, setNovoNome] = useState('');
  const [novoPreco, setNovoPreco] = useState('');
  const [aviso, setAviso] = useState<Aviso>(null);
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);

  function avisar(texto: string, erro = false) {
    setAviso({ texto, erro });
    rolagem.current?.scrollTo({ y: 0, animated: true });
  }

  function mostrarErro(e: unknown) {
    avisar(e instanceof ErroApi ? e.message : 'Não consegui falar com a API.', true);
  }

  function preencher(lista: Servico[]) {
    setServicos(lista);
    const valores: Record<string, string> = {};
    lista.forEach((s) => (valores[s.id] = mostrarPreco(s.preco)));
    setPrecos(valores);
  }

  useEffect(() => {
    api.get<Servico[]>('/servicos').then(preencher)
      .catch((e) => setAviso({ texto: e instanceof ErroApi ? e.message : 'Não consegui falar com a API.', erro: true }));
  }, []);

  async function salvarPreco(servico: Servico) {
    const preco = lerPreco(precos[servico.id]);
    if (preco === null) return avisar('Informe um preço válido.', true);
    try {
      await api.patch(`/servicos/${servico.id}`, { preco });
      setServicos(servicos.map((s) => (s.id === servico.id ? { ...s, preco } : s)));
      avisar(`Preço de ${servico.nome} salvo.`);
    } catch (e) {
      mostrarErro(e);
    }
  }

  async function alternarAtivo(servico: Servico) {
    try {
      await api.patch(`/servicos/${servico.id}`, { ativo: !servico.ativo });
      setServicos(servicos.map((s) => (s.id === servico.id ? { ...s, ativo: !s.ativo } : s)));
      avisar(`${servico.nome} ${servico.ativo ? 'desativado' : 'ativado'}.`);
    } catch (e) {
      mostrarErro(e);
    }
  }

  async function adicionar() {
    const preco = lerPreco(novoPreco);
    if (!novoNome.trim() || preco === null) return avisar('Preencha o nome e um preço válido.', true);
    try {
      const criado = await api.post<Servico>('/servicos', { nome: novoNome.trim(), preco });
      setServicos([...servicos, criado]);
      setPrecos({ ...precos, [criado.id]: mostrarPreco(criado.preco) });
      setNovoNome('');
      setNovoPreco('');
      avisar(`${criado.nome} adicionado.`);
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

      <Card>
        <Text style={estilos.titulo}>Novo serviço</Text>
        <Campo rotulo="Nome" valor={novoNome} onChangeText={setNovoNome} placeholder="Ex.: Sobrancelha" />
        <Campo rotulo="Preço (R$)" valor={novoPreco} onChangeText={setNovoPreco} keyboardType="numeric" placeholder="0,00" />
        <Botao titulo="Adicionar serviço" onPress={adicionar} />
      </Card>

      <Text style={estilos.secao}>Serviços ({servicos.length})</Text>
      {servicos.map((s) => (
        <Card key={s.id} style={s.ativo ? undefined : { opacity: 0.6 }}>
          <View style={estilos.linha}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.titulo}>{s.nome}</Text>
              <Text style={estilos.preco}>R$ {mostrarPreco(s.preco)}</Text>
            </View>
            <SeloStatus tipo={s.ativo ? 'ativo' : 'inativo'} />
          </View>
          <Campo
            rotulo="Novo preço (R$)"
            valor={precos[s.id] ?? ''}
            onChangeText={(t) => setPrecos({ ...precos, [s.id]: t })}
            keyboardType="numeric"
          />
          <View style={estilos.linha}>
            <View style={{ flex: 1 }}>
              <Botao
                titulo={s.ativo ? 'Desativar' : 'Ativar'}
                variante={s.ativo ? 'perigo' : 'secundario'}
                onPress={() => alternarAtivo(s)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Botao titulo="Salvar preço" variante="secundario" onPress={() => salvarPreco(s)} />
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  secao: { fontSize: 20, fontWeight: '700', color: cores.marinho, marginTop: 4 },
  titulo: { fontSize: 17, fontWeight: '600', color: cores.texto },
  preco: { fontSize: 22, fontWeight: '700', color: cores.dourado, marginTop: 2 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aviso: { padding: 12, borderRadius: 12 },
  avisoOk: { backgroundColor: cores.okFundo },
  avisoErro: { backgroundColor: cores.erroFundo },
});
