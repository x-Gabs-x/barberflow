export type ServicoComNome = { id: string; nome: string };
function partes(nome: string) {
  return nome.split(/\s*\+\s*/).map((item) => item.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()).filter(Boolean);
}
export function conflitam(um: string, outro: string) {
  const p1 = partes(um);
  const p2 = partes(outro);
  if (p1.length === 1 && p2.length === 1) return false;
  return p1.some((p) => p2.includes(p));
}
export function alternarServico(atual: string[], clicado: string, catalogo: ServicoComNome[]) {
  if (atual.includes(clicado)) return atual.filter((id) => id !== clicado);
  const novo = catalogo.find((s) => s.id === clicado);
  if (!novo) return atual;
  return [...atual.filter((id) => {
    const escolhido = catalogo.find((s) => s.id === id);
    return escolhido && !conflitam(novo.nome, escolhido.nome);
  }), clicado];
}

export function normalizarSelecionados(ids: string[], catalogo: ServicoComNome[]) {
  const itens = ids.map((id) => catalogo.find((s) => s.id === id)).filter((s): s is ServicoComNome => !!s);
  const ordenados = [...itens.filter((s) => s.nome.includes('+')), ...itens.filter((s) => !s.nome.includes('+'))];
  const selecionados: ServicoComNome[] = [];
  for (const item of ordenados) {
    if (!selecionados.some((s) => s.id === item.id || conflitam(s.nome, item.nome))) selecionados.push(item);
  }
  return selecionados.map((s) => s.id);
}
