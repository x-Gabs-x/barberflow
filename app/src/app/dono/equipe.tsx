import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Botao from '../../components/Botao';
import Card from '../../components/Card';
import SeloStatus from '../../components/SeloStatus';
import { api, ErroApi } from '../../api/cliente';
import { cores } from '../../theme';

type Membro = {
  id: string;
  usuario: { id: string; nome_completo: string };
  perfil: 'dono' | 'parceiro' | 'recepcao';
  escote_percentual: number | null;
  status: 'ativo' | 'aguardando';
};

type Aviso = { texto: string; erro: boolean } | null;

const nomesPerfil = { dono: 'Dono', parceiro: 'Parceiro', recepcao: 'Recepção' };

function iniciais(nome: string) {
  const partes = nome.trim().split(' ');
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

function Cabecalho({ membro, status }: { membro: Membro; status: 'ativo' | 'aguardando' }) {
  return (
    <View style={estilos.linha}>
      <View style={estilos.avatar}>
        <Text style={estilos.avatarTexto}>{iniciais(membro.usuario.nome_completo)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={estilos.nome}>{membro.usuario.nome_completo}</Text>
        <Text style={estilos.suave}>{nomesPerfil[membro.perfil]}</Text>
      </View>
      <SeloStatus tipo={status} />
    </View>
  );
}

export default function Equipe() {
  const [equipe, setEquipe] = useState<Membro[]>([]);
  const [pedidos, setPedidos] = useState<Membro[]>([]);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState<string | null>(null);
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);

  function avisar(texto: string, erro = false) {
    setAviso({ texto, erro });
    rolagem.current?.scrollTo({ y: 0, animated: true });
  }

  function mostrarErro(e: unknown) {
    avisar(e instanceof ErroApi ? e.message : 'Não consegui falar com a API.', true);
  }

  function preencher(ativos: Membro[], aguardando: Membro[]) {
    setEquipe(ativos);
    setPedidos(aguardando);
  }

  useEffect(() => {
    Promise.all([api.get<Membro[]>('/equipe'), api.get<Membro[]>('/equipe/pedidos')])
      .then(([ativos, aguardando]) => preencher(ativos, aguardando))
      .catch((e) => setAviso({ texto: e instanceof ErroApi ? e.message : 'Não consegui falar com a API.', erro: true }));
  }, []);

  async function aprovar(pedido: Membro) {
    try {
      await api.post(`/equipe/pedidos/${pedido.id}/aprovar`);
      setPedidos(pedidos.filter((p) => p.id !== pedido.id));
      setEquipe([...equipe, { ...pedido, status: 'ativo', escote_percentual: pedido.perfil === 'dono' ? 100 : pedido.perfil === 'parceiro' ? 40 : null }]);
      avisar(`${pedido.usuario.nome_completo} entrou na equipe.`);
    } catch (e) {
      mostrarErro(e);
    }
  }

  async function recusar(pedido: Membro) {
    try {
      await api.post(`/equipe/pedidos/${pedido.id}/recusar`);
      setPedidos(pedidos.filter((p) => p.id !== pedido.id));
      avisar(`Pedido de ${pedido.usuario.nome_completo} recusado.`);
    } catch (e) {
      mostrarErro(e);
    }
  }

  async function remover(membro: Membro) {
    if (confirmarRemocao !== membro.id) {
      return setConfirmarRemocao(membro.id);
    }
    setConfirmarRemocao(null);
    try {
      await api.delete(`/equipe/${membro.id}`);
      setEquipe(equipe.filter((m) => m.id !== membro.id));
      avisar(`${membro.usuario.nome_completo} foi removido da equipe.`);
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

      <Text style={estilos.secao}>Pedidos de entrada ({pedidos.length})</Text>
      {pedidos.length === 0 ? (
        <Card>
          <Text style={estilos.suave}>Nenhum pedido aguardando.</Text>
        </Card>
      ) : null}
      {pedidos.map((p) => (
        <Card key={p.id}>
          <Cabecalho membro={p} status="aguardando" />
          {p.perfil === 'parceiro' ? (
            <Text style={estilos.suave}>Escote definido automaticamente: 40% para o barbeiro.</Text>
          ) : null}
          <View style={estilos.linha}>
            <View style={{ flex: 1 }}>
              <Botao titulo="Recusar" variante="perigo" onPress={() => recusar(p)} />
            </View>
            <View style={{ flex: 1 }}>
              <Botao titulo="Aprovar" onPress={() => aprovar(p)} />
            </View>
          </View>
        </Card>
      ))}

      <Text style={estilos.secao}>Equipe ({equipe.length})</Text>
      {equipe.map((m) => (
        <Card key={m.id}>
          <Cabecalho membro={m} status="ativo" />
          {m.perfil === 'parceiro' ? (
            <Text style={estilos.suave}>Fica com 40% · Barbearia 60%</Text>
          ) : m.perfil === 'dono' ? (
            <Text style={estilos.suave}>Quando atende como barbeiro, fica com 100% do valor.</Text>
          ) : null}
          <View style={estilos.linha}>
            {m.perfil !== 'dono' ? (
              <View style={{ flex: 1 }}>
                <Botao
                  titulo={confirmarRemocao === m.id ? 'Confirmar' : 'Remover'}
                  variante="perigo"
                  onPress={() => remover(m)}
                />
              </View>
            ) : null}
          </View>
          {confirmarRemocao === m.id ? (
            <Text style={{ color: cores.erro, fontSize: 13 }}>
              Toque em Confirmar para remover {m.usuario.nome_completo} da equipe.
            </Text>
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  secao: { fontSize: 20, fontWeight: '700', color: cores.marinho, marginTop: 4 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: cores.marinho,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTexto: { color: cores.dourado, fontWeight: '700', fontSize: 16 },
  nome: { fontSize: 17, fontWeight: '600', color: cores.texto },
  suave: { fontSize: 14, color: cores.textoSuave },
  aviso: { padding: 12, borderRadius: 12 },
  avisoOk: { backgroundColor: cores.okFundo },
  avisoErro: { backgroundColor: cores.erroFundo },
});
