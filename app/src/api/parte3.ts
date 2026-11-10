import { api } from './cliente';

export type Perfil = 'dono' | 'parceiro';
export type StatusAtendimento = 'em_andamento' | 'registrado' | 'validado_recepcao' | 'validado_dono' | 'rejeitado';
export type Servico = { id: string; nome: string; preco: number; ativo: boolean };
export type Pessoa = { id: string; nome_completo: string; cpf?: string; telefone?: string | null };
export type Atendimento = {
  id: string;
  barbeiro: Pessoa;
  cliente: Pessoa | null;
  inicio: string;
  fim: string | null;
  servicos: { id: string; nome: string; preco: number }[];
  valor_total: number;
  observacoes: string;
  forma_pagamento: 'dinheiro' | 'pix' | 'cartao' | null;
  nsu: string | null;
  comprovante_url: string | null;
  comprovante_anexado: boolean;
  escote_percentual: number | null;
  valor_barbeiro: number;
  valor_barbearia: number;
  status: StatusAtendimento;
  demonstracao?: boolean;
  justificativa_rejeicao?: string | null;
};
export type AgendaDia = {
  data: string;
  hora_abertura: string;
  hora_fechamento: string;
  em_andamento: Atendimento | null;
  atendimentos: Atendimento[];
  demonstracao?: boolean;
};
export type Cliente = Pessoa & { cpf: string };
export type MembroEquipe = { id: string; usuario: Pessoa; perfil: 'dono' | 'parceiro' | 'recepcao'; status: string; escote_percentual: number | null };
export type EditarAtendimento = {
  cliente_id?: string | null;
  servicos?: string[];
  observacoes?: string | null;
  forma_pagamento?: 'dinheiro' | 'pix' | 'cartao' | null;
  nsu?: string | null;
};
export const parte3Api = {
  agenda: (dia?: string) => api.get<AgendaDia>(`/agenda${dia ? `?data=${encodeURIComponent(dia)}` : ''}`),
  atendimento: (id: string) => api.get<Atendimento>(`/atendimentos/${encodeURIComponent(id)}`),
  iniciar: () => api.post<Atendimento>('/atendimentos/iniciar', {}),
  salvar: (id: string, dados: EditarAtendimento) => api.patch<Atendimento>(`/atendimentos/${encodeURIComponent(id)}`, dados),
  encerrar: (id: string, dados: EditarAtendimento) => api.post<Atendimento>(`/atendimentos/${encodeURIComponent(id)}/encerrar`, dados),
  servicos: () => api.get<Servico[]>('/servicos'),
  equipe: () => api.get<MembroEquipe[]>('/equipe'),
  buscarCliente: (cpf: string) => api.get<Cliente[]>(`/clientes?cpf=${encodeURIComponent(cpf)}`),
  cadastrarCliente: (dados: { cpf: string; nome_completo: string; telefone?: string }) => api.post<Cliente>('/clientes', dados),
};
export function dinheiro(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}
export function horaLocal(data: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza' }).format(new Date(data));
}
export function dataLocal(data: Date = new Date()) {
  return data.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}
export function mudarDia(dia: string, deslocamento: number) {
  const valor = new Date(`${dia}T12:00:00Z`);
  valor.setUTCDate(valor.getUTCDate() + deslocamento);
  return valor.toISOString().slice(0, 10);
}
export function diaPorExtenso(dia: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${dia}T12:00:00Z`));
}
export function statusNome(status: StatusAtendimento) {
  const nomes: Record<StatusAtendimento, string> = {
    em_andamento: 'Em andamento', registrado: 'Registrado', validado_recepcao: 'Validado pela recepção',
    validado_dono: 'Validado pelo dono', rejeitado: 'Rejeitado',
  };
  return nomes[status];
}
export function mensagemErro(erro: unknown) {
  return erro instanceof Error ? erro.message : 'Não foi possível comunicar com a API.';
}
