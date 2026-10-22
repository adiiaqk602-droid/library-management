insert into public.libraries (name, slug) values
 ('Main Library', 'main'),
 ('BS Library', 'bs'),
 ('Ilyas Library', 'ilyas'),
 ('Sajid Ilyas Library', 'sajid-ilyas'),
 ('Pre Library', 'pre')
on conflict (slug) do nothing;
