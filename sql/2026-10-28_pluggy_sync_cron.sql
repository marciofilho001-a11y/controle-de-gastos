-- Agendamento da sincronização com os bancos (aplicado como migration finflow_pluggy_sync_cron).
-- A chave usada é a anon (pública, a mesma embutida no site).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('finflow-pluggy-sync') where exists (select 1 from cron.job where jobname = 'finflow-pluggy-sync');
-- todo dia às 06:20 de Brasília (09:20 UTC) e de novo às 18:20 (21:20 UTC)
select cron.schedule('finflow-pluggy-sync', '20 9,21 * * *', $$
  select net.http_post(
    url := 'https://xozrxppvroqiverzonmy.supabase.co/functions/v1/pluggy-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvenJ4cHB2cm9xaXZlcnpvbm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDg2NDUsImV4cCI6MjA5MzY4NDY0NX0.5gE3khHOusWrADdQI6I89hGJnG-qc4JeXiYURgXDGrk'),
    body := '{"acao":"sync"}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
