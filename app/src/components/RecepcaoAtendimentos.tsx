import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import Botao from './Botao';
import Card from './Card';
import Campo from './Campo';
import { ErroApi, errosPorCampo } from '../api/cliente';
import { Atendimento, dataLocal, diaPorExtenso, dinheiro, horaLocal, mensagemErro, mudarDia, statusNome } from '../api/parte3';
import { CorrecaoRecepcao, recepcaoApi } from '../api/validacao';
import { calcularIndicadoresRecepcao } from '../api/indicadoresRecepcao';
import { enviarComprovante } from '../api/cliente';
import { cores, raio } from '../theme';

type Filtro = 'pendentes' | 'todos' | 'validados' | 'rejeitados';
type Arquivo = { nome: string; tipo: string; arquivo: Blob };
const opcoes: { id: Filtro; texto: string }[] = [
  { id: 'pendentes', texto: 'Pendentes' },
  { id: 'todos', texto: 'Todos' },
  { id: 'validados', texto: 'Validados' },
  { id: 'rejeitados', texto: 'Rejeitados' },
];
const formas = [
  { id: 'dinheiro', texto: 'Dinheiro' },
  { id: 'pix', texto: 'Pix' },
  { id: 'cartao', texto: 'Cartão' },
] as const;

export default function RecepcaoAtendimentos() {
  const { width } = useWindowDimensions();
  const [dia, setDia] = useState(dataLocal());
  const [lista, setLista] = useState<Atendimento[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('pendentes');
  const [profissional, setProfissional] = useState('todos');
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [rejeitando, setRejeitando] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [pagamento, setPagamento] = useState<CorrecaoRecepcao['forma_pagamento']>('dinheiro');
  const [nsu, setNsu] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [arquivo, setArquivo] = useState<Arquivo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState('');
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState('');

  useFocusEffect(useCallback(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    recepcaoApi.listar(dia).then((dados) => { if (ativo) setLista(dados); })
      .catch((e) => { if (ativo) setErro(mensagemErro(e)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [dia, versao]));

  const atual = lista.find((a) => a.id === selecionado);
  useEffect(() => {
    if (!atual) return;
    setObservacoes(atual.observacoes || '');
    setPagamento(atual.forma_pagamento || 'dinheiro');
    setNsu(atual.nsu || '');
    setEditando(false);
    setRejeitando(false);
    setJustificativa('');
    setArquivo(null);
    setErrosCampo({});
  }, [selecionado]);

  const { pendentes, prontos, validados, rejeitados, valorPronto, totalValidado } = calcularIndicadoresRecepcao(lista);
  const profissionais = [...new Map(lista.map((a) => [a.barbeiro.id, a.barbeiro.nome_completo])).entries()];
  const filtrados = lista.filter((a) => {
    if (profissional !== 'todos' && a.barbeiro.id !== profissional) return false;
    if (filtro === 'pendentes') return a.status === 'registrado';
    if (filtro === 'validados') return a.status === 'validado_recepcao' || a.status === 'validado_dono';
    if (filtro === 'rejeitados') return a.status === 'rejeitado';
    return true;
  });

  async function executar(acao: 'validar' | 'rejeitar' | 'corrigir') {
    if (!atual || executando) return;
    if (acao === 'validar' && !atual.comprovante_anexado) {
      setErro('Sem comprovante não é possível validar. Utilize Corrigir para anexar o arquivo.');
      setErrosCampo({ comprovante: 'Anexe o comprovante antes de validar.' });
      return;
    }
    if (acao === 'rejeitar' && !justificativa.trim()) {
      setErro('');
      setErrosCampo({ justificativa: 'Informe a justificativa da rejeição.' });
      return;
    }
    setExecutando(true);
    setErro(''); setErrosCampo({}); setAviso('');
    try {
      const atualizado = acao === 'validar' ? await recepcaoApi.validar(atual.id)
        : acao === 'rejeitar' ? await recepcaoApi.rejeitar(atual.id, justificativa.trim())
        : await recepcaoApi.corrigir(atual.id, {
          observacoes, forma_pagamento: pagamento,
          nsu: pagamento === 'dinheiro' ? null : nsu.trim() || null,
        });
      setLista((anteriores) => anteriores.map((a) => a.id === atualizado.id ? atualizado : a));
      setEditando(false); setRejeitando(false);
      setAviso(acao === 'validar' ? 'Atendimento validado e encaminhado para o fechamento.'
        : acao === 'rejeitar' ? 'Atendimento rejeitado.' : 'Correções salvas com sucesso.');
      setSelecionado(null);
      setVersao((v) => v + 1);
    } catch (e) {
      setErro(mensagemErro(e));
      if (e instanceof ErroApi) setErrosCampo(errosPorCampo(e));
    }
    finally { setExecutando(false); }
  }

  async function escolherArquivo() {
    setErro('');
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'], copyToCacheDirectory: true, multiple: false,
      });
      if (resultado.canceled || !resultado.assets.length) return;
      const escolhido = resultado.assets[0];
      const tipo = escolhido.mimeType === 'image/jpg' ? 'image/jpeg' :
        ['image/jpeg', 'image/png', 'application/pdf'].includes(escolhido.mimeType || '') ? escolhido.mimeType! :
        /\.pdf$/i.test(escolhido.name) ? 'application/pdf' :
        /\.png$/i.test(escolhido.name) ? 'image/png' :
        /\.jpe?g$/i.test(escolhido.name) ? 'image/jpeg' : '';
      if (!tipo) { setErro('Selecione um JPG, PNG ou PDF.'); return; }
      if ((escolhido.size || 0) > 6 * 1024 * 1024) { setErro('O arquivo deve ter até 6 MB.'); return; }
      const binario = escolhido.file || await (await fetch(escolhido.uri)).blob();
      if (binario.size > 6 * 1024 * 1024) { setErro('O arquivo deve ter até 6 MB.'); return; }
      setArquivo({ nome: escolhido.name, tipo, arquivo: binario });
    } catch (e) { setErro(`Não foi possível selecionar o arquivo: ${mensagemErro(e)}`); }
  }

  async function anexarArquivo() {
    if (!atual || !arquivo || executando) return;
    setExecutando(true);
    setErro(''); setAviso('');
    try {
      const comprovante = await enviarComprovante(atual.id, arquivo.arquivo, arquivo.tipo);
      setLista((anteriores) => anteriores.map((a) => a.id === atual.id ? { ...a, ...comprovante } : a));
      setArquivo(null);
      setAviso('Comprovante anexado. O atendimento está pronto para conferência, mas ainda precisa ser validado pela recepção.');
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setExecutando(false); }
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.pagina} keyboardShouldPersistTaps="handled">
      <View style={estilos.cabecalho}>
        <Text style={estilos.marca}>BARBERFLOW  /  RECEPÇÃO</Text>
        <Text style={estilos.titulo}>Validação de atendimentos</Text>
        <Text style={estilos.suave}>Confira os serviços, valores e comprovantes antes de aprovar cada atendimento.</Text>
      </View>
      {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
      {aviso ? <Text style={estilos.aviso}>{aviso}</Text> : null}
      <Card>
        <View style={estilos.linha}>
          <Pressable accessibilityRole="button" accessibilityLabel="Dia anterior" style={estilos.seta} onPress={() => setDia(mudarDia(dia, -1))}><Text style={estilos.setaTexto}>‹</Text></Pressable>
          <View style={{ flex: 1, alignItems: 'center', gap: 5 }}><Text style={estilos.data}>{diaPorExtenso(dia)}</Text><Text style={estilos.suave}>Atendimentos da barbearia</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Próximo dia" style={estilos.seta} onPress={() => setDia(mudarDia(dia, 1))}><Text style={estilos.setaTexto}>›</Text></Pressable>
        </View>
        <View style={estilos.linhaCentral}>
          <Pressable onPress={() => setDia(dataLocal())}><Text style={estilos.link}>Hoje</Text></Pressable>
          <Pressable onPress={() => setVersao((v) => v + 1)}><Text style={estilos.link}>Atualizar ↻</Text></Pressable>
        </View>
      </Card>
      <View style={[estilos.resumo, width >= 760 && estilos.resumoLargo]}>
        <View style={estilos.metrica}><Text style={estilos.metricaTitulo}>AGUARDANDO CONFERÊNCIA</Text><Text style={estilos.metricaValor}>{pendentes.length}</Text></View>
        <View style={estilos.metrica}><Text style={estilos.metricaTitulo}>PRONTOS PARA VALIDAR</Text><Text style={estilos.metricaValor}>{prontos.length}</Text></View>
        <View style={estilos.metrica}><Text style={estilos.metricaTitulo}>VALOR PRONTO PARA VALIDAR</Text><Text style={estilos.metricaValor}>{dinheiro(valorPronto)}</Text></View>
        <View style={estilos.metrica}><Text style={estilos.metricaTitulo}>VALIDADOS</Text><Text style={estilos.metricaValor}>{validados.length}</Text></View>
        <View style={estilos.metrica}><Text style={estilos.metricaTitulo}>TOTAL VALIDADO</Text><Text style={estilos.metricaValor}>{dinheiro(totalValidado)}</Text></View>
      </View>
      {prontos.length > 0 ? <Text style={estilos.suave}>Comprovante recebido não significa atendimento validado. Abra “Conferir atendimento” e selecione “Validar atendimento” após conferir as informações.</Text> : null}
      <View style={estilos.grupo}>
        <Text style={estilos.rotulo}>Situação</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.filtros}>
          {opcoes.map((o) => <Pressable key={o.id} onPress={() => { setFiltro(o.id); setSelecionado(null); }} style={[estilos.pilula, filtro === o.id && estilos.pilulaAtiva]}>
            <Text style={[estilos.pilulaTexto, filtro === o.id && estilos.pilulaTextoAtivo]}>{o.texto}{o.id === 'pendentes' ? ` (${pendentes.length})` : ''}</Text>
          </Pressable>)}
        </ScrollView>
        {profissionais.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.filtros}>
            {[['todos', 'Todos os profissionais'], ...profissionais].map(([id, nome]) => <Pressable key={id} style={[estilos.pilula, profissional === id && estilos.pilulaAtiva]} onPress={() => setProfissional(id)}><Text style={[estilos.pilulaTexto, profissional === id && estilos.pilulaTextoAtivo]}>{nome}</Text></Pressable>)}
          </ScrollView>
        ) : null}
      </View>
      <View style={estilos.linha}><Text style={estilos.secao}>Atendimentos ({filtrados.length})</Text>{carregando ? <ActivityIndicator color={cores.dourado} /> : null}</View>
      {!carregando && !filtrados.length ? <Card><Text style={estilos.suave}>{filtro === 'pendentes' ? 'Nenhum atendimento aguardando validação.' : 'Nenhum atendimento encontrado para este filtro.'}</Text></Card> : null}
      {filtrados.map((a) => (
        <Card key={a.id} style={{ borderColor: selecionado === a.id ? cores.dourado : cores.borda }}>
          <View style={estilos.linha}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={estilos.nome}>{a.cliente?.nome_completo || 'Cliente não informado'}</Text>
              <Text style={estilos.suave}>Profissional: {a.barbeiro.nome_completo} · {horaLocal(a.inicio)}{a.fim ? ` às ${horaLocal(a.fim)}` : ''}</Text>
              <Text style={estilos.suave}>{a.servicos.map((s) => s.nome).join(' + ') || 'Nenhum serviço informado'}</Text>
              <Text style={[estilos.estado, a.status === 'registrado' ? estilos.pendente : a.status === 'rejeitado' ? estilos.rejeitado : estilos.validado]}>{statusNome(a.status)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <Text style={estilos.valor}>{dinheiro(a.valor_total)}</Text>
              <Text style={a.comprovante_anexado ? estilos.ok : estilos.falta}>{a.comprovante_anexado ? '✓ Comprovante' : 'Sem comprovante'}</Text>
              {a.status === 'registrado' && a.comprovante_anexado ? <Text style={estilos.suave}>Aguardando validação</Text> : null}
            </View>
          </View>
          <Botao variante="secundario" titulo={selecionado === a.id ? 'Fechar detalhes' : 'Conferir atendimento'} onPress={() => { setSelecionado(selecionado === a.id ? null : a.id); setErro(''); setAviso(''); }} />
          {selecionado === a.id ? (
            <View style={estilos.detalhes}>
              <Text style={estilos.secao}>Detalhamento</Text>
              <Text style={estilos.suave}>CPF do cliente: {a.cliente?.cpf || 'Não informado'}</Text>
              {a.servicos.map((s, i) => <View style={estilos.linha} key={`${s.id}-${i}`}><Text style={estilos.texto}>{s.nome}</Text><Text style={estilos.texto}>{dinheiro(s.preco)}</Text></View>)}
              <View style={estilos.divisoria}/>
              <View style={estilos.linha}><Text style={estilos.nome}>Total do atendimento</Text><Text style={estilos.valor}>{dinheiro(a.valor_total)}</Text></View>
              <Text style={estilos.suave}>Pagamento: {formas.find((f) => f.id === a.forma_pagamento)?.texto || 'Não informado'}{a.nsu ? ` · NSU: ${a.nsu}` : ''}</Text>
              <Text style={estilos.suave}>Observações: {a.observacoes || 'Nenhuma'}</Text>
              <Text style={estilos.suave}>Repasse do profissional: {dinheiro(a.valor_barbeiro)} · Barbearia: {dinheiro(a.valor_barbearia)}</Text>
              {a.comprovante_url ? <Pressable onPress={() => Linking.openURL(a.comprovante_url!)}><Text style={estilos.link}>Abrir comprovante ↗</Text></Pressable>
                : <Text style={a.comprovante_anexado ? estilos.ok : estilos.falta}>{a.comprovante_anexado ? 'Comprovante registrado no ambiente de teste.' : 'Sem comprovante. A validação está bloqueada.'}</Text>}
              {a.status === 'registrado' ? (
                <View style={estilos.acoes}>
                  {editando ? (
                    <Card>
                      <Text style={estilos.nome}>Corrigir informações</Text>
                      <Text style={estilos.suave}>A correção não altera os serviços nem o valor já registrado.</Text>
                      <Campo rotulo="Observações" valor={observacoes} onChangeText={(valor) => { setObservacoes(valor); setErrosCampo((atuais) => ({ ...atuais, observacoes: '' })); }} placeholder="Observações do atendimento" erro={errosCampo.observacoes} />
                      <Text style={estilos.rotulo}>Forma de pagamento</Text>
                      <View style={estilos.filtros}>{formas.map((f) => <Pressable key={f.id} style={[estilos.pilula, pagamento === f.id && estilos.pilulaAtiva]} onPress={() => { setPagamento(f.id); setErrosCampo((atuais) => ({ ...atuais, forma_pagamento: '' })); }}><Text style={[estilos.pilulaTexto, pagamento === f.id && estilos.pilulaTextoAtivo]}>{f.texto}</Text></Pressable>)}</View>
                      {errosCampo.forma_pagamento ? <Text style={estilos.erroCampo}>{errosCampo.forma_pagamento}</Text> : null}
                      {pagamento !== 'dinheiro' ? <Campo rotulo="NSU / ID da transação" valor={nsu} onChangeText={(valor) => { setNsu(valor); setErrosCampo((atuais) => ({ ...atuais, nsu: '' })); }} placeholder="Opcional" erro={errosCampo.nsu} /> : null}
                      <Text style={estilos.rotulo}>Comprovante de pagamento</Text>
                      <Text style={estilos.suave}>Envie um JPG, PNG ou PDF de até 6 MB, inclusive quando o barbeiro não tiver anexado o arquivo.</Text>
                      <Botao titulo="Selecionar comprovante" variante="secundario" desabilitado={executando} onPress={escolherArquivo} />
                      {arquivo ? <Text style={estilos.suave}>Selecionado: {arquivo.nome}</Text> : null}
                      {arquivo ? <Botao titulo={executando ? 'Enviando…' : 'Enviar comprovante'} desabilitado={executando} onPress={anexarArquivo} /> : null}
                      <Botao titulo={executando ? 'Salvando…' : 'Salvar correção'} desabilitado={executando} onPress={() => executar('corrigir')} />
                      <Botao titulo="Cancelar correção" variante="secundario" onPress={() => setEditando(false)} />
                    </Card>
                  ) : null}
                  {rejeitando ? (
                    <Card>
                      <Text style={estilos.nome}>Justificativa da rejeição</Text>
                      <Campo rotulo="Motivo" valor={justificativa} onChangeText={(valor) => { setJustificativa(valor); setErrosCampo((atuais) => ({ ...atuais, justificativa: '' })); }} placeholder="Explique o motivo da rejeição" erro={errosCampo.justificativa} />
                      <Botao titulo={executando ? 'Rejeitando…' : 'Confirmar rejeição'} variante="perigo" desabilitado={executando || !justificativa.trim() || justificativa.length > 300} onPress={() => executar('rejeitar')} />
                      <Botao titulo="Cancelar rejeição" variante="secundario" onPress={() => setRejeitando(false)} />
                    </Card>
                  ) : null}
                  {!editando && !rejeitando ? (
                    <>
                      <Botao titulo={executando ? 'Validando…' : a.comprovante_anexado ? 'Validar atendimento' : 'Validação bloqueada: sem comprovante'} onPress={() => executar('validar')} desabilitado={executando || !a.comprovante_anexado} />
                      <View style={[estilos.filtros, { flexWrap: 'wrap' }]}>
                        <View style={{ flex: 1, minWidth: 130 }}><Botao titulo="Corrigir" variante="secundario" onPress={() => setEditando(true)} /></View>
                        <View style={{ flex: 1, minWidth: 130 }}><Botao titulo="Rejeitar" variante="perigo" onPress={() => setRejeitando(true)} /></View>
                      </View>
                    </>
                  ) : null}
                </View>
              ) : null}
              {a.status === 'rejeitado' && a.justificativa_rejeicao ? <Text style={estilos.falta}>Motivo: {a.justificativa_rejeicao}</Text> : null}
            </View>
          ) : null}
        </Card>
      ))}
      {rejeitados.length > 0 ? <Text style={estilos.suave}>Rejeitados no dia: {rejeitados.length}. Atendimentos rejeitados não entram no total validado.</Text> : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  pagina: { width: '100%', maxWidth: 1100, alignSelf: 'center', padding: 20, paddingBottom: 64, gap: 16 },
  cabecalho: { gap: 8, paddingVertical: 8 },
  marca: { color: cores.dourado, letterSpacing: 2, fontSize: 11, fontWeight: '800' },
  titulo: { fontSize: 28, fontWeight: '800', color: cores.marinho },
  suave: { color: cores.textoSuave, fontSize: 13, lineHeight: 19 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  linhaCentral: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28 },
  seta: { borderRadius: raio.campo, backgroundColor: cores.fundo, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  setaTexto: { color: cores.marinho, fontSize: 29 },
  data: { fontSize: 18, color: cores.marinho, fontWeight: '700', textAlign: 'center' },
  link: { color: cores.dourado, fontSize: 14, fontWeight: '700' },
  resumo: { gap: 12 }, resumoLargo: { flexDirection: 'row', flexWrap: 'wrap' },
  metrica: { flex: 1, minWidth: 185, backgroundColor: cores.branco, borderRadius: raio.card, borderWidth: 1, borderColor: cores.borda, padding: 18, gap: 8 },
  metricaTitulo: { color: cores.textoSuave, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  metricaValor: { color: cores.marinho, fontSize: 23, fontWeight: '800' },
  grupo: { gap: 10 }, rotulo: { color: cores.marinho, fontWeight: '700', fontSize: 13 },
  filtros: { flexDirection: 'row', gap: 8 },
  pilula: { backgroundColor: cores.branco, borderWidth: 1, borderColor: cores.borda, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  pilulaAtiva: { backgroundColor: cores.marinho, borderColor: cores.marinho },
  pilulaTexto: { color: cores.textoSuave, fontSize: 13 }, pilulaTextoAtivo: { color: cores.branco, fontWeight: '700' },
  secao: { fontSize: 18, fontWeight: '700', color: cores.marinho },
  nome: { color: cores.marinho, fontSize: 16, fontWeight: '700' },
  texto: { color: cores.marinho, fontSize: 14 },
  valor: { color: cores.dourado, fontSize: 19, fontWeight: '800' },
  estado: { fontSize: 12, fontWeight: '700', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, overflow: 'hidden', alignSelf: 'flex-start' },
  pendente: { backgroundColor: cores.avisoFundo, color: cores.aviso },
  rejeitado: { backgroundColor: cores.erroFundo, color: cores.erro },
  validado: { backgroundColor: cores.okFundo, color: cores.ok },
  ok: { color: cores.ok, fontSize: 13, fontWeight: '700' },
  falta: { color: cores.erro, fontSize: 13, fontWeight: '700' },
  erroCampo: { color: cores.erro, fontSize: 13 },
  detalhes: { borderTopWidth: 1, borderTopColor: cores.borda, marginTop: 6, paddingTop: 16, gap: 12 },
  divisoria: { borderTopWidth: 1, borderTopColor: cores.borda },
  acoes: { gap: 10 },
  erro: { color: cores.erro, backgroundColor: cores.erroFundo, padding: 12, borderRadius: raio.campo },
  aviso: { color: cores.ok, backgroundColor: cores.okFundo, padding: 12, borderRadius: raio.campo },
});
