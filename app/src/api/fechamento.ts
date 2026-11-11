import { api } from './cliente';
import { Atendimento } from './parte3';

export type ResumoFechamento = {
  data: string;
  status: 'aberto' | 'confirmado';
  total: number;
  quantidade_atendimentos: number;
  por_barbeiro: {
    barbeiro_id: string;
    nome_completo: string;
    total: number;
    valor_barbeiro: number;
    valor_barbearia: number;
  }[];
  por_forma_pagamento: { dinheiro: number; pix: number; cartao: number };
  demonstracao?: boolean;
};

export const fechamentoApi = {
  resumo: (dia: string) => api.get<ResumoFechamento>(`/fechamento?data=${encodeURIComponent(dia)}`),
  atendimentos: (dia: string) => api.get<Atendimento[]>(`/atendimentos?data=${encodeURIComponent(dia)}`),
  confirmar: (dia: string) => api.post<{ ok: boolean; data: string; status: 'confirmado' }>('/fechamento/confirmar', { data: dia }),
  devolver: (dia: string, justificativa: string) => api.post<{ ok: boolean; data: string; status: 'aberto' }>('/fechamento/devolver', { data: dia, justificativa }),
};
