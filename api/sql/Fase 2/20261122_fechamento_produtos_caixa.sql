create or replace function public.bf_fechamento_resumo(p_estabelecimento uuid, p_data date, p_usuario uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_inicio timestamptz := p_data::timestamp at time zone 'America/Sao_Paulo';
  v_fim timestamptz := (p_data + 1)::timestamp at time zone 'America/Sao_Paulo';
  v_resumo jsonb;
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
    select a.barbeiro_id, u.nome_completo, a.forma_pagamento,
           a.valor_total, a.valor_servicos, a.valor_produtos,
           a.valor_barbeiro, a.valor_barbearia, a.valor_recebido, a.troco
      from public.atendimento a
      join public.usuario u on u.id = a.barbeiro_id
     where a.estabelecimento_id = p_estabelecimento
       and a.inicio >= v_inicio and a.inicio < v_fim
       and a.status in ('validado_recepcao', 'validado_dono')
  ),
  por_barbeiro as (
    select barbeiro_id, nome_completo,
           sum(valor_total) as total,
           sum(valor_servicos) as valor_servicos,
           sum(valor_produtos) as valor_produtos,
           sum(valor_barbeiro) as valor_barbeiro,
           sum(valor_barbearia) as valor_barbearia
      from dia
     group by barbeiro_id, nome_completo
  )
  select jsonb_build_object(
    'data', p_data,
    'status', v_status,
    'total', coalesce((select sum(valor_total) from dia), 0),
    'total_servicos', coalesce((select sum(valor_servicos) from dia), 0),
    'total_produtos', coalesce((select sum(valor_produtos) from dia), 0),
    'total_barbearia', coalesce((select sum(valor_barbearia) from dia), 0),
    'quantidade_atendimentos', (select count(*) from dia),
    'por_barbeiro', coalesce((
      select jsonb_agg(jsonb_build_object(
        'barbeiro_id', barbeiro_id,
        'nome_completo', nome_completo,
        'total', total,
        'valor_servicos', valor_servicos,
        'valor_produtos', valor_produtos,
        'valor_barbeiro', valor_barbeiro,
        'valor_barbearia', valor_barbearia
      ) order by nome_completo)
      from por_barbeiro
    ), '[]'::jsonb),
    'por_forma_pagamento', jsonb_build_object(
      'dinheiro', coalesce((select sum(valor_total) from dia where forma_pagamento = 'dinheiro'), 0),
      'pix', coalesce((select sum(valor_total) from dia where forma_pagamento = 'pix'), 0),
      'cartao', coalesce((select sum(valor_total) from dia where forma_pagamento = 'cartao'), 0)
    ),
    'caixa', jsonb_build_object(
      'dinheiro_recebido', coalesce((select sum(coalesce(valor_recebido, valor_total)) from dia where forma_pagamento = 'dinheiro'), 0),
      'troco', coalesce((select sum(coalesce(troco, 0)) from dia where forma_pagamento = 'dinheiro'), 0),
      'saldo_dinheiro', coalesce((select sum(valor_total) from dia where forma_pagamento = 'dinheiro'), 0)
    )
  ) into v_resumo;

  return v_resumo;
end;
$$;

revoke all on function public.bf_fechamento_resumo(uuid,date,uuid) from public, anon, authenticated;
grant execute on function public.bf_fechamento_resumo(uuid,date,uuid) to service_role;
