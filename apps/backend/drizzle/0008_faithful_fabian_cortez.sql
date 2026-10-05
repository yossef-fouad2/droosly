ALTER TABLE "categories" RENAME COLUMN "nameEn" TO "name_en";--> statement-breakpoint
ALTER TABLE "categories" RENAME COLUMN "nameAr" TO "name_ar";

INSERT INTO categories (name_ar, name_en, slug) VALUES
  ('اللغة العربية', 'Arabic Language', 'arabic-language'),
  ('اللغة الإنجليزية', 'English Language', 'english-language'),
  ('اللغة الفرنسية', 'French Language', 'french-language'),
  ('الرياضيات', 'Mathematics', 'mathematics'),
  ('العلوم', 'Science', 'science'),
  ('الدراسات الاجتماعية', 'Social Studies', 'social-studies'),
  ('الفيزياء', 'Physics', 'physics'),
  ('الكيمياء', 'Chemistry', 'chemistry'),
  ('الأحياء', 'Biology', 'biology'),
  ('التاريخ', 'History', 'history'),
  ('الجغرافيا', 'Geography', 'geography'),
  ('الفلسفة والمنطق', 'Philosophy and Logic', 'philosophy-logic'),
  ('علم النفس والاجتماع', 'Psychology and Sociology', 'psychology-sociology'),
  ('التربية الدينية', 'Religious Education', 'religious-education'),
  ('التربية الوطنية', 'National Education', 'national-education'),
  ('تكنولوجيا المعلومات والاتصالات', 'Information and Communication Technology', 'ict'),
  ('الاقتصاد', 'Economics', 'economics'),
  ('الإحصاء', 'Statistics', 'statistics'),
  ('التربية الفنية', 'Art Education', 'art-education'),
  ('التربية الرياضية', 'Physical Education', 'physical-education');