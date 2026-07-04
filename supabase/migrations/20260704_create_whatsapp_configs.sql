CREATE TABLE IF NOT EXISTS public.whatsapp_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID NOT NULL REFERENCES public.masjids(id) ON DELETE CASCADE,
  api_key TEXT,
  phone_number_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_masjid_id
ON public.whatsapp_configs(masjid_id);
