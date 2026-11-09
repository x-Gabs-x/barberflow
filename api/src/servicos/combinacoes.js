function partes(nome) {
  return String(nome).split(/\s*\+\s*/).map((item) => item.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()).filter(Boolean);
}
function conflitam(um, outro) {
  const p1 = partes(um);
  const p2 = partes(outro);
  if (p1.length === 1 && p2.length === 1) return false;
  return p1.some((parte) => p2.includes(parte));
}
function validarSelecao(lista) {
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      if (conflitam(lista[i].nome, lista[j].nome)) return false;
    }
  }
  return true;
}
module.exports = { conflitam, validarSelecao };
