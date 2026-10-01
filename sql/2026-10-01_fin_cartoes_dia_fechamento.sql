-- Dia de fechamento da fatura do cartão (junto com dia_vencimento).
alter table public.fin_cartoes
  add column if not exists dia_fechamento integer check (dia_fechamento between 1 and 31);
