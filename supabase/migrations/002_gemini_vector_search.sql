-- Gemini Embedding 001 vectors use 1536 dimensions here. Legacy OpenAI vectors
-- remain stored but are ignored until each source is re-indexed with Gemini.
alter table public.shopai_knowledge
  drop constraint if exists shopai_knowledge_source_type_check;

alter table public.shopai_knowledge
  add constraint shopai_knowledge_source_type_check
  check (source_type in ('product', 'collection', 'page', 'policy', 'custom', 'faq'));

drop function if exists public.match_knowledge(extensions.vector, int, text);

create function public.match_knowledge(
  query_embedding extensions.vector(1536),
  match_count int default 8,
  filter_shop text default '',
  embedding_model text default 'gemini-embedding-001'
)
returns table (id bigint, source_type text, source_id text, title text, content text, metadata jsonb, similarity float)
language sql stable security invoker
set search_path = public, extensions
as $$
  select k.id, k.source_type, k.source_id, k.title, k.content, k.metadata,
         1 - (k.embedding <=> query_embedding) as similarity
  from public.shopai_knowledge k
  where k.shop_domain = filter_shop
    and k.metadata->>'embedding_model' = embedding_model
  order by k.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;

revoke all on function public.match_knowledge(extensions.vector, int, text, text) from public, anon, authenticated;
grant execute on function public.match_knowledge(extensions.vector, int, text, text) to service_role;
