begin;

update public.vinculo
   set escote_percentual = case perfil
     when 'dono' then 100
     when 'parceiro' then 40
     when 'recepcao' then null
   end
 where perfil in ('dono', 'parceiro', 'recepcao')
   and escote_percentual is distinct from case perfil
     when 'dono' then 100
     when 'parceiro' then 40
     when 'recepcao' then null
   end;

drop trigger if exists vinculo_escote_parceiro_padrao on public.vinculo;
drop trigger if exists vinculo_escote_fixo on public.vinculo;

create or replace function public.bf_definir_escote_fixo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.perfil = 'dono' then
    new.escote_percentual := 100;
  elsif new.perfil = 'parceiro' then
    new.escote_percentual := 40;
  elsif new.perfil = 'recepcao' then
    new.escote_percentual := null;
  end if;
  return new;
end;
$$;

create trigger vinculo_escote_fixo
before insert or update on public.vinculo
for each row execute function public.bf_definir_escote_fixo();

alter table public.vinculo
  drop constraint if exists vinculo_parceiro_escote_40;

alter table public.vinculo
  drop constraint if exists vinculo_escote_fixo_40_100;

alter table public.vinculo
  add constraint vinculo_escote_fixo_40_100
  check (
    (perfil = 'dono' and escote_percentual is not distinct from 100)
    or (perfil = 'parceiro' and escote_percentual is not distinct from 40)
    or (perfil = 'recepcao' and escote_percentual is null)
  );

commit;
