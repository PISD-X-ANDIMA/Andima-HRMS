-- Keep trigger-only functions private; RLS helpers remain executable by authenticated.
revoke all on function private.d3_feedback_audit_and_notify() from public, anon, authenticated;
revoke all on function private.d3_feedback_guard_employee_update() from public, anon, authenticated;
