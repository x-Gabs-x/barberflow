import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import Botao from './Botao';
import Card from './Card';
import Campo from './Campo';
import { cores, raio } from '../theme';
import { ErroApi, enviarComprovante } from '../api/cliente';
import { alternarServico, normalizarSelecionados } from '../api/combinacoes';
import { Atendimento, Cliente, EditarAtendimento, Perfil, Servico, dinheiro, horaLocal, mensagemErro, parte3Api, statusNome } from '../api/parte3';

type Arquivo = { nome: string; tamanho: number; tipo: string; arquivo: Blob };
const formas = [
  { id: 'dinheiro', nome: 'Dinheiro' },
  { id: 'pix', nome: 'Pix' },
  { id: 'cartao', nome: 'Cartão' },
] as const;

function formatarCpf(texto: string) {
  return texto.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatarTelefone(texto: string) {
  const numero = texto.replace(/\D/g, '').slice(0, 11);
  if (numero.length <= 2) return numero ? `(${numero}` : '';
  if (numero.length <= 10) return numero.replace(/^(\d{2})(\d{0,4})(\d{0,4})$/, (_, ddd, inicio, fim) => `(${ddd}) ${inicio}${fim ? `-${fim}` : ''}`);
  return numero.replace(/^(\d{2})(\d{0,5})(\d{0,4})$/, (_, ddd, inicio, fim) => `(${ddd}) ${inicio}${fim ? `-${fim}` : ''}`);
}

export default function AtendimentoParte3({ perfil }: { perfil: Perfil }) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [atendimento, setAtendimento] = useState<Atendimento | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [resultadosCliente, setResultadosCliente] = useState<Cliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [cpfNovo, setCpfNovo] = useState('');
  const [nomeNovo, setNomeNovo] = useState('');
  const [telefoneNovo, setTelefoneNovo] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [pagamento, setPagamento] = useState<EditarAtendimento['forma_pagamento']>(null);
  const [observacoes, setObservacoes] = useState('');
  const [arquivo, setArquivo] = useState<Arquivo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [demonstracao, setDemonstracao] = useState(false);
  const [requerLogin, setRequerLogin] = useState(false);

  const bloqueado = !!atendimento && atendimento.status !== 'em_andamento';
  const idBancoValido = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const servicosUsaveis = servicos.filter((s) => demonstracao || idBancoValido(s.id));
  const servicosAtivos = servicosUsaveis.filter((s) => s.ativo);
  const podeEditar = !!atendimento && !bloqueado;
  const valor = selecionados.reduce((total, idServico) => total + Number(servicosUsaveis.find((s) => s.id === idServico)?.preco || 0), 0);
  const agendaRota = perfil === 'dono' ? '/dono/agenda' : '/parceiro/agenda';

  const exibirErro = useCallback((erroApi: unknown, contexto?: string) => {
    setErro(contexto ? `${contexto}: ${mensagemErro(erroApi)}` : mensagemErro(erroApi));
    if (erroApi instanceof ErroApi && erroApi.status === 401) setRequerLogin(true);
  }, []);

  function preencher(a: Atendimento) {
    setAtendimento(a);
    if (a.demonstracao) setDemonstracao(true);
    const c = a.cliente as Cliente | null;
    setCliente(c);
    setSelecionados(a.status === 'em_andamento' ? normalizarSelecionados(a.servicos.map((s) => s.id), a.servicos) : a.servicos.map((s) => s.id).filter(Boolean));
    setPagamento(a.forma_pagamento === 'cartao' ? null : a.forma_pagamento);
    setObservacoes(a.observacoes || '');
    setBuscaCliente('');
    setResultadosCliente([]);
  }

  useFocusEffect(useCallback(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    Promise.all([
      parte3Api.servicos(),
      id ? parte3Api.atendimento(id) : parte3Api.agenda(),
    ]).then(([lista, dados]) => {
      if (!ativo) return;
      setServicos(lista);
      if ('atendimentos' in dados) {
        setDemonstracao(!!dados.demonstracao);
        if (dados.em_andamento) preencher(dados.em_andamento);
        else setAtendimento(null);
      } else preencher(dados);
    }).catch((e) => { if (ativo) exibirErro(e); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [exibirErro, id]));

  useEffect(() => {
    const consulta = buscaCliente.trim();
    if (!podeEditar || consulta.length < 2) {
      setResultadosCliente([]);
      setBuscandoClientes(false);
      return;
    }

    let ativo = true;
    const temporizador = setTimeout(() => {
      setBuscandoClientes(true);
      parte3Api.buscarCliente(consulta)
        .then((clientes) => {
          if (ativo) setResultadosCliente(clientes);
        })
        .catch((e) => {
          if (ativo) exibirErro(e);
        })
        .finally(() => {
          if (ativo) setBuscandoClientes(false);
        });
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(temporizador);
    };
  }, [buscaCliente, exibirErro, podeEditar]);

  async function iniciar() {
    if (salvando) return;
    setSalvando(true); setErro(''); setAviso('');
    try {
      const a = await parte3Api.iniciar();
      preencher(a);
      router.setParams({ id: a.id });
      setAviso('Atendimento iniciado. Informe o cliente e os serviços.');
    } catch (e) { exibirErro(e); }
    finally { setSalvando(false); }
  }

  function selecionarCliente(selecionado: Cliente) {
    setCliente(selecionado);
    setBuscaCliente('');
    setResultadosCliente([]);
    setErro('');
    setAviso(`Cliente selecionado: ${selecionado.nome_completo}`);
  }

  async function cadastrarCliente() {
    const cpf = cpfNovo.replace(/\D/g, '');
    if (cpf.length !== 11) { setErro('Informe os 11 dígitos do CPF do novo cliente.'); return; }
    if (!nomeNovo.trim()) { setErro('Informe o nome completo do cliente.'); return; }
    setSalvando(true);
    setErro('');
    try {
      const telefone = telefoneNovo.replace(/\D/g, '');
      const c = await parte3Api.cadastrarCliente({
        cpf,
        nome_completo: nomeNovo.trim(),
        ...(telefone ? { telefone } : {}),
      });
      selecionarCliente(c);
      setCpfNovo('');
      setNomeNovo('');
      setTelefoneNovo('');
      setAviso('Cliente cadastrado e selecionado para o atendimento.');
    } catch (e) { exibirErro(e); }
    finally { setSalvando(false); }
  }

  function trocarServico(idServico: string) {
    setSelecionados((atual) => alternarServico(atual, idServico, servicosUsaveis));
  }

  async function escolherArquivo() {
    setErro('');
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'], copyToCacheDirectory: true, multiple: false,
      });
      if (resultado.canceled || !resultado.assets.length) return;
      const escolhido = resultado.assets[0];
      const tipo = escolhido.mimeType === 'image/jpg' ? 'image/jpeg' :
        ['image/jpeg', 'image/png', 'application/pdf'].includes(escolhido.mimeType || '') ? escolhido.mimeType! :
        /\.pdf$/i.test(escolhido.name) ? 'application/pdf' :
        /\.png$/i.test(escolhido.name) ? 'image/png' :
        /\.jpe?g$/i.test(escolhido.name) ? 'image/jpeg' : '';
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(tipo)) {
        setErro('Selecione um JPG, PNG ou PDF.'); return;
      }
      if ((escolhido.size || 0) > 6 * 1024 * 1024) {
        setErro('O arquivo deve ter até 6 MB.'); return;
      }
      const binario = escolhido.file || await (await fetch(escolhido.uri)).blob();
      if (binario.size > 6 * 1024 * 1024) { setErro('O arquivo deve ter até 6 MB.'); return; }
      setArquivo({ nome: escolhido.name, tamanho: binario.size, tipo, arquivo: binario });
    } catch (e) { exibirErro(e, 'Não foi possível abrir o arquivo'); }
  }

  async function enviarArquivo(idAtendimento: string) {
    if (!arquivo) return;
    await enviarComprovante(idAtendimento, arquivo.arquivo, arquivo.tipo);
    setArquivo(null);
  }

  function dadosFormulario(): EditarAtendimento {
    return { cliente_id: cliente?.id || null, servicos: selecionados, observacoes,
      forma_pagamento: pagamento || null, nsu: null };
  }

  async function encerrarAtendimento() {
    if (!atendimento || salvando) return;
    if (!cliente) return setErro('Selecione ou cadastre um cliente antes de encerrar.');
    if (!selecionados.length) return setErro('Selecione pelo menos um serviço.');
    if (!pagamento) return setErro('Selecione a forma de pagamento.');
    setSalvando(true); setErro(''); setAviso('');
    try {
      if (arquivo) await enviarArquivo(atendimento.id);
      await parte3Api.encerrar(atendimento.id, dadosFormulario());
      router.replace(agendaRota);
    } catch (e) {
      exibirErro(e);
    } finally { setSalvando(false); }
  }

  async function anexarDepois() {
    if (!atendimento || !arquivo || salvando) return;
    setSalvando(true); setErro('');
    try {
      await enviarArquivo(atendimento.id);
      preencher(await parte3Api.atendimento(atendimento.id));
      setAviso('Comprovante enviado com sucesso.');
    } catch (e) { exibirErro(e); }
    finally { setSalvando(false); }
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.pagina} keyboardShouldPersistTaps="handled">
      <View style={estilos.cabecalho}>
        <Pressable accessibilityRole="button" onPress={() => router.replace(agendaRota)}><Text style={estilos.link}>‹ Voltar para agenda</Text></Pressable>
        <Text style={estilos.marca}>BARBERFLOW  /  ATENDIMENTOS</Text>
        <Text style={estilos.titulo}>{bloqueado ? 'Resumo do atendimento' : atendimento ? 'Atendimento em andamento' : 'Novo atendimento'}</Text>
        <Text style={estilos.subtitulo}>Registre cliente, serviços, pagamento e comprovante em uma única ficha.</Text>
      </View>
      {demonstracao ? <Text style={estilos.demo}>AMBIENTE DE TESTE · Dados temporários, sem gravação real no Supabase.</Text> : null}
      {erro ? <Text accessibilityRole="alert" style={estilos.erro}>{erro}</Text> : null}
      {requerLogin ? <Botao titulo="Ir para o login e continuar" onPress={() => router.replace('/acesso/login')} /> : null}
      {aviso ? <Text style={estilos.aviso}>{aviso}</Text> : null}
      {carregando ? <ActivityIndicator color={cores.dourado} size="large" /> : null}

      {!carregando && !atendimento ? (
        <Card>
          <Text style={estilos.secao}>Pronto para iniciar?</Text>
          <Text style={estilos.suave}>O horário de início será registrado agora. Você poderá salvar o atendimento parcialmente antes de encerrá-lo.</Text>
          <Botao titulo={salvando ? 'Iniciando…' : 'Iniciar atendimento'} onPress={iniciar} desabilitado={salvando} />
          <Botao titulo="Voltar para agenda" variante="secundario" onPress={() => router.replace(agendaRota)} />
        </Card>
      ) : null}

      {atendimento ? (
        <>
          <Card>
            <View style={estilos.linha}><Text style={estilos.secao}>Dados gerais</Text><Text style={estilos.status}>{statusNome(atendimento.status)}</Text></View>
            <Text style={estilos.suave}>Início: {horaLocal(atendimento.inicio)}  {atendimento.fim ? ` •  Término: ${horaLocal(atendimento.fim)}` : ''}</Text>
            <Text style={estilos.suave}>Profissional: {atendimento.barbeiro.nome_completo}</Text>
          </Card>

          <Card>
            <Text style={estilos.secao}>01  ·  Cliente</Text>
            {cliente ? (
              <View style={estilos.selecionado}>
                <Text style={estilos.nome}>{cliente.nome_completo}</Text>
                <Text style={estilos.suave}>CPF: {cliente.cpf}</Text>
                {podeEditar ? <Pressable onPress={() => setCliente(null)}><Text style={estilos.link}>Trocar cliente</Text></Pressable> : null}
              </View>
            ) : !podeEditar ? <Text style={estilos.suave}>Cliente não informado.</Text> : null}
            {podeEditar ? (
              <>
                <Campo
                  rotulo="Buscar cliente por nome ou CPF"
                  valor={buscaCliente}
                  onChangeText={setBuscaCliente}
                  placeholder="Digite o nome ou CPF"
                  autoCapitalize="words"
                />
                {buscandoClientes ? <ActivityIndicator color={cores.dourado} /> : null}
                {resultadosCliente.length > 0 ? (
                  <View style={estilos.dropdown}>
                    {resultadosCliente.map((resultado) => (
                      <Pressable
                        key={resultado.id}
                        accessibilityRole="button"
                        onPress={() => selecionarCliente(resultado)}
                        style={estilos.opcaoCliente}
                      >
                        <Text style={estilos.nome}>{resultado.nome_completo}</Text>
                        <Text style={estilos.suave}>CPF: {formatarCpf(resultado.cpf)}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {buscaCliente.trim().length >= 2 && !buscandoClientes && !resultadosCliente.length
                  ? <Text style={estilos.suave}>Nenhum cliente encontrado. Você pode cadastrá-lo abaixo.</Text>
                  : null}
                <View style={estilos.grupo}>
                  <Text style={estilos.rotulo}>NOVO CLIENTE</Text>
                  <Text style={estilos.suave}>Cadastre os dados abaixo para vincular um novo cliente ao atendimento.</Text>
                  <Campo
                    rotulo="Nome completo"
                    valor={nomeNovo}
                    onChangeText={setNomeNovo}
                    placeholder="Nome do cliente"
                    autoCapitalize="words"
                  />
                  <Campo
                    rotulo="CPF"
                    valor={formatarCpf(cpfNovo)}
                    onChangeText={(texto) => setCpfNovo(texto.replace(/\D/g, '').slice(0, 11))}
                    placeholder="000.000.000-00"
                    keyboardType="numeric"
                  />
                  <Campo
                    rotulo="Telefone (opcional)"
                    valor={formatarTelefone(telefoneNovo)}
                    onChangeText={(texto) => setTelefoneNovo(texto.replace(/\D/g, '').slice(0, 11))}
                    placeholder="(83) 99999-9999"
                    keyboardType="phone-pad"
                  />
                  <Botao titulo="Cadastrar cliente e vincular ao atendimento" onPress={cadastrarCliente} desabilitado={salvando} />
                </View>
              </>
            ) : null}
          </Card>

          <Card>
            <Text style={estilos.secao}>02  ·  Serviços executados</Text>
            {!bloqueado && !servicosAtivos.length ? (
              <View style={estilos.avisoServicos}>
                <Text style={estilos.avisoTexto}>Nenhum serviço cadastrado, solicite o cadastramento para prosseguir.</Text>
                {perfil === 'dono' ? <Botao titulo="Cadastrar serviços" onPress={() => router.push('/dono/servicos')} /> : null}
              </View>
            ) : null}
            {(bloqueado ? atendimento.servicos.map((s) => ({ ...s, ativo: true })) : servicosUsaveis.filter((s) => s.ativo || selecionados.includes(s.id))).map((s) => (
              <Pressable key={s.id} disabled={bloqueado || !s.ativo} onPress={() => trocarServico(s.id)} style={[estilos.opcaoServico, selecionados.includes(s.id) && estilos.opcaoSelecionada]}>
                <View style={[estilos.checkbox, selecionados.includes(s.id) && estilos.checkboxMarcado]}><Text style={estilos.checkTexto}>{selecionados.includes(s.id) ? '✓' : ''}</Text></View>
                <View style={{ flex: 1 }}><Text style={estilos.nome}>{s.nome}</Text>{!s.ativo ? <Text style={estilos.suave}>Inativo</Text> : null}</View>
                <Text style={estilos.valor}>{dinheiro(Number(s.preco))}</Text>
              </Pressable>
            ))}
            <View style={estilos.total}><Text style={estilos.nome}>Valor total</Text><Text style={estilos.valorDestaque}>{dinheiro(bloqueado ? atendimento.valor_total : valor)}</Text></View>
            {!bloqueado ? <Text style={estilos.suave}>Combos substituem os serviços avulsos incluídos neles. O valor será confirmado pela API com os preços cadastrados.</Text> : null}
          </Card>

          <Card>
            <Text style={estilos.secao}>03  ·  Pagamento</Text>
            <View style={estilos.formas}>
              {formas.map((forma) => (
                <Pressable key={forma.id} disabled={bloqueado} onPress={() => setPagamento(forma.id)} style={[estilos.forma, pagamento === forma.id && estilos.formaAtiva]}>
                  <Text style={[estilos.formaTexto, pagamento === forma.id && estilos.formaTextoAtiva]}>{forma.nome}</Text>
                </Pressable>
              ))}
            </View>
            {bloqueado && atendimento.nsu ? <Text style={estilos.suave}>Identificador: {atendimento.nsu}</Text> : null}
            {!bloqueado ? <Campo rotulo="Observações (opcional)" valor={observacoes} onChangeText={setObservacoes} placeholder="Detalhes adicionais do atendimento" />
              : atendimento.observacoes ? <Text style={estilos.suave}>Observações: {atendimento.observacoes}</Text> : null}
          </Card>

          <Card>
            <Text style={estilos.secao}>04  ·  Comprovante</Text>
            <Text style={estilos.suave}>JPG, PNG ou PDF até 6 MB. O comprovante fica protegido no Supabase Storage e é necessário para a recepção validar o atendimento.</Text>
            <View style={estilos.selecionado}>
              <Text style={atendimento.comprovante_anexado ? estilos.sucessoTexto : estilos.avisoTexto}>
                {atendimento.comprovante_anexado ? '✓ Comprovante anexado' : 'Sem comprovante enviado'}
              </Text>
              {atendimento.comprovante_url ? <Pressable onPress={() => Linking.openURL(atendimento.comprovante_url!)}><Text style={estilos.link}>Visualizar comprovante ↗</Text></Pressable> : null}
            </View>
            {!bloqueado || atendimento.status === 'registrado' ? (
              <>
                <Botao titulo="Selecionar comprovante" variante="secundario" onPress={escolherArquivo} desabilitado={salvando} />
                {arquivo ? <Text style={estilos.suave}>Selecionado: {arquivo.nome} ({Math.ceil(arquivo.tamanho / 1024)} KB)</Text> : null}
                {bloqueado && arquivo ? <Botao titulo="Enviar comprovante" onPress={anexarDepois} desabilitado={salvando} /> : null}
              </>
            ) : null}
          </Card>

          {bloqueado ? (
            <Card>
              <Text style={estilos.secao}>Atendimento {statusNome(atendimento.status).toLowerCase()}</Text>
              <Text style={estilos.suave}>Total: {dinheiro(atendimento.valor_total)}. Repasse do profissional: {dinheiro(atendimento.valor_barbeiro)}. Barbearia: {dinheiro(atendimento.valor_barbearia)}.</Text>
              <Botao titulo="Voltar para agenda" onPress={() => router.replace(agendaRota)} />
            </Card>
          ) : (
            <View style={estilos.acoes}>
              {erro ? <Text accessibilityRole="alert" style={estilos.erro}>{erro}</Text> : null}
              <Text style={estilos.suave}>Ao encerrar, o atendimento será enviado para a recepção. Sem comprovante, ele poderá ser registrado, mas não validado.</Text>
              <Botao titulo={salvando ? 'Encerrando…' : 'Encerrar atendimento'} onPress={encerrarAtendimento} desabilitado={salvando} />
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  pagina: { width: '100%', maxWidth: 850, alignSelf: 'center', padding: 20, paddingBottom: 55, gap: 16 },
  cabecalho: { gap: 6, paddingVertical: 8 },
  marca: { color: cores.dourado, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  titulo: { color: cores.marinho, fontSize: 27, fontWeight: '800' },
  subtitulo: { color: cores.textoSuave, fontSize: 14, lineHeight: 21 },
  secao: { color: cores.marinho, fontSize: 18, fontWeight: '700' },
  rotulo: { color: cores.marinho, fontSize: 16, fontWeight: '700' },
  nome: { color: cores.marinho, fontSize: 15, fontWeight: '700' },
  suave: { color: cores.textoSuave, fontSize: 13, lineHeight: 20 },
  link: { color: cores.dourado, fontWeight: '700', fontSize: 14 },
  grupo: { gap: 12, borderTopColor: cores.borda, borderTopWidth: 1, marginTop: 6, paddingTop: 14 },
  selecionado: { borderRadius: raio.campo, backgroundColor: cores.fundo, padding: 14, gap: 6 },
  dropdown: { maxHeight: 260, borderWidth: 1, borderColor: cores.borda, borderRadius: raio.campo, overflow: 'hidden', backgroundColor: cores.branco },
  opcaoCliente: { padding: 12, gap: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: cores.borda },
  avisoServicos: { gap: 12, padding: 14, borderRadius: raio.campo, backgroundColor: cores.avisoFundo },
  opcaoServico: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: cores.borda, borderRadius: raio.campo, padding: 14 },
  opcaoSelecionada: { borderColor: cores.dourado, backgroundColor: cores.avisoFundo },
  checkbox: { height: 23, width: 23, borderWidth: 1, borderColor: cores.borda, borderRadius: 6, backgroundColor: cores.branco, alignItems: 'center', justifyContent: 'center' },
  checkboxDesabilitado: { backgroundColor: cores.fundo },
  checkboxMarcado: { backgroundColor: cores.dourado, borderColor: cores.dourado },
  checkTexto: { color: cores.marinho, fontWeight: '700', fontSize: 13 },
  valor: { color: cores.marinho, fontSize: 15, fontWeight: '700' },
  valorDestaque: { color: cores.dourado, fontSize: 23, fontWeight: '800' },
  total: { borderTopWidth: 1, borderTopColor: cores.borda, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  formas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  forma: { flex: 1, minWidth: 90, borderWidth: 1, borderColor: cores.borda, paddingVertical: 13, paddingHorizontal: 10, borderRadius: raio.campo, alignItems: 'center' },
  formaAtiva: { backgroundColor: cores.marinho, borderColor: cores.dourado },
  faseDesabilitada: { opacity: 0.65 },
  formaTexto: { color: cores.textoSuave, fontWeight: '700' }, formaTextoAtiva: { color: cores.branco },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  status: { backgroundColor: cores.avisoFundo, color: cores.aviso, borderRadius: 8, padding: 7, fontWeight: '600', fontSize: 12, overflow: 'hidden' },
  acoes: { gap: 12 },
  erro: { backgroundColor: cores.erroFundo, color: cores.erro, borderRadius: raio.campo, padding: 12 },
  aviso: { backgroundColor: cores.okFundo, color: cores.ok, borderRadius: raio.campo, padding: 12 },
  demo: { backgroundColor: cores.avisoFundo, color: cores.aviso, borderRadius: raio.campo, padding: 12 },
  sucessoTexto: { color: cores.ok, fontWeight: '700' }, avisoTexto: { color: cores.aviso, fontWeight: '700' },
});
