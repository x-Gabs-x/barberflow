create or replace function public.bf_servicos_sem_sobreposicao(p_servicos uuid[], p_estabelecimento uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with selecionados as (
    select id, trim(translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) as nome
    from public.servico
    where estabelecimento_id = p_estabelecimento and id = any(p_servicos)
  ), partes as (
    select s.id, trim(p.nome) as parte,
      (select count(*) from regexp_split_to_table(s.nome, '[[:space:]]*\+[[:space:]]*') c) as quantidade
    from selecionados s
    cross join lateral regexp_split_to_table(s.nome, '[[:space:]]*\+[[:space:]]*') as p(nome)
  )
  select not exists (
    select 1 from partes a join partes b on a.id < b.id and a.parte = b.parte
    where a.quantidade > 1 or b.quantidade > 1
  )
$$;

create or replace function public.bf_atendimento_salvar(
  p_id uuid,
  p_estabelecimento uuid,
  p_barbeiro uuid,
  p_cliente uuid default null,
  p_definir_cliente boolean default false,
  p_servicos uuid[] default null,
  p_observacoes text default null,
  p_definir_observacoes boolean default false,
  p_forma_pagamento text default null,
  p_definir_forma_pagamento boolean default false,
  p_nsu text default null,
  p_definir_nsu boolean default false,
  p_inicio timestamptz default null,
  p_fim timestamptz default null,
  p_encerrar boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_atendimento public.atendimento%rowtype;
  v_total numeric(10,2);
  v_escote numeric(5,2);
  v_quantidade int;
begin
  select * into v_atendimento from public.atendimento
   where id = p_id and estabelecimento_id = p_estabelecimento and barbeiro_id = p_barbeiro
   for update;
  if not found then
    raise exception 'BF_NAO_ENCONTRADO' using errcode = 'P0001';
  end if;
  if v_atendimento.status <> 'em_andamento' then
    raise exception 'BF_ATENDIMENTO_FECHADO' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.vinculo where usuario_id = p_barbeiro
      and estabelecimento_id = p_estabelecimento and status = 'ativo'
      and perfil in ('dono', 'parceiro')
  ) then
    raise exception 'BF_VINCULO_INATIVO' using errcode = 'P0001';
  end if;
  if p_definir_cliente and p_cliente is not null and not exists (
    select 1 from public.cliente where id = p_cliente and estabelecimento_id = p_estabelecimento
  ) then
    raise exception 'BF_CLIENTE_INVALIDO' using errcode = 'P0001';
  end if;
  if p_definir_forma_pagamento and p_forma_pagamento is not null
      and p_forma_pagamento not in ('dinheiro', 'pix', 'cartao') then
    raise exception 'BF_PAGAMENTO_INVALIDO' using errcode = 'P0001';
  end if;
  if p_servicos is not null then
    if cardinality(p_servicos) > 20 or cardinality(p_servicos) <> (
        select count(distinct s) from unnest(p_servicos) s
    ) then
      raise exception 'BF_SERVICOS_INVALIDOS' using errcode = 'P0001';
    end if;
    select count(*) into v_quantidade from public.servico
     where estabelecimento_id = p_estabelecimento and ativo = true and id = any(p_servicos);
    if v_quantidade <> cardinality(p_servicos) then
      raise exception 'BF_SERVICOS_INVALIDOS' using errcode = 'P0001';
    end if;
    if not public.bf_servicos_sem_sobreposicao(p_servicos, p_estabelecimento) then
      raise exception 'BF_SERVICOS_SOBREPOSTOS' using errcode = 'P0001';
    end if;
  end if;
  update public.atendimento set
    inicio = coalesce(p_inicio, inicio),
    cliente_id = case when p_definir_cliente then p_cliente else cliente_id end,
    observacoes = case when p_definir_observacoes then p_observacoes else observacoes end,
    forma_pagamento = case when p_definir_forma_pagamento then p_forma_pagamento else forma_pagamento end,
    nsu = case when p_definir_nsu then p_nsu else nsu end
  where id = p_id;
  if p_servicos is not null then
    delete from public.servico_atendimento where atendimento_id = p_id;
    insert into public.servico_atendimento(atendimento_id, servico_id, nome, preco)
      select p_id, s.id, s.nome, s.preco
        from public.servico s
       where s.estabelecimento_id = p_estabelecimento and s.ativo = true and s.id = any(p_servicos);
  end if;
  select coalesce(sum(preco), 0) into v_total
    from public.servico_atendimento where atendimento_id = p_id;
  update public.atendimento set valor_total = v_total where id = p_id;
  if p_encerrar then
    select * into v_atendimento from public.atendimento where id = p_id;
    if v_atendimento.cliente_id is null then
      raise exception 'BF_CLIENTE_OBRIGATORIO' using errcode = 'P0001';
    end if;
    if not exists(select 1 from public.servico_atendimento where atendimento_id = p_id) then
      raise exception 'BF_SERVICOS_OBRIGATORIOS' using errcode = 'P0001';
    end if;
    if v_atendimento.forma_pagamento is null then
      raise exception 'BF_PAGAMENTO_OBRIGATORIO' using errcode = 'P0001';
    end if;
    select escote_percentual into v_escote from public.vinculo
     where usuario_id = p_barbeiro and estabelecimento_id = p_estabelecimento
       and perfil in ('dono', 'parceiro') and status = 'ativo';
    if v_escote is null then
      raise exception 'BF_ESCOTE_NAO_CONFIGURADO' using errcode = 'P0001';
    end if;
    if coalesce(p_fim, now()) <= v_atendimento.inicio then
      raise exception 'BF_FIM_INVALIDO' using errcode = 'P0001';
    end if;
    update public.atendimento set
      fim = coalesce(p_fim, now()),
      escote_percentual = v_escote,
      valor_barbeiro = round(v_total * v_escote / 100, 2),
      valor_barbearia = v_total - round(v_total * v_escote / 100, 2),
      status = 'registrado'
    where id = p_id;
  end if;
  return p_id;
end; $$;

create or replace function public.bf_recepcao_validar(p_id uuid, p_estabelecimento uuid, p_usuario uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not exists (select 1 from public.vinculo where usuario_id = p_usuario and estabelecimento_id = p_estabelecimento and perfil = 'recepcao' and status = 'ativo') then
    raise exception 'BF_RECEPCAO_SEM_PERMISSAO' using errcode = 'P0001';
  end if;
  select status into v_status from public.atendimento where id = p_id and estabelecimento_id = p_estabelecimento for update;
  if not found then raise exception 'BF_NAO_ENCONTRADO' using errcode = 'P0001'; end if;
  if v_status <> 'registrado' then raise exception 'BF_STATUS_INVALIDO' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.comprovante where atendimento_id = p_id) then
    raise exception 'BF_COMPROVANTE_OBRIGATORIO' using errcode = 'P0001';
  end if;
  update public.atendimento set status = 'validado_recepcao', validado_recepcao_por = p_usuario, validado_recepcao_em = now(), justificativa_rejeicao = null where id = p_id;
  return p_id;
end; $$;

create or replace function public.bf_recepcao_corrigir(p_id uuid, p_estabelecimento uuid, p_usuario uuid, p_observacoes text, p_definir_observacoes boolean, p_forma_pagamento text, p_definir_forma_pagamento boolean, p_nsu text, p_definir_nsu boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not exists (select 1 from public.vinculo where usuario_id = p_usuario and estabelecimento_id = p_estabelecimento and perfil = 'recepcao' and status = 'ativo') then
    raise exception 'BF_RECEPCAO_SEM_PERMISSAO' using errcode = 'P0001';
  end if;
  select status into v_status from public.atendimento where id = p_id and estabelecimento_id = p_estabelecimento for update;
  if not found then raise exception 'BF_NAO_ENCONTRADO' using errcode = 'P0001'; end if;
  if v_status <> 'registrado' then raise exception 'BF_STATUS_INVALIDO' using errcode = 'P0001'; end if;
  if p_definir_forma_pagamento and p_forma_pagamento not in ('dinheiro','pix','cartao') then
    raise exception 'BF_PAGAMENTO_INVALIDO' using errcode = 'P0001';
  end if;
  update public.atendimento set
    observacoes = case when p_definir_observacoes then p_observacoes else observacoes end,
    forma_pagamento = case when p_definir_forma_pagamento then p_forma_pagamento else forma_pagamento end,
    nsu = case when p_definir_nsu then p_nsu else nsu end
  where id = p_id;
  return p_id;
end; $$;

create or replace function public.bf_recepcao_rejeitar(p_id uuid, p_estabelecimento uuid, p_usuario uuid, p_justificativa text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_status text;
declare v_perfil text;
begin
  select perfil into v_perfil from public.vinculo where usuario_id = p_usuario and estabelecimento_id = p_estabelecimento and perfil in ('recepcao','dono') and status = 'ativo';
  if v_perfil is null then raise exception 'BF_RECEPCAO_SEM_PERMISSAO' using errcode = 'P0001'; end if;
  select status into v_status from public.atendimento where id = p_id and estabelecimento_id = p_estabelecimento for update;
  if not found then raise exception 'BF_NAO_ENCONTRADO' using errcode = 'P0001'; end if;
  if v_status <> 'registrado' and not (v_status = 'validado_recepcao' and v_perfil = 'dono') then
    raise exception 'BF_STATUS_INVALIDO' using errcode = 'P0001';
  end if;
  if length(trim(p_justificativa)) = 0 or length(p_justificativa) > 300 then
    raise exception 'BF_JUSTIFICATIVA_INVALIDA' using errcode = 'P0001';
  end if;
  update public.atendimento set status = 'rejeitado', justificativa_rejeicao = trim(p_justificativa) where id = p_id;
  return p_id;
end; $$;

revoke all on function public.bf_servicos_sem_sobreposicao(uuid[],uuid) from public, anon, authenticated;
revoke all on function public.bf_atendimento_salvar(uuid,uuid,uuid,uuid,boolean,uuid[],text,boolean,text,boolean,text,boolean,timestamptz,timestamptz,boolean) from public, anon, authenticated;
revoke all on function public.bf_recepcao_validar(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.bf_recepcao_corrigir(uuid,uuid,uuid,text,boolean,text,boolean,text,boolean) from public, anon, authenticated;
revoke all on function public.bf_recepcao_rejeitar(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.bf_servicos_sem_sobreposicao(uuid[],uuid) to service_role;
grant execute on function public.bf_atendimento_salvar(uuid,uuid,uuid,uuid,boolean,uuid[],text,boolean,text,boolean,text,boolean,timestamptz,timestamptz,boolean) to service_role;
grant execute on function public.bf_recepcao_validar(uuid,uuid,uuid) to service_role;
grant execute on function public.bf_recepcao_corrigir(uuid,uuid,uuid,text,boolean,text,boolean,text,boolean) to service_role;
grant execute on function public.bf_recepcao_rejeitar(uuid,uuid,uuid,text) to service_role;
