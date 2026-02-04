-- Allow service_role to insert into zip_lookup (for zip-lookup edge function caching)
CREATE POLICY "Allow service_role insert zip_lookup" ON public.zip_lookup
    FOR INSERT TO service_role WITH CHECK (true);

GRANT INSERT ON public.zip_lookup TO service_role;
