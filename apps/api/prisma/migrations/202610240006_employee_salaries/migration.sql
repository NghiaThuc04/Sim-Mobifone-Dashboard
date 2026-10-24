BEGIN;
CREATE TABLE employee_salaries (
 id UUID PRIMARY KEY, employee_id UUID NOT NULL, amount NUMERIC(65,30) NOT NULL,
 previous_amount NUMERIC(65,30), effective_from TIMESTAMPTZ(3) NOT NULL,
 created_by UUID NOT NULL, created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT employee_salaries_employee_id_effective_from_key UNIQUE(employee_id,effective_from),
 CHECK(amount >= 0 AND amount <> 'NaN'::numeric),
 CHECK(previous_amount IS NULL OR (previous_amount >= 0 AND previous_amount <> 'NaN'::numeric))
);
CREATE TRIGGER employee_salaries_target BEFORE INSERT ON employee_salaries FOR EACH ROW EXECUTE FUNCTION validate_commission_employee();
CREATE TRIGGER employee_salaries_immutable BEFORE UPDATE OR DELETE ON employee_salaries FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER employee_salaries_no_truncate BEFORE TRUNCATE ON employee_salaries FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
COMMIT;
