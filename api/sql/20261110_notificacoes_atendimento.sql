create table if not exists public.notificacao_atendimento (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimento(id) on delete cascade,
  usuario_id uuid not null references public.usuario(id) on delete cascade,
  atendimento_id uuid not null references public.atendimento(id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  criado_em timestamptz not null default now(),
  lida_em timestamptz
);

create index if not exists notificacao_atendimento_usuario_data_idx
  on public.notificacao_atendimento (estabelecimento_id, usuario_id, criado_em desc);

alter table public.notificacao_atendimento enable row level security;
revoke all on public.notificacao_atendimento from public, anon, authenticated;
grant all on public.notificacao_atendimento to service_role;

create or replace function public.bf_notificar_atendimento_encerrado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_barbeiro text;
  v_cliente text;
begin
  if new.status <> 'registrado' or old.status = 'registrado' then
    return new;
  end if;

  select nome_completo into v_barbeiro
    from public.usuario where id = new.barbeiro_id;
  select nome_completo into v_cliente
    from public.cliente where id = new.cliente_id;

  insert into public.notificacao_atendimento (
    estabelecimento_id, usuario_id, atendimento_id, titulo, mensagem
  )
  select
    new.estabelecimento_id,
    v.usuario_id,
    new.id,
    'Atendimento encerrado',
    format(
      '%s encerrou o atendimento de %s. Total: R$ %s. Confira os detalhes na agenda.',
      coalesce(v_barbeiro, 'O barbeiro'),
      coalesce(v_cliente, 'cliente não informado'),
      to_char(coalesce(new.valor_total, 0), 'FM999999990D00')
    )
  from public.vinculo v
  where v.estabelecimento_id = new.estabelecimento_id
    and v.perfil = 'dono'
    and v.status = 'ativo';

  return new;
end;
$$;

drop trigger if exists atendimento_notificar_donos_ao_encerrar on public.atendimento;
create trigger atendimento_notificar_donos_ao_encerrar
after update of status on public.atendimento
for each row execute function public.bf_notificar_atendimento_encerrado();

revoke all on function public.bf_notificar_atendimento_encerrado() from public, anon, authenticated;
