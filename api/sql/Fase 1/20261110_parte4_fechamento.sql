alter table public.atendimento
  add column if not exists corrigido_por uuid,
  add column if not exists corrigido_em timestamptz;

alter table public.fechamento
  add column if not exists justificativa_devolucao text,
  add column if not exists devolvido_por uuid,
  add column if not exists devolvido_em timestamptz;

create or replace function public.bf_recepcao_corrigir(
  p_id uuid,
  p_estabelecimento uuid,
  p_usuario uuid,
  p_observacoes text,
  p_definir_observacoes boolean,
  p_forma_pagamento text,
  p_definir_forma_pagamento boolean,
  p_nsu text,
  p_definir_nsu boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not exists (
    select 1 from public.vinculo
     where usuario_id = p_usuario and estabelecimento_id = p_estabelecimento
       and perfil = 'recepcao' and status = 'ativo'
  ) then
    raise exception 'BF_RECEPCAO_SEM_PERMISSAO' using errcode = 'P0001';
  end if;

  select status into v_status
    from public.atendimento
   where id = p_id and estabelecimento_id = p_estabelecimento
   for update;
  if not found then raise exception 'BF_NAO_ENCONTRADO' using errcode = 'P0001'; end if;
  if v_status <> 'registrado' then raise exception 'BF_STATUS_INVALIDO' using errcode = 'P0001'; end if;
  if p_definir_forma_pagamento and p_forma_pagamento not in ('dinheiro', 'pix', 'cartao') then
    raise exception 'BF_PAGAMENTO_INVALIDO' using errcode = 'P0001';
  end if;

  update public.atendimento set
    observacoes = case when p_definir_observacoes then p_observacoes else observacoes end,
    forma_pagamento = case when p_definir_forma_pagamento then p_forma_pagamento else forma_pagamento end,
    nsu = case when p_definir_nsu then p_nsu else nsu end,
    corrigido_por = p_usuario,
    corrigido_em = now()
   where id = p_id and estabelecimento_id = p_estabelecimento;
  return p_id;
end;
$$;

create or replace function public.bf_fechamento_resumo(p_estabelecimento uuid, p_data date, p_usuario uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_total numeric(12,2);
  v_quantidade integer;
  v_por_barbeiro jsonb;
  v_por_forma_pagamento jsonb;
begin
  if not exists (
    select 1 from public.vinculo
     where usuario_id = p_usuario and estabelecimento_id = p_estabelecimento
       and perfil = 'dono' and status = 'ativo'
  ) then
    raise exception 'BF_FECHAMENTO_SEM_PERMISSAO' using errcode = 'P0001';
  end if;

  select status into v_status
    from public.fechamento
   where estabelecimento_id = p_estabelecimento and data = p_data;
  v_status := coalesce(v_status, 'aberto');

  with dia as (
    select a.barbeiro_id, a.forma_pagamento,
           a.valor_total, a.valor_barbeiro, a.valor_barbearia,
           u.nome_completo
      from public.atendimento a
      join public.usuario u on u.id = a.barbeiro_id
     where a.estabelecimento_id = p_estabelecimento
       and a.inicio >= (p_data::timestamp at time zone 'America/Sao_Paulo')
       and a.inicio < ((p_data + 1)::timestamp at time zone 'America/Sao_Paulo')
       and a.status in ('validado_recepcao', 'validado_dono')
  )
  select count(*), coalesce(sum(valor_total), 0)
    into v_quantidade, v_total
    from dia;

  with dia as (
    select a.barbeiro_id, a.forma_pagamento,
           a.valor_total, a.valor_barbeiro, a.valor_barbearia,
           u.nome_completo
      from public.atendimento a
      join public.usuario u on u.id = a.barbeiro_id
     where a.estabelecimento_id = p_estabelecimento
       and a.inicio >= (p_data::timestamp at time zone 'America/Sao_Paulo')
       and a.inicio < ((p_data + 1)::timestamp at time zone 'America/Sao_Paulo')
       and a.status in ('validado_recepcao', 'validado_dono')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'barbeiro_id', barbeiro_id,
           'nome_completo', nome_completo,
           'total', total,
           'valor_barbeiro', valor_barbeiro,
           'valor_barbearia', valor_barbearia
         ) order by nome_completo), '[]'::jsonb)
    into v_por_barbeiro
    from (
      select barbeiro_id, nome_completo,
             sum(valor_total) as total,
             sum(valor_barbeiro) as valor_barbeiro,
             sum(valor_barbearia) as valor_barbearia
        from dia
       group by barbeiro_id, nome_completo
    ) por_barbeiro;

  with dia as (
    select forma_pagamento, valor_total
      from public.atendimento
     where estabelecimento_id = p_estabelecimento
       and inicio >= (p_data::timestamp at time zone 'America/Sao_Paulo')
       and inicio < ((p_data + 1)::timestamp at time zone 'America/Sao_Paulo')
       and status in ('validado_recepcao', 'validado_dono')
  )
  select jsonb_build_object(
    'dinheiro', coalesce(sum(valor_total) filter (where forma_pagamento = 'dinheiro'), 0),
    'pix', coalesce(sum(valor_total) filter (where forma_pagamento = 'pix'), 0),
    'cartao', coalesce(sum(valor_total) filter (where forma_pagamento = 'cartao'), 0)
  ) into v_por_forma_pagamento
    from dia;

  return jsonb_build_object(
    'data', p_data,
    'status', v_status,
    'total', v_total,
    'quantidade_atendimentos', v_quantidade,
    'por_barbeiro', v_por_barbeiro,
    'por_forma_pagamento', v_por_forma_pagamento
  );
end;
$$;

create or replace function public.bf_fechamento_confirmar(p_estabelecimento uuid, p_data date, p_usuario uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_inicio timestamptz := p_data::timestamp at time zone 'America/Sao_Paulo';
  v_fim timestamptz := (p_data + 1)::timestamp at time zone 'America/Sao_Paulo';
begin
  if not exists (
    select 1 from public.vinculo
     where usuario_id = p_usuario and estabelecimento_id = p_estabelecimento
       and perfil = 'dono' and status = 'ativo'
  ) then
    raise exception 'BF_FECHAMENTO_SEM_PERMISSAO' using errcode = 'P0001';
  end if;

  insert into public.fechamento (estabelecimento_id, data, status)
  values (p_estabelecimento, p_data, 'aberto')
  on conflict (estabelecimento_id, data) do nothing;

  select status into v_status
    from public.fechamento
   where estabelecimento_id = p_estabelecimento and data = p_data
   for update;
  if v_status <> 'aberto' then
    raise exception 'BF_FECHAMENTO_STATUS_INVALIDO' using errcode = 'P0001';
  end if;

  update public.atendimento
     set status = 'validado_dono', validado_dono_por = p_usuario, validado_dono_em = now()
   where estabelecimento_id = p_estabelecimento and inicio >= v_inicio and inicio < v_fim
     and status = 'validado_recepcao';

  update public.fechamento
     set status = 'confirmado', confirmado_por = p_usuario, confirmado_em = now(),
         justificativa_devolucao = null, devolvido_por = null, devolvido_em = null
   where estabelecimento_id = p_estabelecimento and data = p_data;

  return jsonb_build_object('ok', true, 'data', p_data, 'status', 'confirmado');
end;
$$;

create or replace function public.bf_fechamento_devolver(
  p_estabelecimento uuid, p_data date, p_usuario uuid, p_justificativa text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_inicio timestamptz := p_data::timestamp at time zone 'America/Sao_Paulo';
  v_fim timestamptz := (p_data + 1)::timestamp at time zone 'America/Sao_Paulo';
begin
  if not exists (
    select 1 from public.vinculo
     where usuario_id = p_usuario and estabelecimento_id = p_estabelecimento
       and perfil = 'dono' and status = 'ativo'
  ) then
    raise exception 'BF_FECHAMENTO_SEM_PERMISSAO' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_justificativa, ''))) = 0 or length(p_justificativa) > 300 then
    raise exception 'BF_JUSTIFICATIVA_INVALIDA' using errcode = 'P0001';
  end if;

  select status into v_status
    from public.fechamento
   where estabelecimento_id = p_estabelecimento and data = p_data
   for update;
  if not found then raise exception 'BF_FECHAMENTO_NAO_ENCONTRADO' using errcode = 'P0001'; end if;
  if v_status <> 'confirmado' then
    raise exception 'BF_FECHAMENTO_STATUS_INVALIDO' using errcode = 'P0001';
  end if;

  update public.atendimento
     set status = 'validado_recepcao'
   where estabelecimento_id = p_estabelecimento and inicio >= v_inicio and inicio < v_fim
     and status = 'validado_dono';

  update public.fechamento
     set status = 'aberto', justificativa_devolucao = trim(p_justificativa),
         devolvido_por = p_usuario, devolvido_em = now()
   where estabelecimento_id = p_estabelecimento and data = p_data;

  return jsonb_build_object('ok', true, 'data', p_data, 'status', 'aberto');
end;
$$;

revoke all on function public.bf_recepcao_corrigir(uuid,uuid,uuid,text,boolean,text,boolean,text,boolean) from public, anon, authenticated;
revoke all on function public.bf_fechamento_resumo(uuid,date,uuid) from public, anon, authenticated;
revoke all on function public.bf_fechamento_confirmar(uuid,date,uuid) from public, anon, authenticated;
revoke all on function public.bf_fechamento_devolver(uuid,date,uuid,text) from public, anon, authenticated;
grant execute on function public.bf_recepcao_corrigir(uuid,uuid,uuid,text,boolean,text,boolean,text,boolean) to service_role;
grant execute on function public.bf_fechamento_resumo(uuid,date,uuid) to service_role;
grant execute on function public.bf_fechamento_confirmar(uuid,date,uuid) to service_role;
grant execute on function public.bf_fechamento_devolver(uuid,date,uuid,text) to service_role;
