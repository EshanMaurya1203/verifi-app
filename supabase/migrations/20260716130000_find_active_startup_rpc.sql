create or replace function find_active_startup(p_user_id uuid, p_startup_name text)
returns setof startup_submissions
language sql
security definer
as $$
  select * from startup_submissions
  where user_id = p_user_id
    and lower(trim(startup_name)) = lower(trim(p_startup_name))
    and verification_status is distinct from 'rejected'
  limit 1;
$$;
