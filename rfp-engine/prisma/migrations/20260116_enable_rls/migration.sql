-- Row-Level Security (RLS) Migration
-- Provides database-level user isolation as defense-in-depth
-- Works alongside application-level authorization (Prisma queries)

-- =============================================================================
-- SETUP: Create function to get current user ID from session variable
-- =============================================================================

-- Function to safely get current user ID (returns NULL if not set)
CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ENABLE RLS ON TABLES WITH DIRECT userId
-- =============================================================================

-- Project table
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" FORCE ROW LEVEL SECURITY;

CREATE POLICY project_isolation_policy ON "Project"
  USING ("userId" = current_user_id())
  WITH CHECK ("userId" = current_user_id());

-- Allow service role (migrations, cron jobs) to bypass RLS
CREATE POLICY project_service_bypass ON "Project"
  USING (current_user_id() IS NULL)
  WITH CHECK (current_user_id() IS NULL);


-- PastResponse table
ALTER TABLE "PastResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PastResponse" FORCE ROW LEVEL SECURITY;

CREATE POLICY pastresponse_isolation_policy ON "PastResponse"
  USING ("userId" = current_user_id())
  WITH CHECK ("userId" = current_user_id());

CREATE POLICY pastresponse_service_bypass ON "PastResponse"
  USING (current_user_id() IS NULL)
  WITH CHECK (current_user_id() IS NULL);


-- ConsentLog table
ALTER TABLE "ConsentLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentLog" FORCE ROW LEVEL SECURITY;

CREATE POLICY consentlog_isolation_policy ON "ConsentLog"
  USING ("userId" = current_user_id())
  WITH CHECK ("userId" = current_user_id());

CREATE POLICY consentlog_service_bypass ON "ConsentLog"
  USING (current_user_id() IS NULL)
  WITH CHECK (current_user_id() IS NULL);


-- DataExportRequest table
ALTER TABLE "DataExportRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataExportRequest" FORCE ROW LEVEL SECURITY;

CREATE POLICY dataexportrequest_isolation_policy ON "DataExportRequest"
  USING ("userId" = current_user_id())
  WITH CHECK ("userId" = current_user_id());

CREATE POLICY dataexportrequest_service_bypass ON "DataExportRequest"
  USING (current_user_id() IS NULL)
  WITH CHECK (current_user_id() IS NULL);


-- SingleUsePurchase table
ALTER TABLE "SingleUsePurchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SingleUsePurchase" FORCE ROW LEVEL SECURITY;

CREATE POLICY singleusepurchase_isolation_policy ON "SingleUsePurchase"
  USING ("userId" = current_user_id())
  WITH CHECK ("userId" = current_user_id());

CREATE POLICY singleusepurchase_service_bypass ON "SingleUsePurchase"
  USING (current_user_id() IS NULL)
  WITH CHECK (current_user_id() IS NULL);


-- =============================================================================
-- ENABLE RLS ON TABLES WITH INDIRECT userId (via foreign key)
-- =============================================================================

-- Requirement table (userId via Project)
ALTER TABLE "Requirement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Requirement" FORCE ROW LEVEL SECURITY;

CREATE POLICY requirement_isolation_policy ON "Requirement"
  USING (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "Requirement"."projectId"
      AND p."userId" = current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "Requirement"."projectId"
      AND p."userId" = current_user_id()
    )
  );

CREATE POLICY requirement_service_bypass ON "Requirement"
  USING (current_user_id() IS NULL)
  WITH CHECK (current_user_id() IS NULL);


-- RequirementVersion table (userId via Requirement -> Project)
ALTER TABLE "RequirementVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequirementVersion" FORCE ROW LEVEL SECURITY;

CREATE POLICY requirementversion_isolation_policy ON "RequirementVersion"
  USING (
    EXISTS (
      SELECT 1 FROM "Requirement" r
      JOIN "Project" p ON p.id = r."projectId"
      WHERE r.id = "RequirementVersion"."requirementId"
      AND p."userId" = current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Requirement" r
      JOIN "Project" p ON p.id = r."projectId"
      WHERE r.id = "RequirementVersion"."requirementId"
      AND p."userId" = current_user_id()
    )
  );

CREATE POLICY requirementversion_service_bypass ON "RequirementVersion"
  USING (current_user_id() IS NULL)
  WITH CHECK (current_user_id() IS NULL);


-- ProjectExport table (userId via Project)
ALTER TABLE "ProjectExport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectExport" FORCE ROW LEVEL SECURITY;

CREATE POLICY projectexport_isolation_policy ON "ProjectExport"
  USING (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "ProjectExport"."projectId"
      AND p."userId" = current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "ProjectExport"."projectId"
      AND p."userId" = current_user_id()
    )
  );

CREATE POLICY projectexport_service_bypass ON "ProjectExport"
  USING (current_user_id() IS NULL)
  WITH CHECK (current_user_id() IS NULL);


-- =============================================================================
-- AUDIT LOG: Special handling (admin access needed, userId can be NULL)
-- =============================================================================

-- AuditLog: Users can see their own logs, service/admin can see all
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;

-- Users can only read their own audit logs
CREATE POLICY auditlog_user_read_policy ON "AuditLog"
  FOR SELECT
  USING (
    "userId" = current_user_id()
    OR current_user_id() IS NULL  -- Service bypass
  );

-- Only service role can write audit logs (not users directly)
CREATE POLICY auditlog_service_write_policy ON "AuditLog"
  FOR INSERT
  WITH CHECK (current_user_id() IS NULL);

CREATE POLICY auditlog_service_update_policy ON "AuditLog"
  FOR UPDATE
  USING (current_user_id() IS NULL)
  WITH CHECK (current_user_id() IS NULL);

CREATE POLICY auditlog_service_delete_policy ON "AuditLog"
  FOR DELETE
  USING (current_user_id() IS NULL);


-- =============================================================================
-- INDEX OPTIMIZATION FOR RLS SUBQUERIES
-- =============================================================================

-- These indexes improve RLS policy performance for subquery-based checks
CREATE INDEX IF NOT EXISTS idx_project_userid ON "Project"("userId");
CREATE INDEX IF NOT EXISTS idx_requirement_projectid ON "Requirement"("projectId");
CREATE INDEX IF NOT EXISTS idx_requirementversion_requirementid ON "RequirementVersion"("requirementId");
CREATE INDEX IF NOT EXISTS idx_projectexport_projectid ON "ProjectExport"("projectId");
