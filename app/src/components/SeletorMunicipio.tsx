import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import municipios from '../data/municipios.json';
import { cores, raio } from '../theme';

type Municipio = { nome: string; estado: string; uf: string };
type Props = {
  valor: string;
  onChange: (municipio: Municipio | null) => void;
  erro?: string;
};

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export default function SeletorMunicipio({ valor, onChange, erro }: Props) {
  const [busca, setBusca] = useState(valor);
  const [aberto, setAberto] = useState(false);
  const resultados = useMemo(() => {
    const termo = normalizar(busca);
    if (termo.length < 2) return [];
    return (municipios as Municipio[])
      .filter((municipio) => normalizar(`${municipio.nome} ${municipio.estado} ${municipio.uf}`).includes(termo))
      .slice(0, 30);
  }, [busca]);

  return (
    <View style={estilos.grupo}>
      <Text style={estilos.rotulo}>Cidade e estado (opcional)</Text>
      <TextInput
        value={busca}
        onChangeText={(texto) => { setBusca(texto); setAberto(true); onChange(null); }}
        onFocus={() => setAberto(true)}
        placeholder="Pesquise um município ou estado"
        autoCapitalize="words"
        accessibilityLabel="Pesquisar município e estado"
        style={[estilos.campo, erro && estilos.campoErro]}
      />
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
      {aberto && busca.trim().length >= 2 ? (
        <View style={estilos.resultados}>
          {resultados.length ? (
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={estilos.lista}>
              {resultados.map((municipio) => (
                <Pressable
                  accessibilityRole="button"
                  key={`${municipio.nome}-${municipio.uf}`}
                  onPress={() => {
                    onChange(municipio);
                    setBusca(`${municipio.nome} - ${municipio.uf}`);
                    setAberto(false);
                  }}
                  style={estilos.opcao}
                >
                  <Text style={estilos.nome}>{municipio.nome}</Text>
                  <Text style={estilos.estado}>{municipio.estado} ({municipio.uf})</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={estilos.semResultado}>Nenhum município encontrado.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 6, zIndex: 2 },
  rotulo: { fontSize: 14, fontWeight: '500', color: cores.textoSuave },
  campo: { height: 48, borderWidth: 1, borderColor: cores.borda, borderRadius: raio.campo, paddingHorizontal: 14, fontSize: 16, color: cores.texto, backgroundColor: cores.branco },
  campoErro: { borderColor: cores.erro },
  erro: { fontSize: 13, color: cores.erro },
  resultados: { borderWidth: 1, borderColor: cores.borda, borderRadius: raio.campo, backgroundColor: cores.branco, overflow: 'hidden' },
  lista: { maxHeight: 230 },
  opcao: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: cores.borda },
  nome: { color: cores.texto, fontSize: 15, fontWeight: '600' },
  estado: { color: cores.textoSuave, fontSize: 12, marginTop: 2 },
  semResultado: { color: cores.textoSuave, padding: 14 },
});
