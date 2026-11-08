import Constants from 'expo-constants';

function enderecoDaApi(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:3000`;
}

export const URL_API = enderecoDaApi();

type Sessao = {
  token: string | null;
  perfilDeTeste: string | null;
  barbearia: string | null;
};

const sessao: Sessao = { token: null, perfilDeTeste: null, barbearia: null };

export function definirSessao(novos: Partial<Sessao>) {
  Object.assign(sessao, novos);
}

export class ErroApi extends Error {
  status: number;
  codigo: string;
  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessao.token) cabecalhos.Authorization = `Bearer ${sessao.token}`;
  if (sessao.perfilDeTeste) cabecalhos['x-dev-perfil'] = sessao.perfilDeTeste;
  if (sessao.barbearia) cabecalhos['x-barbearia'] = sessao.barbearia;

  const resposta = await fetch(`${URL_API}${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    throw new ErroApi(resposta.status, dados?.erro ?? 'desconhecido', dados?.mensagem ?? 'Algo deu errado.');
  }
  return dados as T;
}

export const api = {
  get: <T>(caminho: string) => chamar<T>('GET', caminho),
  post: <T>(caminho: string, corpo?: unknown) => chamar<T>('POST', caminho, corpo),
  patch: <T>(caminho: string, corpo?: unknown) => chamar<T>('PATCH', caminho, corpo),
  delete: <T>(caminho: string) => chamar<T>('DELETE', caminho),
};