drop policy if exists "D3 HR reads all feedback reward audit" on public.d3_feedback_reward_audit_log;
drop policy if exists "D3 manager reads subordinate feedback reward audit" on public.d3_feedback_reward_audit_log;
revoke all on function private.d3_feedback_audit_and_notify() from public, anon, authenticated;
revoke all on function private.d3_feedback_guard_employee_update() from public, anon, authenticated;
