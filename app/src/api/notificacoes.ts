import { api } from './cliente';

export type NotificacaoAtendimento = {
  id: string;
  atendimento_id: string;
  atendimento?: { inicio: string } | null;
  titulo: string;
  mensagem: string;
  criado_em: string;
  lida_em: string | null;
};

export type PaginaNotificacoes = {
  notificacoes: NotificacaoAtendimento[];
  nao_lidas: number;
  tem_mais: boolean;
};

export const notificacoesApi = {
  listar: (deslocamento = 0) => api.get<PaginaNotificacoes>(`/notificacoes?deslocamento=${deslocamento}`),
  marcarLida: (id: string) => api.patch<{ id: string; lida_em: string }>(`/notificacoes/${encodeURIComponent(id)}/lida`, {}),
};
