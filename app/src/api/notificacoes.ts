import { api } from './cliente';

export type NotificacaoAtendimento = {
  id: string;
  atendimento_id: string;
  titulo: string;
  mensagem: string;
  criado_em: string;
  lida_em: string | null;
};

export const notificacoesApi = {
  listar: () => api.get<NotificacaoAtendimento[]>('/notificacoes'),
  marcarLida: (id: string) => api.patch<{ id: string; lida_em: string }>(`/notificacoes/${encodeURIComponent(id)}/lida`, {}),
};
