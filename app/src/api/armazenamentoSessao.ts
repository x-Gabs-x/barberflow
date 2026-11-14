import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHAVE = 'barberflow.sessao.v1';

export type SessaoPersistida = { token: string; barbearia: string };

export async function lerSessao(): Promise<SessaoPersistida | null> {
  const valor = Platform.OS === 'web'
    ? (typeof window === 'undefined' ? null : window.sessionStorage.getItem(CHAVE))
    : await SecureStore.getItemAsync(CHAVE);
  if (!valor) return null;
  try {
    const dados: unknown = JSON.parse(valor);
    if (dados && typeof dados === 'object' &&
      typeof (dados as SessaoPersistida).token === 'string' &&
      typeof (dados as SessaoPersistida).barbearia === 'string' &&
      (dados as SessaoPersistida).token && (dados as SessaoPersistida).barbearia) {
      return { token: (dados as SessaoPersistida).token, barbearia: (dados as SessaoPersistida).barbearia };
    }
  } catch { /* dado corrompido será removido pelo fluxo de recuperação */ }
  return null;
}

export async function salvarSessao(sessao: SessaoPersistida): Promise<void> {
  const valor = JSON.stringify(sessao);
  if (Platform.OS === 'web') {
    window.sessionStorage.setItem(CHAVE, valor);
  } else {
    await SecureStore.setItemAsync(CHAVE, valor);
  }
}

export async function removerSessao(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(CHAVE);
  } else {
    await SecureStore.deleteItemAsync(CHAVE);
  }
}
