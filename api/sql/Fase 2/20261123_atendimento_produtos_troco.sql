-- BarberFlow - Fase 2: atendimento com produtos, troco, horario de funcionamento
-- e funcao de rejeitar da recepcao (que a API chamava mas nao existia no banco).
begin;

-- 1) Verifica se um momento esta dentro do horario de funcionamento (fuso de Sao Paulo).
create or replace function public.bf_dentro_do_horario(p_estabelecimento uuid, p_momento timestamptz)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_abertura time;
  v_fechamento time;
  v_hora time := (p_momento at time zone 'America/Sao_Paulo')::time;
begin
  select hora_abertura, hora_fechamento into v_abertura, v_fechamento
    from public.estabelecimento where id = p_estabelecimento;
  if v_abertura is null or v_fechamento is null then
    return true;
  end if;
  if v_abertura <= v_fechamento then
    return v_hora between v_abertura and v_fechamento;
  end if;
  return v_hora >= v_abertura or v_hora <= v_fechamento;
end;
$$;

-- 2) Iniciar atendimento: bloqueia fora do horario.
create or replace function public.bf_atendimento_iniciar(
  p_estabelecimento uuid, p_barbeiro uuid, p_inicio timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not exists (
    select 1 from public.vinculo
     where usuario_id = p_barbeiro and estabelecimento_id = p_estabelecimento
       and perfil in ('dono', 'parceiro') and status = 'ativo'
  ) then
    raise exception 'BF_VINCULO_INATIVO' using errcode = 'P0001';
  end if;
  if not public.bf_dentro_do_horario(p_estabelecimento, p_inicio) then
    raise exception 'BF_FORA_DO_HORARIO' using errcode = 'P0001';
  end if;
  insert into public.atendimento (estabelecimento_id, barbeiro_id, inicio, status)
  values (p_estabelecimento, p_barbeiro, p_inicio, 'em_andamento') returning id into v_id;
  return v_id;
end;
$$;

-- 3) Salvar atendimento: produtos, totais, troco e escote de servicos + produtos.
--    A assinatura muda (2 parametros novos no fim), entao a antiga e removida.
drop function if exists public.bf_atendimento_salvar(
  uuid, uuid, uuid, uuid, boolean, uuid[], text, boolean, text, boolean,
  text, boolean, timestamptz, timestamptz, boolean
);

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
  p_encerrar boolean default false,
  p_produtos jsonb default null,          -- [{"produto_id": "...", "quantidade": 2}]; null = nao altera
  p_valor_recebido numeric default null   -- so vale para dinheiro, usado ao encerrar
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atendimento public.atendimento%rowtype;
  v_servicos numeric(10,2);
  v_produtos numeric(10,2);
  v_total numeric(10,2);
  v_escote numeric(5,2);
  v_perfil text;
  v_escote_produto numeric(5,2);
  v_repasse numeric(10,2);
  v_recebido numeric(10,2);
  v_troco numeric(10,2);
  v_quantidade int;
  v_n int;
  v_ids_ok int;
  v_qtd_ok int;
  v_distintos int;
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
  if p_inicio is not null and not public.bf_dentro_do_horario(p_estabelecimento, p_inicio) then
    raise exception 'BF_FORA_DO_HORARIO' using errcode = 'P0001';
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
  end if;

  -- valida a lista de produtos: formato, quantidade 1..99, sem repeticao, ativos desta barbearia
  if p_produtos is not null then
    if jsonb_typeof(p_produtos) <> 'array' or jsonb_array_length(p_produtos) > 20 then
      raise exception 'BF_PRODUTOS_INVALIDOS' using errcode = 'P0001';
    end if;
    select count(*),
           count(distinct e->>'produto_id'),
           count(*) filter (where (e->>'produto_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
           count(*) filter (where (e->>'quantidade') ~ '^[0-9]{1,2}$'
                              and case when (e->>'quantidade') ~ '^[0-9]{1,2}$'
                                       then (e->>'quantidade')::int >= 1 else false end)
      into v_n, v_distintos, v_ids_ok, v_qtd_ok
      from jsonb_array_elements(p_produtos) e;
    if v_n <> v_distintos or v_n <> v_ids_ok or v_n <> v_qtd_ok then
      raise exception 'BF_PRODUTOS_INVALIDOS' using errcode = 'P0001';
    end if;
    select count(*) into v_quantidade from public.produto
     where estabelecimento_id = p_estabelecimento and ativo = true
       and id in (select (e->>'produto_id')::uuid from jsonb_array_elements(p_produtos) e);
    if v_quantidade <> v_n then
      raise exception 'BF_PRODUTOS_INVALIDOS' using errcode = 'P0001';
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

  -- copia nome e preco do produto no momento da venda
  if p_produtos is not null then
    delete from public.produto_atendimento where atendimento_id = p_id;
    insert into public.produto_atendimento(atendimento_id, produto_id, nome, quantidade, preco_unitario)
      select p_id, pr.id, pr.nome, (e->>'quantidade')::int, pr.preco
        from jsonb_array_elements(p_produtos) e
        join public.produto pr
          on pr.id = (e->>'produto_id')::uuid
         and pr.estabelecimento_id = p_estabelecimento and pr.ativo = true;
  end if;

  select coalesce(sum(preco), 0) into v_servicos
    from public.servico_atendimento where atendimento_id = p_id;
  select coalesce(sum(quantidade * preco_unitario), 0) into v_produtos
    from public.produto_atendimento where atendimento_id = p_id;
  v_total := v_servicos + v_produtos;

  update public.atendimento set
    valor_servicos = v_servicos,
    valor_produtos = v_produtos,
    valor_total = v_total,
    valor_recebido = null,
    troco = null
  where id = p_id;

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
    select escote_percentual, perfil into v_escote, v_perfil from public.vinculo
     where usuario_id = p_barbeiro and estabelecimento_id = p_estabelecimento
       and perfil in ('dono', 'parceiro') and status = 'ativo';
    if v_escote is null then
      raise exception 'BF_ESCOTE_NAO_CONFIGURADO' using errcode = 'P0001';
    end if;
    if coalesce(p_fim, now()) <= v_atendimento.inicio then
      raise exception 'BF_FIM_INVALIDO' using errcode = 'P0001';
    end if;

    -- troco: so para dinheiro. Sem valor informado, considera o valor exato.
    if v_atendimento.forma_pagamento = 'dinheiro' then
      v_recebido := coalesce(p_valor_recebido, v_total);
      if v_recebido < v_total then
        raise exception 'BF_VALOR_RECEBIDO_INSUFICIENTE' using errcode = 'P0001';
      end if;
      v_troco := v_recebido - v_total;
    else
      v_recebido := null;
      v_troco := null;
    end if;

    -- escote: servicos pelo percentual do barbeiro; produtos 40% (parceiro) ou 50% (dono)
    v_escote_produto := case when v_perfil = 'dono' then 50 else 40 end;
    v_repasse := round(v_servicos * v_escote / 100, 2)
               + round(v_produtos * v_escote_produto / 100, 2);

    update public.atendimento set
      fim = coalesce(p_fim, now()),
      escote_percentual = v_escote,
      valor_barbeiro = v_repasse,
      valor_barbearia = v_total - v_repasse,
      valor_recebido = v_recebido,
      troco = v_troco,
      status = 'registrado'
    where id = p_id;
  end if;
  return p_id;
end;
$$;

revoke all on function public.bf_atendimento_salvar(
  uuid, uuid, uuid, uuid, boolean, uuid[], text, boolean, text, boolean,
  text, boolean, timestamptz, timestamptz, boolean, jsonb, numeric
) from public, anon, authenticated;
grant execute on function public.bf_atendimento_salvar(
  uuid, uuid, uuid, uuid, boolean, uuid[], text, boolean, text, boolean,
  text, boolean, timestamptz, timestamptz, boolean, jsonb, numeric
) to service_role;

-- 4) Rejeitar (recepcao): a API ja chamava esta funcao, mas ela nao existia no banco.
create or replace function public.bf_recepcao_rejeitar(
  p_id uuid, p_estabelecimento uuid, p_usuario uuid, p_justificativa text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  if length(trim(coalesce(p_justificativa, ''))) = 0 or length(p_justificativa) > 300 then
    raise exception 'BF_JUSTIFICATIVA_INVALIDA' using errcode = 'P0001';
  end if;

  select status into v_status from public.atendimento
   where id = p_id and estabelecimento_id = p_estabelecimento
   for update;
  if not found then
    raise exception 'BF_NAO_ENCONTRADO' using errcode = 'P0001';
  end if;
  if v_status <> 'registrado' then
    raise exception 'BF_STATUS_INVALIDO' using errcode = 'P0001';
  end if;

  update public.atendimento
     set status = 'rejeitado',
         justificativa_rejeicao = trim(p_justificativa)
   where id = p_id and estabelecimento_id = p_estabelecimento;

  return p_id;
end;
$$;

revoke all on function public.bf_recepcao_rejeitar(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.bf_recepcao_rejeitar(uuid, uuid, uuid, text) to service_role;
revoke all on function public.bf_dentro_do_horario(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.bf_dentro_do_horario(uuid, timestamptz) to service_role;

commit;
