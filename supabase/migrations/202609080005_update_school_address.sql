update public.school_content
set
  body = replace(
    replace(body, '5104 N Orange Blossom Trail, Suite 205', '21902 State Road 46'),
    'Orlando, FL 32810',
    'Mount Dora Florida 32757'
  ),
  updated_at = now()
where body like '%5104 N Orange Blossom Trail%'
   or body like '%Orlando, FL 32810%';
