-- Human-readable URL slugs for products, categories and stores.
--
-- Slugs are generated from the row's name (see slugify below) and kept unique
-- per table by appending -2, -3, … on collision. The uuid id stays the primary
-- key; the slug is only an alternative lookup key for nicer URLs, so existing
-- /products/<uuid> links keep working.

-- Lowercase, keep [a-z0-9], collapse runs of anything else to one hyphen.
-- Defined before slugify() because slugify depends on it.
CREATE OR REPLACE FUNCTION public.unaccent_fallback(value text)
RETURNS text AS $$
  SELECT value;
$$ LANGUAGE sql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.slugify(value text)
RETURNS text AS $$
  SELECT trim(both '-' from
    regexp_replace(
      regexp_replace(lower(public.unaccent_fallback(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$ LANGUAGE sql IMMUTABLE SET search_path = public;

-- Returns a slug for `base_name` that is not yet taken in `table_name`,
-- ignoring the row `exclude_id` (so updating a row can keep its own slug).
CREATE OR REPLACE FUNCTION public.unique_slug(
  table_name text,
  base_name text,
  exclude_id uuid DEFAULT NULL
) RETURNS text AS $$
DECLARE
  base text;
  candidate text;
  suffix int := 1;
  taken boolean;
BEGIN
  base := public.slugify(base_name);
  IF base = '' THEN
    base := 'item';
  END IF;

  candidate := base;
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I WHERE slug = $1 AND ($2 IS NULL OR id <> $2))',
      table_name
    ) INTO taken USING candidate, exclude_id;

    EXIT WHEN NOT taken;
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  END LOOP;

  RETURN candidate;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add the columns (nullable at first so existing rows can be backfilled).
ALTER TABLE public.products   ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.stores     ADD COLUMN IF NOT EXISTS slug text;

-- Backfill existing rows. Stores prefer location ("Manchester, UK") when set,
-- matching how the UI labels them.
UPDATE public.products   SET slug = public.unique_slug('products', name, id)                    WHERE slug IS NULL;
UPDATE public.categories SET slug = public.unique_slug('categories', name, id)                  WHERE slug IS NULL;
UPDATE public.stores     SET slug = public.unique_slug('stores', coalesce(location, name), id)  WHERE slug IS NULL;

-- Keep slugs in sync automatically on insert/update.
CREATE OR REPLACE FUNCTION public.set_slug() RETURNS TRIGGER AS $$
DECLARE
  source_name text;
  old_name text;
BEGIN
  -- NEW/OLD are typed to the triggering table, so `NEW.location` fails to
  -- compile on products/categories even inside an untaken IF branch. Going
  -- through to_jsonb() keeps this one function usable for all three tables.
  -- Stores are labelled by location in the UI; everything else uses name.
  IF TG_TABLE_NAME = 'stores' THEN
    source_name := coalesce(to_jsonb(NEW) ->> 'location', to_jsonb(NEW) ->> 'name');
  ELSE
    source_name := to_jsonb(NEW) ->> 'name';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'stores' THEN
      old_name := coalesce(to_jsonb(OLD) ->> 'location', to_jsonb(OLD) ->> 'name');
    ELSE
      old_name := to_jsonb(OLD) ->> 'name';
    END IF;
  END IF;

  -- Regenerate when the slug is missing, or when the name it came from changed.
  IF NEW.slug IS NULL OR NEW.slug = ''
     OR (TG_OP = 'UPDATE' AND public.slugify(source_name) <> public.slugify(old_name)) THEN
    NEW.slug := public.unique_slug(TG_TABLE_NAME, source_name, NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS products_set_slug ON public.products;
CREATE TRIGGER products_set_slug
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_slug();

DROP TRIGGER IF EXISTS categories_set_slug ON public.categories;
CREATE TRIGGER categories_set_slug
  BEFORE INSERT OR UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_slug();

DROP TRIGGER IF EXISTS stores_set_slug ON public.stores;
CREATE TRIGGER stores_set_slug
  BEFORE INSERT OR UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_slug();

-- Enforce uniqueness and make slug lookups fast.
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key   ON public.products (slug);
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON public.categories (slug);
CREATE UNIQUE INDEX IF NOT EXISTS stores_slug_key     ON public.stores (slug);
