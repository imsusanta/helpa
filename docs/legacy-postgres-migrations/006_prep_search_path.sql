ALTER DATABASE postgres SET search_path TO public, extensions;
SELECT pg_catalog.set_config('search_path', 'public, extensions', false);
