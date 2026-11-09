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

export type CampoComErro = { campo: string; mensagem: string };

export class ErroApi extends Error {
  status: number;
  codigo: string;
  campos: CampoComErro[];
  constructor(status: number, codigo: string, mensagem: string, campos: CampoComErro[] = []) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

export function errosPorCampo(erro: unknown): Record<string, string> {
  const resultado: Record<string, string> = {};
  if (!(erro instanceof ErroApi)) return resultado;
  for (const { campo, mensagem } of erro.campos) {
    const chave = campo === '' ? 'geral' : campo;
    if (!resultado[chave]) resultado[chave] = mensagem;
  }
  return resultado;
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
    const campos: CampoComErro[] = Array.isArray(dados?.campos) ? dados.campos : [];
    throw new ErroApi(
      resposta.status,
      dados?.erro ?? 'desconhecido',
      dados?.mensagem ?? 'Algo deu errado.',
      campos
    );
  }
  return dados as T;
}

export const api = {
  get: <T>(caminho: string) => chamar<T>('GET', caminho),
  post: <T>(caminho: string, corpo?: unknown) => chamar<T>('POST', caminho, corpo),
  patch: <T>(caminho: string, corpo?: unknown) => chamar<T>('PATCH', caminho, corpo),
  delete: <T>(caminho: string) => chamar<T>('DELETE', caminho),
};
export async function enviarComprovante(id: string, arquivo: Blob, mime: string) {
  const cabecalhos: Record<string, string> = { 'Content-Type': mime };
  if (sessao.token) cabecalhos.Authorization = `Bearer ${sessao.token}`;
  if (sessao.perfilDeTeste) cabecalhos['x-dev-perfil'] = sessao.perfilDeTeste;
  if (sessao.barbearia) cabecalhos['x-barbearia'] = sessao.barbearia;
  const resposta = await fetch(`${URL_API}/atendimentos/${encodeURIComponent(id)}/comprovante`, {
    method: 'POST', headers: cabecalhos, body: arquivo,
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new ErroApi(resposta.status, dados?.erro ?? 'arquivo_invalido', dados?.mensagem ?? 'Não foi possível enviar o comprovante.');
  return dados as { comprovante_url: string | null; comprovante_anexado: boolean };
}
