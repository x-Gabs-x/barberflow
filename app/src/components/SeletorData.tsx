import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { cores, raio } from '../theme';

type Props = {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  erro?: string;
};

const diasSemana = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function dataIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function dataLegivel(valor: string) {
  if (!valor) return 'Selecione a data';
  const [ano, mes, dia] = valor.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function SeletorData({ rotulo, valor, onChange, erro }: Props) {
  const [aberto, setAberto] = useState(false);
  const [mesAtual, setMesAtual] = useState(() => {
    const selecionada = valor ? new Date(`${valor}T12:00:00`) : new Date();
    return new Date(selecionada.getFullYear(), selecionada.getMonth(), 1);
  });
  const primeiroDia = (mesAtual.getDay() + 6) % 7;
  const quantidadeDias = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0).getDate();
  const dias = [
    ...Array.from({ length: primeiroDia }, () => null),
    ...Array.from({ length: quantidadeDias }, (_, indice) => indice + 1),
  ];

  function mudarMes(deslocamento: number) {
    setMesAtual((atual) => new Date(atual.getFullYear(), atual.getMonth() + deslocamento, 1));
  }

  function selecionarDia(dia: number) {
    onChange(dataIso(new Date(mesAtual.getFullYear(), mesAtual.getMonth(), dia)));
    setAberto(false);
  }

  return (
    <View style={estilos.grupo}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${rotulo}: ${dataLegivel(valor)}`}
        onPress={() => setAberto(true)}
        style={[estilos.campo, erro && estilos.campoErro]}
      >
        <Text style={[estilos.valor, !valor && estilos.placeholder]}>{dataLegivel(valor)}</Text>
        <Text style={estilos.icone}>▦</Text>
      </Pressable>
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <View style={estilos.fundoModal}>
          <View style={estilos.calendario}>
            <View style={estilos.cabecalho}>
              <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => mudarMes(-1)} style={estilos.navegacao}>
                <Text style={estilos.seta}>‹</Text>
              </Pressable>
              <Text style={estilos.mes}>{meses[mesAtual.getMonth()]} de {mesAtual.getFullYear()}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => mudarMes(1)} style={estilos.navegacao}>
                <Text style={estilos.seta}>›</Text>
              </Pressable>
            </View>
            <View style={estilos.grade}>
              {diasSemana.map((dia, indice) => (
                <Text key={`${dia}-${indice}`} style={estilos.diaSemana}>{dia}</Text>
              ))}
              {dias.map((dia, indice) => {
                const selecionado = dia !== null && valor === dataIso(new Date(mesAtual.getFullYear(), mesAtual.getMonth(), dia));
                return dia === null ? (
                  <View key={`vazio-${indice}`} style={estilos.dia} />
                ) : (
                  <Pressable
                    key={dia}
                    accessibilityRole="button"
                    accessibilityLabel={`${dia} de ${meses[mesAtual.getMonth()]} de ${mesAtual.getFullYear()}`}
                    accessibilityState={{ selected: selecionado }}
                    onPress={() => selecionarDia(dia)}
                    style={[estilos.dia, selecionado && estilos.diaSelecionado]}
                  >
                    <Text style={[estilos.textoDia, selecionado && estilos.textoDiaSelecionado]}>{dia}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setAberto(false)} style={estilos.cancelar}>
              <Text style={estilos.textoCancelar}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 6 },
  rotulo: { fontSize: 14, fontWeight: '500', color: cores.textoSuave },
  campo: { height: 48, borderWidth: 1, borderColor: cores.borda, borderRadius: raio.campo, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: cores.branco },
  campoErro: { borderColor: cores.erro },
  valor: { fontSize: 16, color: cores.texto },
  placeholder: { color: '#788292' },
  icone: { color: cores.marinho, fontSize: 18 },
  erro: { fontSize: 13, color: cores.erro },
  fundoModal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.48)', padding: 20 },
  calendario: { width: '100%', maxWidth: 360, borderRadius: raio.card, backgroundColor: cores.branco, padding: 18, gap: 14 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navegacao: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundo },
  seta: { color: cores.marinho, fontSize: 27, lineHeight: 30 },
  mes: { color: cores.marinho, fontSize: 17, fontWeight: '700', textTransform: 'capitalize' },
  grade: { flexDirection: 'row', flexWrap: 'wrap' },
  diaSemana: { width: `${100 / 7}%`, textAlign: 'center', color: cores.textoSuave, fontWeight: '700', paddingVertical: 8 },
  dia: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  diaSelecionado: { borderRadius: 24, backgroundColor: cores.marinho },
  textoDia: { color: cores.texto, fontSize: 15 },
  textoDiaSelecionado: { color: cores.branco, fontWeight: '700' },
  cancelar: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 12 },
  textoCancelar: { color: cores.dourado, fontWeight: '700' },
});
