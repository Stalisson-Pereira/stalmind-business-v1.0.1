-- ============================================================
-- StalMind Business V2
-- 02_permissions_and_real_data.sql
-- Permissões + RLS usando WORKSPACES + WORKSPACE_MEMBERS
-- ============================================================

-- ============================================================
-- 1. GARANTIR FUNÇÃO DE MEMBRO DO WORKSPACE
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace
          AND wm.user_id = auth.uid()
    );
$$;


-- ============================================================
-- 2. PERMISSÕES DAS TABELAS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.customers
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.quotes
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.quote_items
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.sales
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.sale_items
TO authenticated;


-- ============================================================
-- 3. CUSTOMERS
-- ============================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_all_workspace"
ON public.customers;

CREATE POLICY "customers_all_workspace"
ON public.customers
FOR ALL
TO authenticated
USING (
    public.is_workspace_member(workspace_id)
)
WITH CHECK (
    public.is_workspace_member(workspace_id)
);


-- ============================================================
-- 4. QUOTES
-- ============================================================

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes_all_workspace"
ON public.quotes;

CREATE POLICY "quotes_all_workspace"
ON public.quotes
FOR ALL
TO authenticated
USING (
    public.is_workspace_member(workspace_id)
)
WITH CHECK (
    public.is_workspace_member(workspace_id)
);


-- ============================================================
-- 5. QUOTE ITEMS
-- ============================================================

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_items_via_workspace"
ON public.quote_items;

CREATE POLICY "quote_items_via_workspace"
ON public.quote_items
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.quotes q
        WHERE q.id = quote_items.quote_id
          AND public.is_workspace_member(q.workspace_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.quotes q
        WHERE q.id = quote_items.quote_id
          AND public.is_workspace_member(q.workspace_id)
    )
);


-- ============================================================
-- 6. SALES
-- ============================================================

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_all_workspace"
ON public.sales;

CREATE POLICY "sales_all_workspace"
ON public.sales
FOR ALL
TO authenticated
USING (
    public.is_workspace_member(workspace_id)
)
WITH CHECK (
    public.is_workspace_member(workspace_id)
);


-- ============================================================
-- 7. SALE ITEMS
-- ============================================================

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sale_items_via_workspace"
ON public.sale_items;

CREATE POLICY "sale_items_via_workspace"
ON public.sale_items
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.sales s
        WHERE s.id = sale_items.sale_id
          AND public.is_workspace_member(s.workspace_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.sales s
        WHERE s.id = sale_items.sale_id
          AND public.is_workspace_member(s.workspace_id)
    )
);


-- ============================================================
-- 8. WORKSPACE MEMBERS
-- ============================================================

GRANT SELECT
ON public.workspace_members
TO authenticated;

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_members_select_same_workspace"
ON public.workspace_members;

CREATE POLICY "workspace_members_select_same_workspace"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
    public.is_workspace_member(workspace_id)
);


-- ============================================================
-- 9. WORKSPACES
-- ============================================================

GRANT SELECT, UPDATE
ON public.workspaces
TO authenticated;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspaces_select_member"
ON public.workspaces;

CREATE POLICY "workspaces_select_member"
ON public.workspaces
FOR SELECT
TO authenticated
USING (
    public.is_workspace_member(id)
);

DROP POLICY IF EXISTS "workspaces_update_member"
ON public.workspaces;

CREATE POLICY "workspaces_update_member"
ON public.workspaces
FOR UPDATE
TO authenticated
USING (
    public.is_workspace_member(id)
)
WITH CHECK (
    public.is_workspace_member(id)
);


-- ============================================================
-- 10. VERIFICAÇÃO
-- ============================================================

SELECT
    id,
    name,
    plan,
    trial_used,
    trial_started_at,
    trial_ends_at,
    CASE
        WHEN trial_ends_at IS NULL THEN 0
        WHEN trial_ends_at <= now() THEN 0
        ELSE CEIL(
            EXTRACT(
                EPOCH FROM (trial_ends_at - now())
            ) / 86400
        )::integer
    END AS dias_restantes
FROM public.workspaces
ORDER BY created_at DESC;