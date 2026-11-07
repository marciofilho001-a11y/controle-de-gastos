-- Login por usuário (Supabase Auth): cada linha das tabelas fin_* tem dono (user_id)
-- e cada conta só lê/grava o que é dela. Os dados que já existiam ficam sem dono até
-- a conta "Marcio Filho" ser criada: aí passam todos pra ela (gatilho fin_reivindicar_dados).
do $$
declare t text;
begin
  foreach t in array array[
    'fin_bancos_contas','fin_cartao_compras','fin_cartoes','fin_categoria_icones','fin_config',
    'fin_descricao_icones','fin_extrato','fin_fatura_itens','fin_fatura_pagamentos','fin_investimentos',
    'fin_obrigacoes','fin_regras','fin_saldo_conta','fin_tetos','fin_transacoes'
  ] loop
    execute format('alter table public.%I add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public" on public.%I', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format('create policy "dono" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- unicidades que eram globais passam a ser por usuário
alter table public.fin_config drop constraint if exists fin_config_chave_key;
alter table public.fin_config add constraint fin_config_user_chave_key unique nulls not distinct (user_id, chave);

alter table public.fin_regras drop constraint if exists fin_regras_chave_sentido_key;
alter table public.fin_regras add constraint fin_regras_user_chave_sentido_key unique nulls not distinct (user_id, chave, sentido);

alter table public.fin_saldo_conta drop constraint if exists fin_saldo_conta_mes_ref_key;
alter table public.fin_saldo_conta add constraint fin_saldo_conta_user_mes_key unique nulls not distinct (user_id, mes_ref);

alter table public.fin_categoria_icones drop constraint if exists fin_categoria_icones_pkey;
alter table public.fin_categoria_icones add column if not exists id bigint generated always as identity primary key;
alter table public.fin_categoria_icones add constraint fin_categoria_icones_user_cat_key unique nulls not distinct (user_id, categoria);

alter table public.fin_descricao_icones drop constraint if exists fin_descricao_icones_pkey;
alter table public.fin_descricao_icones add column if not exists id bigint generated always as identity primary key;
alter table public.fin_descricao_icones add constraint fin_descricao_icones_user_desc_key unique nulls not distinct (user_id, descricao_norm);

-- a conta "Marcio Filho" herda tudo que já existia (uma vez só: depois não sobra nada sem dono)
create or replace function public.fin_reivindicar_dados()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  nome text := lower(coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', ''));
  t text;
begin
  nome := regexp_replace(translate(nome, 'áàâãéêíóôõúç', 'aaaaeeiooouc'), '\s+', ' ', 'g');
  if trim(nome) like 'marcio%filho' and exists (select 1 from public.fin_transacoes where user_id is null) then
    foreach t in array array[
      'fin_bancos_contas','fin_cartao_compras','fin_cartoes','fin_categoria_icones','fin_config',
      'fin_descricao_icones','fin_extrato','fin_fatura_itens','fin_fatura_pagamentos','fin_investimentos',
      'fin_obrigacoes','fin_regras','fin_saldo_conta','fin_tetos','fin_transacoes'
    ] loop
      execute format('update public.%I set user_id = $1 where user_id is null', t) using new.id;
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.fin_reivindicar_dados() from public, anon, authenticated;

drop trigger if exists fin_reivindicar_dados on auth.users;
create trigger fin_reivindicar_dados after insert on auth.users
  for each row execute function public.fin_reivindicar_dados();
