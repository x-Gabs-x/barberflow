create table if not exists public.produto (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimento(id) on delete cascade,
  nome text not null,
  preco numeric(10,2) not null check (preco > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (estabelecimento_id, nome)
);

create table if not exists public.produto_atendimento (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimento(id) on delete cascade,
  produto_id uuid references public.produto(id),
  nome text not null,
  quantidade integer not null check (quantidade > 0),
  preco_unitario numeric(10,2) not null check (preco_unitario > 0)
);

alter table public.atendimento
  add column if not exists valor_servicos numeric(10,2) not null default 0,
  add column if not exists valor_produtos numeric(10,2) not null default 0,
  add column if not exists valor_recebido numeric(10,2),
  add column if not exists troco numeric(10,2);

update public.atendimento
set valor_servicos = valor_total
where valor_servicos = 0 and valor_produtos = 0 and valor_total > 0;

alter table public.atendimento drop constraint if exists atendimento_recebido_ok;
alter table public.atendimento add constraint atendimento_recebido_ok
  check (
    (valor_recebido is null or valor_recebido >= valor_total)
    and (troco is null or troco >= 0)
  );

alter table public.usuario
  add column if not exists trocar_senha boolean not null default false,
  add column if not exists senha_temporaria_expira_em timestamptz;

create table if not exists public.historico_senha (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuario(id) on delete cascade,
  redefinido_por uuid not null references public.usuario(id),
  redefinido_em timestamptz not null default now()
);

alter table public.cliente
  alter column cpf drop not null,
  add column if not exists anonimizado_em timestamptz;

alter table public.produto enable row level security;
alter table public.produto_atendimento enable row level security;
alter table public.historico_senha enable row level security;

drop policy if exists "ver produtos" on public.produto;
create policy "ver produtos" on public.produto
  for select using (estabelecimento_id in (select public.minhas_barbearias()));

drop policy if exists "ver produtos do atendimento" on public.produto_atendimento;
create policy "ver produtos do atendimento" on public.produto_atendimento
  for select using (atendimento_id in (select id from public.atendimento));

create unique index if not exists servico_nome_unico
  on public.servico (estabelecimento_id, lower(btrim(nome)));

create unique index if not exists produto_nome_unico
  on public.produto (estabelecimento_id, lower(btrim(nome)));