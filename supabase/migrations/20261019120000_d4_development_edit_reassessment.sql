-- Interview follow-ups (Mas Bram), D4 only. Insert-only history stays: nothing here is ever UPDATEd.
-- * Priority, method and PIC of a development requirement can change after it is created (priority follows context,
--   e.g. a tax policy change makes tax certification High). A revision stores the value it changes; null means
--   "unchanged in this revision" and the app carries the previous value forward. d4_development_needs keeps the
--   values the requirement was created with.
-- * reassessment: HR's decision after reassessing a Completed requirement. Retraining reopens it as Planned,
--   "Meets requirement" keeps it Completed (Q11, 20 Oct 2026: stored in English, the same as the label).
-- * assessed_with: who HR assessed the competency together with (supervisor or requesting department).
-- The app only sends these columns when they are filled, so status updates and plain saves work before and after
-- this migration. The existing INSERT policies already cover the new columns; no RPC change is needed.

alter table public.d4_development_need_versions
  add column priority varchar(8) check (priority in ('Low', 'Medium', 'High')),
  add column method text check (length(method) <= 120),
  add column pic text check (length(pic) <= 120),
  add column reassessment varchar(20) check (reassessment in ('Retraining', 'Meets requirement')),
  add constraint d4_development_versions_reassessment_status check (
    reassessment is null
    or (reassessment = 'Retraining' and status = 'Planned')
    or (reassessment = 'Meets requirement' and status = 'Completed')
  );

alter table public.d4_competency_assessments
  add column assessed_with text check (length(btrim(assessed_with)) between 1 and 200);
