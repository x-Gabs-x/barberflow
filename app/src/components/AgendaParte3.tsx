import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Botao from './Botao';
import Card from './Card';
import { cores, raio } from '../theme';
import { AgendaDia, MembroEquipe, Perfil, dataLocal, diaPorExtenso, dinheiro, horaLocal, mensagemErro, mudarDia, parte3Api, statusNome } from '../api/parte3';

type Props = { perfil: Perfil };

export default function AgendaParte3({ perfil }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [dia, setDia] = useState(dataLocal());
  const [agenda, setAgenda] = useState<AgendaDia | null>(null);
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [filtro, setFiltro] = useState('todos');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);
  const largura = width >= 720;

  useFocusEffect(useCallback(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    const agendaP = parte3Api.agenda(dia);
    const equipeP = perfil === 'dono' ? parte3Api.equipe().catch(() => []) : Promise.resolve([]);
    Promise.all([agendaP, equipeP])
      .then(([dados, membros]) => {
        if (!ativo) return;
        setAgenda(dados);
        setEquipe(membros);
      })
      .catch((e) => { if (ativo) setErro(mensagemErro(e)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [dia, perfil, versao]));

  const todos = agenda?.atendimentos || [];
  const filtrados = filtro === 'todos' ? todos : todos.filter((a) => a.barbeiro.id === filtro);
  const equipeComAtendimentos = equipe.filter((m) => todos.some((a) => a.barbeiro.id === m.usuario.id));
  const encerrados = filtrados.filter((a) => !['em_andamento', 'rejeitado'].includes(a.status));
  const total = encerrados.reduce((ac, a) => ac + a.valor_total, 0);
  const atendimentoEmAndamentoNaLista = todos.find((a) => a.id === agenda?.em_andamento?.id);
  const emAndamento = atendimentoEmAndamentoNaLista
    ? atendimentoEmAndamentoNaLista.status === 'em_andamento' ? atendimentoEmAndamentoNaLista : null
    : agenda?.em_andamento?.status === 'em_andamento' ? agenda.em_andamento : null;
  const abrir = (id?: string) => router.push({ pathname: perfil === 'dono' ? '/dono/novo' : '/parceiro/novo', params: id ? { id } : {} });

  return (
    <ScrollView style={estilos.fundo} contentContainerStyle={estilos.pagina} keyboardShouldPersistTaps="handled">
      <View style={estilos.cabecalho}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={estilos.marca}>BARBERFLOW  /  OPERAÇÃO</Text>
          <Text style={estilos.titulo}>{perfil === 'dono' ? 'Agenda da barbearia' : 'Minha agenda'}</Text>
          <Text style={estilos.subtitulo}>Acompanhe os atendimentos e organize o dia.</Text>
        </View>
      </View>

      {agenda?.demonstracao ? <Text style={estilos.demo}>AMBIENTE DE TESTE · Os atendimentos ficam somente na memória e não são gravados no Supabase.</Text> : null}
      {erro ? <Text accessibilityRole="alert" style={estilos.erro}>{erro}</Text> : null}
      <Card>
        <View style={estilos.linha}>
          <Pressable accessibilityRole="button" accessibilityLabel="Dia anterior" style={estilos.mudarDia} onPress={() => setDia(mudarDia(dia, -1))}><Text style={estilos.botaoSeta}>‹</Text></Pressable>
          <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <Text style={estilos.data}>{diaPorExtenso(dia)}</Text>
            <Text style={estilos.suave}>{agenda ? `${agenda.hora_abertura} – ${agenda.hora_fechamento}` : 'Carregando horários'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Próximo dia" style={estilos.mudarDia} onPress={() => setDia(mudarDia(dia, 1))}><Text style={estilos.botaoSeta}>›</Text></Pressable>
        </View>
        <View style={estilos.linhaCentral}>
          <Pressable onPress={() => setDia(dataLocal())}><Text style={estilos.link}>Ir para hoje</Text></Pressable>
          <Pressable onPress={() => setVersao((a) => a + 1)}><Text style={estilos.link}>Atualizar ↻</Text></Pressable>
        </View>
      </Card>

      {perfil === 'dono' && equipeComAtendimentos.length > 0 ? (
        <View style={estilos.grupo}>
          <Text style={estilos.rotulo}>Filtrar por profissional</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.filtros}>
            {[{ id: 'todos', nome: 'Todos' }, ...equipeComAtendimentos.filter((m) => m.perfil !== 'recepcao' && m.status === 'ativo').map((m) => ({ id: m.usuario.id, nome: m.usuario.nome_completo }))].map((opcao) => (
              <Pressable key={opcao.id} onPress={() => setFiltro(opcao.id)} style={[estilos.pilula, filtro === opcao.id && estilos.pilulaSelecionada]}>
                <Text style={[estilos.pilulaTexto, filtro === opcao.id && estilos.pilulaTextoSelecionada]}>{opcao.nome}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={[estilos.resumo, largura && estilos.resumoLargo]}>
        <View style={estilos.metricas}><Text style={estilos.metricasRotulo}>ATENDIMENTOS</Text><Text style={estilos.metricasNumero}>{filtrados.length}</Text></View>
        <View style={estilos.metricas}><Text style={estilos.metricasRotulo}>CORTES ENCERRADOS</Text><Text style={estilos.metricasNumero}>{encerrados.length}</Text></View>
        <View style={estilos.metricas}><Text style={estilos.metricasRotulo}>TOTAL REGISTRADO</Text><Text style={estilos.metricasNumero}>{dinheiro(total)}</Text></View>
      </View>

      {emAndamento && (filtro === 'todos' || filtro === emAndamento.barbeiro.id) ? (
        <Card style={{ borderColor: cores.dourado, borderWidth: 2 }}>
          <View style={estilos.linha}><Text style={estilos.rotulo}>● EM ANDAMENTO</Text><Text style={estilos.suave}>Iniciado às {horaLocal(emAndamento.inicio)}</Text></View>
          <Text style={estilos.nome}>{emAndamento.cliente?.nome_completo || 'Cliente ainda não selecionado'}</Text>
          <Botao titulo="Continuar meu atendimento" onPress={() => abrir(emAndamento.id)} />
        </Card>
      ) : null}

      <View style={estilos.linha}>
        <Text style={estilos.secao}>Atendimentos do dia</Text>
        {carregando ? <ActivityIndicator color={cores.dourado} /> : null}
      </View>
      {!carregando && !filtrados.length ? (
        <Card><Text style={estilos.vazio}>Nenhum atendimento registrado nesta data.</Text><Text style={estilos.suave}>Inicie um atendimento para ele aparecer na agenda.</Text></Card>
      ) : null}
      {filtrados.map((a) => (
        <Card key={a.id}>
          <View style={estilos.linha}>
            <View style={estilos.horario}><Text style={estilos.horarioTexto}>{horaLocal(a.inicio)}</Text><Text style={estilos.horarioDetalhe}>{a.fim ? horaLocal(a.fim) : 'em curso'}</Text></View>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={estilos.nome}>{a.cliente?.nome_completo || 'Cliente não informado'}</Text>
              {perfil === 'dono' ? <Text style={estilos.suave}>Profissional: {a.barbeiro.nome_completo}</Text> : null}
              <Text style={estilos.suave}>{a.servicos.length ? a.servicos.map((s) => s.nome).join(' + ') : 'Serviços não selecionados'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 7 }}><Text style={estilos.valor}>{dinheiro(a.valor_total)}</Text><Text style={estilos.status}>{statusNome(a.status)}</Text></View>
          </View>
          <View style={estilos.rodape}>
            <Text style={estilos.suave}>{a.comprovante_anexado ? '✓ Comprovante anexado' : 'Sem comprovante'}</Text>
            {a.status === 'em_andamento' && (perfil === 'parceiro' || a.id === agenda?.em_andamento?.id) ? (
              <Pressable onPress={() => abrir(a.id)}><Text style={estilos.link}>Continuar →</Text></Pressable>
            ) : a.status !== 'em_andamento' ? (
              <Pressable accessibilityRole="button" onPress={() => abrir(a.id)}><Text style={estilos.link}>Ver atendimento →</Text></Pressable>
            ) : null}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  pagina: { width: '100%', maxWidth: 1080, alignSelf: 'center', padding: 20, gap: 18, paddingBottom: 48 },
  cabecalho: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, paddingVertical: 8 },
  marca: { color: cores.dourado, letterSpacing: 2, fontSize: 11, fontWeight: '800' },
  titulo: { fontSize: 27, fontWeight: '800', color: cores.marinho },
  subtitulo: { fontSize: 14, color: cores.textoSuave },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between' },
  linhaCentral: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26 },
  mudarDia: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundo, borderRadius: raio.campo },
  botaoSeta: { color: cores.marinho, fontWeight: '600', fontSize: 28 },
  data: { color: cores.marinho, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  suave: { color: cores.textoSuave, fontSize: 12 },
  link: { color: cores.dourado, fontWeight: '700', fontSize: 14 },
  grupo: { gap: 8 }, rotulo: { color: cores.marinho, fontWeight: '700', fontSize: 13 },
  filtros: { flexDirection: 'row', gap: 8 },
  pilula: { borderColor: cores.borda, borderWidth: 1, borderRadius: 24, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: cores.branco },
  pilulaSelecionada: { backgroundColor: cores.marinho, borderColor: cores.marinho },
  pilulaTexto: { color: cores.textoSuave, fontSize: 13 }, pilulaTextoSelecionada: { color: cores.branco, fontWeight: '700' },
  resumo: { gap: 12 }, resumoLargo: { flexDirection: 'row' },
  metricas: { flex: 1, minWidth: 140, backgroundColor: cores.branco, borderWidth: 1, borderColor: cores.borda, borderRadius: raio.card, padding: 18, gap: 8 },
  metricasRotulo: { color: cores.textoSuave, fontSize: 11, letterSpacing: 1, fontWeight: '700' },
  metricasNumero: { color: cores.marinho, fontSize: 22, fontWeight: '800' },
  secao: { color: cores.marinho, fontSize: 20, fontWeight: '700' },
  vazio: { color: cores.marinho, fontWeight: '600', fontSize: 15 },
  horario: { alignItems: 'center', justifyContent: 'center', minWidth: 64, backgroundColor: cores.fundo, padding: 10, borderRadius: 10 },
  horarioTexto: { color: cores.marinho, fontWeight: '800', fontSize: 16 }, horarioDetalhe: { color: cores.textoSuave, fontSize: 11 },
  nome: { color: cores.marinho, fontWeight: '700', fontSize: 16 },
  valor: { color: cores.marinho, fontWeight: '700', fontSize: 15 },
  status: { color: cores.aviso, backgroundColor: cores.avisoFundo, fontSize: 11, overflow: 'hidden', borderRadius: 8, padding: 5 },
  rodape: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTopColor: cores.borda, borderTopWidth: 1, paddingTop: 10 },
  erro: { color: cores.erro, backgroundColor: cores.erroFundo, padding: 12, borderRadius: raio.campo },
  demo: { color: cores.aviso, backgroundColor: cores.avisoFundo, padding: 12, borderRadius: raio.campo },
});
