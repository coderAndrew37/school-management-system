-- ============================================================
-- SEED: Standard CBC Subjects
-- Run once after creating the subjects table.
-- Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.
-- ============================================================

INSERT INTO subjects (name, code, level, weekly_lessons) VALUES

-- ── Lower Primary (PP1 – Grade 3) ─────────────────────────────────────────
('Literacy Activities',          'LIT-ACT',   'lower_primary',    10),
('Kiswahili Language Activities','KSW-ACT',   'lower_primary',    10),
('Mathematical Activities',      'MTH-ACT',   'lower_primary',    10),
('Environmental Activities',     'ENV-ACT',   'lower_primary',    5),
('Creative Arts & Crafts',       'CRT-ACT',   'lower_primary',    5),
('Music & Movement',             'MUS-MOV',   'lower_primary',    5),
('Religious Education',          'RE-LP',     'lower_primary',    2),
('Physical Education',           'PE-LP',     'lower_primary',    3),

-- ── Upper Primary (Grade 4 – 6) ───────────────────────────────────────────
('English',                      'ENG',       'upper_primary',    6),
('Kiswahili',                    'KSW',       'upper_primary',    6),
('Mathematics',                  'MTH',       'upper_primary',    6),
('Integrated Science',           'INT-SCI',   'upper_primary',    6),
('Social Studies',               'SOC-STD',   'upper_primary',    4),
('Creative Arts',                'CRT',       'upper_primary',    4),
('Music',                        'MUS',       'upper_primary',    3),
('Physical Education',           'PE',        'upper_primary',    3),
('Life Skills',                  'LIFE',      'upper_primary',    3),
('Religious Education',          'RE',        'upper_primary',    2),

-- ── Junior Secondary (Grade 7–9 / JSS 1–3) ───────────────────────────────
('English & Literature',         'ENG-LIT',   'junior_secondary', 5),
('Kiswahili & KSL',              'KSW-KSL',   'junior_secondary', 5),
('Mathematics',                  'MTH-JSS',   'junior_secondary', 6),
('Integrated Science',           'INT-SCI-J', 'junior_secondary', 6),
('Social Studies',               'SOC-STD-J', 'junior_secondary', 4),
('Business Studies',             'BIZ-STD',   'junior_secondary', 4),
('Agriculture',                  'AGR',       'junior_secondary', 4),
('Pre-Technical Studies',        'PRE-TECH',  'junior_secondary', 4),
('Creative Arts & Sports',       'CRT-SPT',   'junior_secondary', 4),
('Religious Education',          'RE-JSS',    'junior_secondary', 2)

ON CONFLICT (code) DO NOTHING;