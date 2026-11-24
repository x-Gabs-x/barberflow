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
    and v.status = 'ativo'
    and (
      v.perfil in ('dono', 'recepcao')
      or (v.perfil = 'parceiro' and v.usuario_id = new.barbeiro_id)
    );

  return new;
end;
$$;

revoke all on function public.bf_notificar_atendimento_encerrado() from public, anon, authenticated;
