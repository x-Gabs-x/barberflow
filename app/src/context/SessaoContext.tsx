import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, definirSessao, ErroApi, registrarSessaoInvalida } from '../api/cliente';
import { lerSessao, removerSessao, salvarSessao } from '../api/armazenamentoSessao';

export type Perfil = 'dono' | 'parceiro' | 'recepcao';
type Estado = { situacao: 'carregando' | 'autenticada' | 'desconectada' | 'erro'; perfil: Perfil | null };
type Contexto = Estado & {
  entrar: (token: string, barbearia: string, perfil: Perfil) => Promise<void>;
  sair: () => Promise<void>;
  tentarNovamente: () => void;
};

const SessaoContext = createContext<Contexto | null>(null);
const desconectada: Estado = { situacao: 'desconectada', perfil: null };

function perfilValido(valor: unknown): valor is Perfil {
  return valor === 'dono' || valor === 'parceiro' || valor === 'recepcao';
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ situacao: 'carregando', perfil: null });
  const [tentativa, setTentativa] = useState(0);

  const sair = useCallback(async () => {
    definirSessao({ token: null, barbearia: null, perfilDeTeste: null });
    setEstado(desconectada);
    await removerSessao();
  }, []);

  const entrar = useCallback(async (token: string, barbearia: string, perfil: Perfil) => {
    await salvarSessao({ token, barbearia });
    definirSessao({ token, barbearia, perfilDeTeste: null });
    setEstado({ situacao: 'autenticada', perfil });
  }, []);

  useEffect(() => {
    registrarSessaoInvalida(() => { void sair(); });
    return () => registrarSessaoInvalida(null);
  }, [sair]);

  useEffect(() => {
    let ativo = true;
    async function recuperar() {
      setEstado({ situacao: 'carregando', perfil: null });
      try {
        const salva = await lerSessao();
        if (!ativo) return;
        if (!salva) {
          await sair();
          return;
        }
        definirSessao({ ...salva, perfilDeTeste: null });
        const usuario = await api.get<{ perfil: unknown }>('/me');
        if (!ativo) return;
        if (!perfilValido(usuario.perfil)) {
          await sair();
          return;
        }
        setEstado({ situacao: 'autenticada', perfil: usuario.perfil });
      } catch (erro) {
        if (!ativo) return;
        if (erro instanceof ErroApi && (erro.status === 401 || erro.status === 403)) {
          await sair();
        } else {
          definirSessao({ token: null, barbearia: null, perfilDeTeste: null });
          setEstado({ situacao: 'erro', perfil: null });
        }
      }
    }
    void recuperar();
    return () => { ativo = false; };
  }, [sair, tentativa]);

  return <SessaoContext.Provider value={{ ...estado, entrar, sair, tentarNovamente: () => setTentativa((n) => n + 1) }}>
    {children}
  </SessaoContext.Provider>;
}

export function useSessao() {
  const contexto = useContext(SessaoContext);
  if (!contexto) throw new Error('SessaoProvider ausente');
  return contexto;
}

export function rotaDoPerfil(perfil: Perfil) {
  if (perfil === 'dono') return '/dono/agenda';
  if (perfil === 'parceiro') return '/parceiro/agenda';
  return '/recepcao/atendimentos';
}
