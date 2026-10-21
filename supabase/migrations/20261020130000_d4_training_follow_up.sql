-- Q16 (20 Oct 2026): every training ends Passed or Not Passed; a Not Passed result needs HR's follow-up.
-- The follow-up is a new version of the Not Passed training (status and result unchanged) with follow_up set:
-- * Retraining: the app then creates the next training for the same requirement (d4_create_training_record).
-- * Other follow-up: coaching, rotation or escalation to the supervisor, described in notes (required).
-- History stays insert-only: authenticated users only have SELECT and INSERT on d4_training_versions (migration
-- 20260928052350), and the existing INSERT policy already covers the new column. No RLS, grant or RPC change.
-- Before this migration the app reads training versions with select("*"), so nothing breaks; saving a follow-up is
-- rejected with a clear message (PostgREST PGRST204, unknown column) and nothing is written.
-- Not added: a check that result is Passed/Not Passed. Live has 7 Completed versions with free-text results from
-- before that rule; the API and the forms already accept only Passed or Not Passed.

alter table public.d4_training_versions
  add column follow_up varchar(16) check (follow_up in ('Retraining', 'Other follow-up')),
  add constraint d4_training_versions_follow_up_not_passed check (
    follow_up is null or (status = 'Completed' and result = 'Not Passed')
  ),
  add constraint d4_training_versions_follow_up_notes check (
    follow_up is distinct from 'Other follow-up' or length(btrim(notes)) > 0
  );
