BEGIN;
CREATE TABLE commission_policies (
  id UUID NOT NULL PRIMARY KEY,
  employee_id UUID NOT NULL,
  rate_percent NUMERIC(65,30) NOT NULL,
  previous_rate_percent NUMERIC(65,30),
  effective_at TIMESTAMPTZ(3) NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT commission_policies_employee_id_effective_at_key UNIQUE (employee_id, effective_at),
  CONSTRAINT commission_rate_nonnegative CHECK (rate_percent >= 0 AND rate_percent <> 'NaN'::numeric),
  CONSTRAINT commission_previous_rate_nonnegative CHECK (previous_rate_percent IS NULL OR (previous_rate_percent >= 0 AND previous_rate_percent <> 'NaN'::numeric))
);
-- Validate the target on insertion, then retain its historical identity even if an account is removed later.
CREATE FUNCTION validate_commission_employee() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM users WHERE id = NEW.employee_id AND role = 'STAFF' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commission policy requires an existing STAFF account'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER commission_policies_employee BEFORE INSERT ON commission_policies FOR EACH ROW EXECUTE FUNCTION validate_commission_employee();
CREATE TRIGGER commission_policies_immutable BEFORE UPDATE OR DELETE ON commission_policies FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER commission_policies_no_truncate BEFORE TRUNCATE ON commission_policies FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
COMMIT;
