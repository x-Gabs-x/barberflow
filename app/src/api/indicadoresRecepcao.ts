import type { Atendimento } from './parte3';

export function calcularIndicadoresRecepcao(lista: Atendimento[]) {
  const pendentes = lista.filter((a) => a.status === 'registrado');
  const prontos = pendentes.filter((a) => a.comprovante_anexado);
  const validados = lista.filter((a) => a.status === 'validado_recepcao' || a.status === 'validado_dono');
  const rejeitados = lista.filter((a) => a.status === 'rejeitado');

  return {
    pendentes,
    prontos,
    validados,
    rejeitados,
    valorPronto: prontos.reduce((total, a) => total + a.valor_total, 0),
    totalValidado: validados.reduce((total, a) => total + a.valor_total, 0),
  };
}
