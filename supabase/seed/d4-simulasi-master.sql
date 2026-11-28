-- D4 simulation master data (14 Oct 2026), for the ANDIMA walkthrough. Insert-only: no existing B2/D3 row
-- is updated or deleted. Every new D3 competency has code D4-SIM-*; cleanup is at the bottom.
begin;

-- 1. KPI role for B2 positions that had none (D4 table). Tim IT has no IT role in V5.1; Implant (EDI) is the
--    closest system-input role until ANDIMA supplies an IT KPI.
insert into d4_position_kpi_roles (source_version, position_id, role_order)
select 'V5.1', p.id, m.role_order
from (values ('Cash Manager', 10), ('Cash Manager Associate', 10), ('Tax Manager', 10), ('Tax Associate', 10),
             ('Manager of Customer Success', 9), ('Tim IT', 8)) m(title, role_order)
join d3_positions p on trim(p.title) = m.title
on conflict do nothing;

-- 2. Competencies.
insert into d3_competencies (code, name, category)
select c.code, c.name, c.category
from (values
  ('D4-SIM-S01', 'Penerbitan dan pengendalian invoice', 'Technical'),
  ('D4-SIM-S02', 'Rekonsiliasi pembukuan dan GL', 'Technical'),
  ('D4-SIM-S03', 'Administrasi arsip keuangan dan dokumen', 'Technical'),
  ('D4-SIM-S04', 'Pengelolaan kas dan likuiditas', 'Technical'),
  ('D4-SIM-S05', 'Pelaporan dan kepatuhan pajak', 'Technical'),
  ('D4-SIM-S06', 'Perencanaan strategi dan anggaran', 'Managerial'),
  ('D4-SIM-S07', 'Kepemimpinan dan pengembangan tim', 'Managerial'),
  ('D4-SIM-S08', 'Transformasi digital dan sistem informasi', 'Managerial'),
  ('D4-SIM-S09', 'Administrasi kepegawaian dan payroll', 'Technical'),
  ('D4-SIM-S10', 'Pengelolaan kinerja dan pengembangan SDM', 'Managerial'),
  ('D4-SIM-S11', 'Negosiasi dan pengembangan penjualan', 'Technical'),
  ('D4-SIM-S12', 'Penyusunan quotation dan administrasi order', 'Technical'),
  ('D4-SIM-S13', 'Pengelolaan hubungan dan kepuasan pelanggan', 'Managerial'),
  ('D4-SIM-S14', 'Pengembangan dan pemeliharaan aplikasi', 'Technical'),
  ('D4-SIM-S15', 'Keamanan data dan infrastruktur TI', 'Technical'),
  ('D4-SIM-S16', 'Analisis kebutuhan dan dukungan pengguna', 'Technical')
) c(code, name, category)
where not exists (select 1 from d3_competencies x where x.code = c.code);

-- 3. Requirements for the 12 positions B2 accounts use (none had any).
insert into position_requirements (position_id, competency_id, min_proficiency_level, is_mandatory)
select p.id, c.id, r.lvl, true
from (values
  ('Accounting Associate (Billing)', 'S01', 3), ('Accounting Associate (Billing)', 'S02', 3), ('Accounting Associate (Billing)', 'S03', 2),
  ('Cash Manager', 'S04', 4), ('Cash Manager', 'S02', 3), ('Cash Manager', 'S07', 3),
  ('Cash Manager Associate', 'S04', 3), ('Cash Manager Associate', 'S03', 2), ('Cash Manager Associate', 'S02', 2),
  ('Director of Finance, Accounting & Digital Transformation', 'S06', 4), ('Director of Finance, Accounting & Digital Transformation', 'S07', 4), ('Director of Finance, Accounting & Digital Transformation', 'S08', 3),
  ('HR Administrator', 'S09', 3), ('HR Administrator', 'S10', 3), ('HR Administrator', 'S03', 2),
  ('Manager of Accounting', 'S02', 4), ('Manager of Accounting', 'S05', 3), ('Manager of Accounting', 'S07', 3),
  ('Manager of Customer Success', 'S13', 4), ('Manager of Customer Success', 'S07', 3), ('Manager of Customer Success', 'S11', 3),
  ('Sales Administration Associate', 'S12', 3), ('Sales Administration Associate', 'S13', 2), ('Sales Administration Associate', 'S03', 2),
  ('Sales Executive', 'S11', 3), ('Sales Executive', 'S12', 3), ('Sales Executive', 'S13', 3),
  ('Tax Associate', 'S05', 3), ('Tax Associate', 'S03', 3), ('Tax Associate', 'S02', 2),
  ('Tax Manager', 'S05', 4), ('Tax Manager', 'S02', 3), ('Tax Manager', 'S07', 3),
  ('Tim IT', 'S14', 3), ('Tim IT', 'S15', 3), ('Tim IT', 'S16', 2)
) r(title, comp, lvl)
join d3_positions p on trim(p.title) = r.title
join d3_competencies c on c.code = 'D4-SIM-' || r.comp
on conflict (position_id, competency_id) do nothing;

-- 4. Skills for B2 accounts that also exist in D3 (matched by email). Employees rotate through three
--    outcomes so every status shows: 0 = all met, 1 = first competency below the requirement (Gap),
--    2 = last competency without evidence (Insufficient Data).
with emp as (
  select e.id d3_id, r.position_id, row_number() over (order by r.employee_id) - 1 n
  from b2_register r join d3_employee e on lower(e.email) = lower(r.email)
  where coalesce(r.is_active, true) and r.full_name is not null and exists (select 1 from auth.users u where u.id = r.id)
), req as (
  select q.position_id, q.competency_id, q.min_proficiency_level lvl, c.name,
         row_number() over (partition by q.position_id order by c.code) k, count(*) over (partition by q.position_id) total
  from position_requirements q join d3_competencies c on c.id = q.competency_id and c.code like 'D4-SIM-%'
)
insert into d3_employee_skills (employee_id, competency_id, proficiency_level, evidence_notes)
select emp.d3_id, req.competency_id,
  case when emp.n % 3 = 1 and req.k = 1 then greatest(req.lvl - 1, 1) else least(req.lvl + (emp.n % 2), 5) end,
  case when emp.n % 3 = 2 and req.k = req.total then null
       else 'Penilaian atasan Q3 2026 dan hasil kerja: ' || lower(req.name) end
from emp join req on req.position_id = emp.position_id
on conflict (employee_id, competency_id) do nothing;

commit;

-- Cleanup after the walkthrough (run only with the owners' agreement):
-- delete from d3_employee_skills where competency_id in (select id from d3_competencies where code like 'D4-SIM-%');
-- delete from position_requirements where competency_id in (select id from d3_competencies where code like 'D4-SIM-%');
-- delete from d3_competencies where code like 'D4-SIM-%';
-- delete from d4_position_kpi_roles where position_id in (select id from d3_positions where trim(title) in
--   ('Cash Manager','Cash Manager Associate','Tax Manager','Tax Associate','Manager of Customer Success','Tim IT'));
