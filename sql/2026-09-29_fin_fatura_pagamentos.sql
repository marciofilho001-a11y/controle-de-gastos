-- Baixa (pagamento) da fatura de um cartão num mês.
-- Um registro por cartão+mês; a ausência do registro = fatura em aberto.
create table if not exists public.fin_fatura_pagamentos (
  id bigint generated always as identity primary key,
  cartao_id bigint not null references public.fin_cartoes(id) on delete cascade,
  mes_ref text not null,
  pago_em date not null default current_date,
  valor numeric,
  criado_em timestamptz not null default now(),
  constraint fin_fatura_pagamentos_unico unique (cartao_id, mes_ref)
);

create index if not exists fin_fatura_pagamentos_mes_idx on public.fin_fatura_pagamentos (mes_ref);

alter table public.fin_fatura_pagamentos enable row level security;

drop policy if exists "public" on public.fin_fatura_pagamentos;
create policy "public" on public.fin_fatura_pagamentos for all using (true) with check (true);
