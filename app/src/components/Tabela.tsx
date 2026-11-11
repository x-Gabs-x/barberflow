import { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { cores, raio } from '../theme';

type Coluna = {
  chave: string;
  titulo: string;
  flex?: number;
  alinhar?: 'left' | 'right' | 'center';
};

type Linha = { id: string; [chave: string]: ReactNode };

type Props = {
  colunas: Coluna[];
  linhas: Linha[];
  vazio?: string;
};

const alinhamento = { left: 'flex-start', right: 'flex-end', center: 'center' } as const;

export default function Tabela({ colunas, linhas, vazio = 'Nenhum registro.' }: Props) {
  return (
    <View style={estilos.tabela}>
      <View style={[estilos.linha, estilos.cabecalho]}>
        {colunas.map((c) => (
          <View key={c.chave} style={{ flex: c.flex ?? 1, alignItems: alinhamento[c.alinhar ?? 'left'] }}>
            <Text style={estilos.titulo}>{c.titulo}</Text>
          </View>
        ))}
      </View>

      {linhas.length === 0 ? (
        <Text style={estilos.vazio}>{vazio}</Text>
      ) : (
        linhas.map((linha, i) => (
          <View key={linha.id} style={[estilos.linha, i < linhas.length - 1 && estilos.divisor]}>
            {colunas.map((c) => {
              const valor = linha[c.chave];
              const simples = typeof valor === 'string' || typeof valor === 'number';
              return (
                <View key={c.chave} style={{ flex: c.flex ?? 1, alignItems: alinhamento[c.alinhar ?? 'left'] }}>
                  {simples ? <Text style={estilos.celula}>{valor}</Text> : valor}
                </View>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tabela: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.campo,
    backgroundColor: cores.branco,
    overflow: 'hidden',
  },
  linha: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 8 },
  cabecalho: { backgroundColor: cores.fundo },
  divisor: { borderBottomWidth: 1, borderBottomColor: cores.borda },
  titulo: { fontSize: 13, fontWeight: '600', color: cores.textoSuave },
  celula: { fontSize: 15, color: cores.texto },
  vazio: { padding: 16, fontSize: 14, color: cores.textoSuave, textAlign: 'center' },
});