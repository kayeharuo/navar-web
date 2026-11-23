-- Immutable named editor layouts, separate from the applied map.
CREATE TABLE IF NOT EXISTS public.node_map_snapshot (
  snapshot_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ar_development_id bigint NOT NULL REFERENCES public.ar_development(ar_development_id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_by bigint NOT NULL REFERENCES public.admin(admin_id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS node_map_snapshot_project ON public.node_map_snapshot(ar_development_id, created_at DESC);
ALTER TABLE public.node_map_snapshot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.node_map_snapshot FROM anon, authenticated;
GRANT SELECT, INSERT ON public.node_map_snapshot TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.node_map_snapshot_snapshot_id_seq TO service_role;
