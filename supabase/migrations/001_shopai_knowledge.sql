create extension if not exists vector with schema extensions;

create table if not exists public.shopai_knowledge (
  id bigint generated always as identity primary key,
  shop_domain text not null,
  source_type text not null check (source_type in ('product', 'page', 'policy', 'faq')),
  source_id text not null,
  title text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536) not null,
  updated_at timestamptz not null default now(),
  unique (shop_domain, source_type, source_id)
);

create index if not exists shopai_knowledge_embedding_idx
  on public.shopai_knowledge using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists shopai_knowledge_shop_idx
  on public.shopai_knowledge (shop_domain);

alter table public.shopai_knowledge enable row level security;

create or replace function public.match_knowledge(
  query_embedding extensions.vector(1536),
  match_count int default 8,
  filter_shop text default ''
)
returns table (id bigint, source_type text, source_id text, title text, content text, metadata jsonb, similarity float)
language sql stable security invoker
set search_path = public, extensions
as $$
  select k.id, k.source_type, k.source_id, k.title, k.content, k.metadata,
         1 - (k.embedding <=> query_embedding) as similarity
  from public.shopai_knowledge k
  where k.shop_domain = filter_shop
  order by k.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;

revoke all on function public.match_knowledge(extensions.vector, int, text) from public, anon, authenticated;
grant execute on function public.match_knowledge(extensions.vector, int, text) to service_role;
