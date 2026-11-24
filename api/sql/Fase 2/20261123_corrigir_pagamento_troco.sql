-- BarberFlow - Fase 2: recepcao corrigir passa a manter valor recebido e troco coerentes
-- com a forma de pagamento, e nao aceita forma de pagamento vazia.
begin;

create or replace function public.bf_recepcao_corrigir(
  p_id uuid, p_estabelecimento uuid, p_usuario uuid,
  p_observacoes text, p_definir_observacoes boolean,
  p_forma_pagamento text, p_definir_forma_pagamento boolean,
  p_nsu text, p_definir_nsu boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_total numeric(10,2);
  v_forma_atual text;
begin
  if not exists (
    select 1 from public.vinculo
     where usuario_id = p_usuario and estabelecimento_id = p_estabelecimento
       and perfil = 'recepcao' and status = 'ativo'
  ) then
    raise exception 'BF_RECEPCAO_SEM_PERMISSAO' using errcode = 'P0001';
  end if;

  select status, valor_total, forma_pagamento
    into v_status, v_total, v_forma_atual
    from public.atendimento
   where id = p_id and estabelecimento_id = p_estabelecimento
   for update;

  if not found then
    raise exception 'BF_NAO_ENCONTRADO' using errcode = 'P0001';
  end if;
  if v_status <> 'registrado' then
    raise exception 'BF_STATUS_INVALIDO' using errcode = 'P0001';
  end if;

  if p_definir_forma_pagamento
     and (p_forma_pagamento is null or p_forma_pagamento not in ('dinheiro', 'pix', 'cartao')) then
    raise exception 'BF_PAGAMENTO_INVALIDO' using errcode = 'P0001';
  end if;

  update public.atendimento
     set observacoes = case when p_definir_observacoes then p_observacoes else observacoes end,
         forma_pagamento = case when p_definir_forma_pagamento then p_forma_pagamento else forma_pagamento end,
         nsu = case when p_definir_nsu then p_nsu else nsu end,
         -- pix/cartao nao tem valor recebido nem troco; ao virar dinheiro, considera o valor exato
         valor_recebido = case
           when not p_definir_forma_pagamento then valor_recebido
           when p_forma_pagamento = 'dinheiro' then coalesce(valor_recebido, v_total)
           else null
         end,
         troco = case
           when not p_definir_forma_pagamento then troco
           when p_forma_pagamento = 'dinheiro' then coalesce(troco, 0)
           else null
         end,
         corrigido_por = p_usuario,
         corrigido_em = now()
   where id = p_id and estabelecimento_id = p_estabelecimento;

  return p_id;
end;
$$;

revoke all on function public.bf_recepcao_corrigir(uuid, uuid, uuid, text, boolean, text, boolean, text, boolean)
  from public, anon, authenticated;
grant execute on function public.bf_recepcao_corrigir(uuid, uuid, uuid, text, boolean, text, boolean, text, boolean)
  to service_role;

commit;
