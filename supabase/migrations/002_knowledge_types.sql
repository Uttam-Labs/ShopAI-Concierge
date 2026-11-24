alter table public.shopai_knowledge
  drop constraint if exists shopai_knowledge_source_type_check;

alter table public.shopai_knowledge
  add constraint shopai_knowledge_source_type_check
  check (source_type in ('product', 'collection', 'page', 'policy', 'faq', 'custom'));
