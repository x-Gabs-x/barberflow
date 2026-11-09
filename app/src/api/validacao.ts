import { api } from './cliente';
import { Atendimento } from './parte3';
export type CorrecaoRecepcao = {
  observacoes?: string | null;
  forma_pagamento?: 'dinheiro' | 'pix' | 'cartao';
  nsu?: string | null;
};
export const recepcaoApi = {
  listar: (dia: string) => api.get<Atendimento[]>(`/atendimentos?data=${encodeURIComponent(dia)}`),
  validar: (id: string) => api.post<Atendimento>(`/atendimentos/${encodeURIComponent(id)}/validar`, {}),
  rejeitar: (id: string, justificativa: string) => api.post<Atendimento>(`/atendimentos/${encodeURIComponent(id)}/rejeitar`, { justificativa }),
  corrigir: (id: string, dados: CorrecaoRecepcao) => api.patch<Atendimento>(`/atendimentos/${encodeURIComponent(id)}/corrigir`, dados),
};
