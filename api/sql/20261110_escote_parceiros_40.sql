update public.vinculo
set escote_percentual = 40
where perfil = 'parceiro'
  and escote_percentual is distinct from 40;

create or replace function public.bf_definir_escote_parceiro()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.perfil = 'parceiro' then
    new.escote_percentual := 40;
  end if;
  return new;
end;
$$;

drop trigger if exists vinculo_escote_parceiro_padrao on public.vinculo;
create trigger vinculo_escote_parceiro_padrao
before insert or update on public.vinculo
for each row execute function public.bf_definir_escote_parceiro();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vinculo_parceiro_escote_40'
      and conrelid = 'public.vinculo'::regclass
  ) then
    alter table public.vinculo
      add constraint vinculo_parceiro_escote_40
      check (perfil <> 'parceiro' or escote_percentual is not distinct from 40);
  end if;
end;
$$;
