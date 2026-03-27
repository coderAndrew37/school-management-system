-- 1. Create a function to set the role in the JWT
create or replace function public.handle_update_user_role()
returns trigger as $$
begin
  update auth.users
  set raw_app_metadata_content = 
    jsonb_set(
      coalesce(raw_app_metadata_content, '{}'::jsonb),
      '{role}',
      to_jsonb(new.role)
    )
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;

-- 2. Trigger this function whenever a profile is created or updated
create trigger on_profile_update
  after insert or update of role on public.profiles
  for each row execute function public.handle_update_user_role();