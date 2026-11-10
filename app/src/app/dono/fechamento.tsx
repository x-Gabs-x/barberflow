import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Botao from '../../components/Botao';
import Campo from '../../components/Campo';
import Card from '../../components/Card';
import { ErroApi, errosPorCampo } from '../../api/cliente';
import { fechamentoApi, ResumoFechamento } from '../../api/fechamento';
import { dataLocal, diaPorExtenso, dinheiro, mensagemErro, mudarDia } from '../../api/parte3';
import { cores, raio } from '../../theme';

const pagamentos = [
  { campo: 'dinheiro', nome: 'Dinheiro' },
  { campo: 'pix', nome: 'Pix' },
  { campo: 'cartao', nome: 'Cartão' },
] as const;

export default function Tela() {
  const [dia, setDia] = useState(dataLocal());
  const [resumo, setResumo] = useState<ResumoFechamento | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [executando, setExecutando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState('');
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState('');

  useFocusEffect(useCallback(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    fechamentoApi.resumo(dia)
      .then((dados) => { if (ativo) setResumo(dados); })
      .catch((e: unknown) => { if (ativo) setErro(mensagemErro(e)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [dia, versao]));

  async function confirmar() {
    if (executando) return;
    setExecutando(true);
    setErro('');
    setErrosCampo({});
    setAviso('');
    try {
      await fechamentoApi.confirmar(dia);
      setAviso('Fechamento confirmado. Os atendimentos validados foram registrados nos totais do dia.');
      setVersao((atual) => atual + 1);
    } catch (e) {
      setErro(mensagemErro(e));
      if (e instanceof ErroApi) setErrosCampo(errosPorCampo(e));
    } finally {
      setExecutando(false);
    }
  }

  async function devolver() {
    if (executando) return;
    const motivo = justificativa.trim();
    if (!motivo) {
      setErrosCampo({ justificativa: 'Informe a justificativa da devolução.' });
      return;
    }
    if (motivo.length > 300) {
      setErrosCampo({ justificativa: 'A justificativa deve ter até 300 caracteres.' });
      return;
    }
    setExecutando(true);
    setErro('');
    setErrosCampo({});
    setAviso('');
    try {
      await fechamentoApi.devolver(dia, motivo);
      setJustificativa('');
      setAviso('Dia devolvido à recepção para conferência.');
      setVersao((atual) => atual + 1);
    } catch (e) {
      setErro(mensagemErro(e));
      if (e instanceof ErroApi) setErrosCampo(errosPorCampo(e));
    } finally {
      setExecutando(false);
    }
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.pagina} keyboardShouldPersistTaps="handled">
      <View style={estilos.cabecalho}>
        <Text style={estilos.marca}>BARBERFLOW  /  GESTÃO</Text>
        <Text style={estilos.titulo}>Fechamento do dia</Text>
        <Text style={estilos.suave}>Confira os atendimentos validados pela recepção antes de confirmar os totais e repasses.</Text>
      </View>
      {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
      {aviso ? <Text style={estilos.aviso}>{aviso}</Text> : null}
      <Card>
        <View style={estilos.linha}>
          <Pressable accessibilityRole="button" accessibilityLabel="Dia anterior" style={estilos.seta} onPress={() => setDia((atual) => mudarDia(atual, -1))}>
            <Text style={estilos.setaTexto}>‹</Text>
          </Pressable>
          <View style={estilos.dia}>
            <Text style={estilos.data}>{diaPorExtenso(dia)}</Text>
            <Pressable onPress={() => setDia(dataLocal())}><Text style={estilos.link}>Ir para hoje</Text></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Próximo dia" style={estilos.seta} onPress={() => setDia((atual) => mudarDia(atual, 1))}>
            <Text style={estilos.setaTexto}>›</Text>
          </Pressable>
        </View>
      </Card>

      {carregando ? <ActivityIndicator color={cores.dourado} /> : null}
      {!carregando && resumo ? (
        <>
          {resumo.demonstracao ? <Text style={estilos.aviso}>Modo de teste: os dados não são persistidos no banco.</Text> : null}
          <Card>
            <View style={estilos.linha}>
              <Text style={estilos.secao}>Situação</Text>
              <Text style={[estilos.estado, resumo.status === 'confirmado' ? estilos.confirmado : estilos.aberto]}>
                {resumo.status === 'confirmado' ? 'Confirmado' : 'Aberto'}
              </Text>
            </View>
            <Text style={estilos.rotulo}>Total elegível para o fechamento</Text>
            <Text style={estilos.total}>{dinheiro(resumo.total)}</Text>
            <Text style={estilos.suave}>{resumo.quantidade_atendimentos} atendimento(s) validados pela recepção ou pelo dono.</Text>
          </Card>

          <Card>
            <Text style={estilos.secao}>Por barbeiro</Text>
            {resumo.por_barbeiro.length ? resumo.por_barbeiro.map((barbeiro) => (
              <View key={barbeiro.barbeiro_id} style={estilos.item}>
                <Text style={estilos.nome}>{barbeiro.nome_completo}</Text>
                <View style={estilos.linha}><Text style={estilos.suave}>Total dos atendimentos</Text><Text style={estilos.valor}>{dinheiro(barbeiro.total)}</Text></View>
                <View style={estilos.linha}><Text style={estilos.suave}>Parte do barbeiro</Text><Text style={estilos.texto}>{dinheiro(barbeiro.valor_barbeiro)}</Text></View>
                <View style={estilos.linha}><Text style={estilos.suave}>Parte da barbearia</Text><Text style={estilos.texto}>{dinheiro(barbeiro.valor_barbearia)}</Text></View>
              </View>
            )) : <Text style={estilos.suave}>Nenhum atendimento validado para este dia.</Text>}
          </Card>

          <Card>
            <Text style={estilos.secao}>Por forma de pagamento</Text>
            {pagamentos.map((pagamento) => (
              <View key={pagamento.campo} style={estilos.linha}>
                <Text style={estilos.suave}>{pagamento.nome}</Text>
                <Text style={estilos.valor}>{dinheiro(resumo.por_forma_pagamento[pagamento.campo])}</Text>
              </View>
            ))}
          </Card>

          {resumo.status === 'aberto' ? (
            <Card>
              <Text style={estilos.secao}>Confirmar fechamento</Text>
              <Text style={estilos.suave}>A confirmação atualiza os atendimentos e o fechamento em uma única operação.</Text>
              <Botao titulo={executando ? 'Confirmando…' : 'Confirmar dia'} desabilitado={executando || carregando} onPress={confirmar} />
            </Card>
          ) : (
            <Card>
              <Text style={estilos.secao}>Devolver à recepção</Text>
              <Text style={estilos.suave}>Os atendimentos deste dia voltarão para validação da recepção. A justificativa é obrigatória.</Text>
              <Campo
                rotulo="Justificativa"
                valor={justificativa}
                onChangeText={(valor) => { setJustificativa(valor); setErrosCampo((atuais) => ({ ...atuais, justificativa: '' })); }}
                placeholder="Explique o motivo da devolução"
                erro={errosCampo.justificativa}
              />
              <Text style={estilos.contador}>{justificativa.length}/300</Text>
              <Botao variante="perigo" titulo={executando ? 'Devolvendo…' : 'Devolver dia'} desabilitado={executando || carregando || justificativa.length > 300} onPress={devolver} />
            </Card>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  pagina: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 20, paddingBottom: 64, gap: 16 },
  cabecalho: { gap: 8, paddingVertical: 8 },
  marca: { color: cores.dourado, letterSpacing: 2, fontSize: 11, fontWeight: '800' },
  titulo: { fontSize: 28, fontWeight: '800', color: cores.marinho },
  suave: { color: cores.textoSuave, fontSize: 13, lineHeight: 19 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  dia: { flex: 1, alignItems: 'center', gap: 7 },
  seta: { borderRadius: raio.campo, backgroundColor: cores.fundo, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  setaTexto: { color: cores.marinho, fontSize: 29 },
  data: { fontSize: 18, color: cores.marinho, fontWeight: '700', textAlign: 'center' },
  link: { color: cores.dourado, fontSize: 13, fontWeight: '700' },
  secao: { color: cores.marinho, fontSize: 18, fontWeight: '700' },
  rotulo: { color: cores.textoSuave, fontSize: 13, fontWeight: '600', marginTop: 16 },
  total: { color: cores.marinho, fontSize: 30, fontWeight: '800', marginVertical: 4 },
  valor: { color: cores.marinho, fontSize: 15, fontWeight: '700' },
  nome: { color: cores.marinho, fontSize: 16, fontWeight: '700' },
  texto: { color: cores.marinho, fontSize: 14 },
  item: { borderTopWidth: 1, borderTopColor: cores.borda, paddingTop: 14, marginTop: 14, gap: 8 },
  estado: { fontSize: 12, fontWeight: '700', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, overflow: 'hidden' },
  aberto: { backgroundColor: cores.avisoFundo, color: cores.aviso },
  confirmado: { backgroundColor: cores.okFundo, color: cores.ok },
  contador: { textAlign: 'right', color: cores.textoSuave, fontSize: 12 },
  erro: { color: cores.erro, backgroundColor: cores.erroFundo, padding: 12, borderRadius: raio.campo },
  aviso: { color: cores.ok, backgroundColor: cores.okFundo, padding: 12, borderRadius: raio.campo },
});
