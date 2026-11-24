begin;

drop trigger if exists vinculo_escote_fixo on public.vinculo;
drop trigger if exists vinculo_escote_parceiro_padrao on public.vinculo;

drop function if exists public.bf_definir_escote_fixo();
drop function if exists public.bf_definir_escote_parceiro();

alter table public.vinculo drop constraint if exists vinculo_escote_fixo_40_100;
alter table public.vinculo drop constraint if exists vinculo_parceiro_escote_40;

create or replace function public.bf_escote_padrao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.perfil = 'recepcao' then
    new.escote_percentual := null;
  elsif tg_op = 'INSERT' and new.escote_percentual is null then
    new.escote_percentual := case new.perfil when 'dono' then 100 else 40 end;
  end if;
  return new;
end;
$$;

create trigger vinculo_escote_padrao
before insert or update on public.vinculo
for each row execute function public.bf_escote_padrao();

alter table public.vinculo
  add constraint vinculo_escote_configuravel
  check (
    (perfil = 'recepcao' and escote_percentual is null)
    or (perfil in ('dono', 'parceiro') and escote_percentual between 0 and 100)
  );

commit;
