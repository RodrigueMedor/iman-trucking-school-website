-- The gallery photos now ship with the site (public/images/gallery). Remove
-- the saved copies of the old defaults, whose WordPress URLs no longer load,
-- so the new defaults show. Images an admin set to any other URL are kept.
delete from public.school_content
where page = 'gallery'
  and section_key like 'image-%'
  and image_url like 'https://imantruckingschool.com/wp-content/uploads/2025/02/%';
