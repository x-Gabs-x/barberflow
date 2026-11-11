import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Botao from '../../components/Botao';
import Campo from '../../components/Campo';
import Card from '../../components/Card';
import { ErroApi, errosPorCampo } from '../../api/cliente';
import { fechamentoApi, ResumoFechamento } from '../../api/fechamento';
import { Atendimento, dataLocal, diaPorExtenso, dinheiro, horaLocal, mensagemErro, mudarDia, statusNome } from '../../api/parte3';
import { cores, raio } from '../../theme';

const pagamentos = [
  { campo: 'dinheiro', nome: 'Dinheiro' },
  { campo: 'pix', nome: 'Pix' },
  { campo: 'cartao', nome: 'Cartão' },
] as const;

export default function Tela() {
  const [dia, setDia] = useState(dataLocal());
  const [resumo, setResumo] = useState<ResumoFechamento | null>(null);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [atendimentoAberto, setAtendimentoAberto] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [executando, setExecutando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState('');
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState('');

  const parteBarbearia = resumo?.por_barbeiro.reduce((total, barbeiro) => total + barbeiro.valor_barbearia, 0) ?? 0;

  useFocusEffect(useCallback(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    Promise.all([fechamentoApi.resumo(dia), fechamentoApi.atendimentos(dia)])
      .then(([dados, lista]) => {
        if (!ativo) return;
        setResumo(dados);
        setAtendimentos(lista);
      })
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
        <Text style={estilos.suave}>Confira os atendimentos e comprovantes do dia. O total é calculado pela soma dos atendimentos validados.</Text>
      </View>
      {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
      {aviso ? <Text style={estilos.aviso}>{aviso}</Text> : null}
      <Card>
        <View style={estilos.linha}>
          <Pressable accessibilityRole="button" accessibilityLabel="Dia anterior" style={estilos.seta} onPress={() => { setAtendimentoAberto(null); setDia((atual) => mudarDia(atual, -1)); }}>
            <Text style={estilos.setaTexto}>‹</Text>
          </Pressable>
          <View style={estilos.dia}>
            <Text style={estilos.data}>{diaPorExtenso(dia)}</Text>
            <Pressable onPress={() => { setAtendimentoAberto(null); setDia(dataLocal()); }}><Text style={estilos.link}>Ir para hoje</Text></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Próximo dia" style={estilos.seta} onPress={() => { setAtendimentoAberto(null); setDia((atual) => mudarDia(atual, 1)); }}>
            <Text style={estilos.setaTexto}>›</Text>
          </Pressable>
        </View>
      </Card>

      {carregando ? <ActivityIndicator color={cores.dourado} /> : null}
      {!carregando && resumo ? (
        <>
          {resumo.demonstracao ? <Text style={estilos.aviso}>Modo de teste: os dados não são persistidos no banco.</Text> : null}
          <Card>
            <Text style={estilos.secao}>Resultado financeiro do dia</Text>
            <View style={estilos.metricasFinanceiras}>
              <View style={estilos.metricaFinanceira}>
                <Text style={estilos.rotuloFinanceiro}>ARRECADADO</Text>
                <Text style={estilos.valorFinanceiro}>{dinheiro(resumo.total)}</Text>
                <Text style={estilos.suave}>Total bruto dos atendimentos validados</Text>
              </View>
              <View style={estilos.metricaFinanceira}>
                <Text style={estilos.rotuloFinanceiro}>LUCRO BRUTO DA BARBEARIA</Text>
                <Text style={estilos.valorFinanceiro}>{dinheiro(parteBarbearia)}</Text>
                <Text style={estilos.suave}>Arrecadação menos repasses, antes das despesas</Text>
              </View>
            </View>
          </Card>
          <Card>
            <View style={estilos.linha}>
              <Text style={estilos.secao}>Situação</Text>
              <Text style={[estilos.estado, resumo.status === 'confirmado' ? estilos.confirmado : estilos.aberto]}>
                {resumo.status === 'confirmado' ? 'Confirmado' : 'Aberto'}
              </Text>
            </View>
            <Text style={estilos.suave}>{resumo.quantidade_atendimentos} atendimento(s) validados pela recepção ou pelo dono.</Text>
          </Card>

          <Card>
            <Text style={estilos.secao}>Por barbeiro</Text>
            {resumo.por_barbeiro.length ? resumo.por_barbeiro.map((barbeiro) => (
              <View key={barbeiro.barbeiro_id} style={estilos.item}>
                <Text style={estilos.nome}>{barbeiro.nome_completo}</Text>
                <View style={estilos.linha}><Text style={estilos.suave}>Total dos atendimentos</Text><Text style={estilos.valor}>{dinheiro(barbeiro.total)}</Text></View>
                <View style={estilos.linha}><Text style={estilos.suave}>Parte do barbeiro ({barbeiro.total ? (barbeiro.valor_barbeiro / barbeiro.total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : 0}%)</Text><Text style={estilos.texto}>{dinheiro(barbeiro.valor_barbeiro)}</Text></View>
                <View style={estilos.linha}><Text style={estilos.suave}>Parte da barbearia ({barbeiro.total ? (barbeiro.valor_barbearia / barbeiro.total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : 0}%)</Text><Text style={estilos.texto}>{dinheiro(barbeiro.valor_barbearia)}</Text></View>
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

          <Card>
            <View style={estilos.linha}>
              <Text style={estilos.secao}>Atendimentos do dia ({atendimentos.length})</Text>
              <Pressable onPress={() => setVersao((atual) => atual + 1)}><Text style={estilos.link}>Atualizar</Text></Pressable>
            </View>
            <Text style={estilos.suave}>Toque em um atendimento para ver os serviços, valores e conferir o comprovante. Só entram no total os atendimentos validados.</Text>
            {atendimentos.length === 0 ? <Text style={estilos.suave}>Nenhum atendimento registrado para este dia.</Text> : null}
            {atendimentos.map((atendimento) => {
              const aberto = atendimentoAberto === atendimento.id;
              return (
                <View key={atendimento.id} style={estilos.atendimento}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${aberto ? 'Fechar' : 'Ver'} atendimento de ${atendimento.cliente?.nome_completo || 'cliente não informado'}`}
                    onPress={() => setAtendimentoAberto(aberto ? null : atendimento.id)}
                    style={estilos.linha}
                  >
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text style={estilos.nome}>{atendimento.cliente?.nome_completo || 'Cliente não informado'}</Text>
                      <Text style={estilos.suave}>{atendimento.barbeiro.nome_completo} · {horaLocal(atendimento.inicio)}{atendimento.fim ? `–${horaLocal(atendimento.fim)}` : ''}</Text>
                      <Text style={[estilos.estado, atendimento.status === 'rejeitado' ? estilos.rejeitado : atendimento.status === 'validado_recepcao' || atendimento.status === 'validado_dono' ? estilos.confirmado : estilos.aberto]}>{statusNome(atendimento.status)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={estilos.valor}>{dinheiro(atendimento.valor_total)}</Text>
                      <Text style={atendimento.comprovante_anexado ? estilos.comprovanteOk : estilos.comprovanteFalta}>{atendimento.comprovante_anexado ? 'Comprovante anexado' : 'Sem comprovante'}</Text>
                    </View>
                  </Pressable>
                  {aberto ? (
                    <View style={estilos.detalhesAtendimento}>
                      <Text style={estilos.nome}>Especificação do atendimento</Text>
                      <Text style={estilos.suave}>Barbeiro: {atendimento.barbeiro.nome_completo}</Text>
                      <Text style={estilos.suave}>Cliente: {atendimento.cliente?.nome_completo || 'Não informado'}{atendimento.cliente?.cpf ? ` · CPF ${atendimento.cliente.cpf}` : ''}</Text>
                      {atendimento.servicos.map((servico, indice) => (
                        <View key={`${servico.id}-${indice}`} style={estilos.linha}>
                          <Text style={estilos.texto}>{servico.nome}</Text>
                          <Text style={estilos.texto}>{dinheiro(servico.preco)}</Text>
                        </View>
                      ))}
                      <View style={estilos.linha}><Text style={estilos.nome}>Total</Text><Text style={estilos.valor}>{dinheiro(atendimento.valor_total)}</Text></View>
                      <Text style={estilos.suave}>Pagamento: {pagamentos.find((item) => item.campo === atendimento.forma_pagamento)?.nome || 'Não informado'}{atendimento.nsu ? ` · NSU: ${atendimento.nsu}` : ''}</Text>
                      <Text style={estilos.suave}>Observações: {atendimento.observacoes || 'Nenhuma'}</Text>
                      <Text style={estilos.suave}>Repasse: barbeiro {atendimento.escote_percentual ?? 0}% ({dinheiro(atendimento.valor_barbeiro)}) · barbearia {100 - (atendimento.escote_percentual ?? 0)}% ({dinheiro(atendimento.valor_barbearia)})</Text>
                      <Text style={estilos.nome}>Conferência do comprovante</Text>
                      {atendimento.comprovante_url ? (
                        <Pressable onPress={() => Linking.openURL(atendimento.comprovante_url!)} accessibilityRole="link">
                          <Text style={estilos.link}>Abrir comprovante para conferir ↗</Text>
                        </Pressable>
                      ) : <Text style={estilos.comprovanteFalta}>Nenhum comprovante foi anexado.</Text>}
                    </View>
                  ) : null}
                </View>
              );
            })}
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
  metricasFinanceiras: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricaFinanceira: { flex: 1, minWidth: 180, backgroundColor: cores.fundo, borderRadius: raio.campo, padding: 14, gap: 6 },
  rotuloFinanceiro: { color: cores.textoSuave, fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  valorFinanceiro: { color: cores.marinho, fontSize: 26, fontWeight: '800' },
  valor: { color: cores.marinho, fontSize: 15, fontWeight: '700' },
  nome: { color: cores.marinho, fontSize: 16, fontWeight: '700' },
  texto: { color: cores.marinho, fontSize: 14 },
  item: { borderTopWidth: 1, borderTopColor: cores.borda, paddingTop: 14, marginTop: 14, gap: 8 },
  estado: { fontSize: 12, fontWeight: '700', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, overflow: 'hidden' },
  aberto: { backgroundColor: cores.avisoFundo, color: cores.aviso },
  confirmado: { backgroundColor: cores.okFundo, color: cores.ok },
  rejeitado: { backgroundColor: cores.erroFundo, color: cores.erro },
  atendimento: { borderTopWidth: 1, borderTopColor: cores.borda, paddingTop: 14, marginTop: 14, gap: 12 },
  detalhesAtendimento: { borderTopWidth: 1, borderTopColor: cores.borda, paddingTop: 14, gap: 10 },
  comprovanteOk: { color: cores.ok, fontSize: 12, fontWeight: '700' },
  comprovanteFalta: { color: cores.erro, fontSize: 12, fontWeight: '700' },
  contador: { textAlign: 'right', color: cores.textoSuave, fontSize: 12 },
  erro: { color: cores.erro, backgroundColor: cores.erroFundo, padding: 12, borderRadius: raio.campo },
  aviso: { color: cores.ok, backgroundColor: cores.okFundo, padding: 12, borderRadius: raio.campo },
});
