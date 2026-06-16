-- Revoke accidental public/anon EXECUTE on internal SECURITY DEFINER functions
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_auth_user_updated() from public, anon, authenticated;
revoke all on function public.reset_monthly_usage() from public, anon, authenticated;
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.log_voice_usage(uuid, uuid, integer) from anon;

revoke all on function public.admin_get_users_directory() from anon;
revoke all on function public.admin_get_user_detail(uuid) from anon;

revoke all on function public.ensure_my_organization() from anon;
grant execute on function public.ensure_my_organization() to authenticated;
