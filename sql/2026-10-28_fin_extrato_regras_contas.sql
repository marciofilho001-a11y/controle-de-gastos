-- Lançamento automático (Open Finance / arquivo): contas, extrato bruto e regras aprendidas.
-- Aplicado via migration "fin_extrato_regras_contas" no projeto xozrxppvroqiverzonmy.
-- Ver supabase/functions/pluggy-sync e src/lib/extrato.ts.
create table if not exists public.fin_bancos_contas (
  id text primary key, item_id text, origem text not null default 'pluggy' check (origem in ('pluggy','arquivo')),
  banco text, nome text, tipo text, subtipo text, numero text,
  cartao_id bigint references public.fin_cartoes(id) on delete set null,
  ativo boolean not null default true, ultimo_sync timestamptz, criado_em timestamptz not null default now()
);
create table if not exists public.fin_extrato (
  id text primary key, conta_id text references public.fin_bancos_contas(id) on delete cascade,
  origem text not null default 'pluggy' check (origem in ('pluggy','arquivo')),
  data date not null, descricao text not null, descricao_raw text,
  valor numeric(12,2) not null check (valor >= 0), sentido text not null check (sentido in ('saida','entrada')),
  tipo_conta text, operacao text, contraparte text, parcela_atual int, parcela_total int,
  data_compra date, previsao_fatura date, pendente boolean not null default false,
  status text not null default 'novo' check (status in ('novo','lancado','conciliado','ignorado')),
  acao text, auto boolean not null default false,
  transacao_id bigint references public.fin_transacoes(id) on delete set null,
  regra_id bigint, resolvido_em timestamptz, criado_em timestamptz not null default now()
);
create table if not exists public.fin_regras (
  id bigint generated always as identity primary key, chave text not null,
  sentido text not null check (sentido in ('saida','entrada')),
  acao text not null check (acao in ('despesa','receita','fatura','obrigacao','ignorar')),
  descricao text, categoria text,
  obrigacao_id bigint references public.fin_obrigacoes(id) on delete set null,
  cartao_id bigint references public.fin_cartoes(id) on delete set null,
  auto boolean not null default true, vezes int not null default 1,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  unique (chave, sentido)
);
