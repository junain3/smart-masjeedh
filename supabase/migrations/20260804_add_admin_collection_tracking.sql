-- Add collection_source field to distinguish admin direct collections from collector collections
-- This allows tracking "Admin Collection" category separately in pending approvals

ALTER TABLE public.subscription_collections 
ADD COLUMN IF NOT EXISTS collection_source TEXT DEFAULT 'collector' 
CHECK (collection_source IN ('collector', 'admin_direct'));

-- Add index for filtering by collection source
CREATE INDEX IF NOT EXISTS subscription_collections_source_idx 
ON public.subscription_collections (masjid_id, collection_source, status);

-- Update existing admin collections to have correct source
UPDATE public.subscription_collections 
SET collection_source = 'admin_direct' 
WHERE collected_by_user_id IN (
  SELECT ur.user_id 
  FROM public.user_roles ur 
  WHERE ur.role IN ('super_admin', 'co_admin')
    AND ur.masjid_id = subscription_collections.masjid_id
)
AND collection_source = 'collector';
