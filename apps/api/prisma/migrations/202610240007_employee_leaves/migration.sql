BEGIN;
CREATE TABLE employee_leave_records (
 id UUID PRIMARY KEY, employee_id UUID NOT NULL, from_date DATE NOT NULL, to_date DATE NOT NULL,
 days NUMERIC(65,30) NOT NULL CHECK(days > 0 AND days <> 'NaN'::numeric),
 reason VARCHAR(500) NOT NULL CHECK(length(btrim(reason)) > 0), notes VARCHAR(2000) NOT NULL DEFAULT '',
 created_by UUID NOT NULL, created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(to_date >= from_date), CHECK(days <= to_date - from_date + 1),
 CHECK((extract(year FROM to_date) - extract(year FROM from_date))*12 + extract(month FROM to_date) - extract(month FROM from_date) < 120)
);
CREATE INDEX employee_leave_records_employee_id_from_date_to_date_idx ON employee_leave_records(employee_id,from_date,to_date);
CREATE TABLE employee_leave_allocations (
 leave_record_id UUID NOT NULL REFERENCES employee_leave_records(id) ON DELETE RESTRICT,
 month DATE NOT NULL CHECK(extract(day FROM month) = 1),
 days NUMERIC(65,30) NOT NULL CHECK(days >= 0 AND days <> 'NaN'::numeric),
 PRIMARY KEY(leave_record_id,month)
);
CREATE INDEX employee_leave_allocations_month_idx ON employee_leave_allocations(month);
CREATE FUNCTION validate_leave_target() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM users WHERE id=NEW.employee_id AND role='STAFF' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Leave requires an existing STAFF account'; END IF;
 IF EXISTS(SELECT 1 FROM employee_leave_records WHERE employee_id=NEW.employee_id AND from_date<=NEW.to_date AND to_date>=NEW.from_date)
 THEN RAISE EXCEPTION 'Overlapping leave record' USING ERRCODE='23505'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER employee_leave_target BEFORE INSERT ON employee_leave_records FOR EACH ROW EXECUTE FUNCTION validate_leave_target();
CREATE FUNCTION validate_leave_allocations() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target UUID; parent employee_leave_records%ROWTYPE; allocation_sum NUMERIC; allocation_count INT; expected INT;
BEGIN
 IF TG_TABLE_NAME='employee_leave_records' THEN target=NEW.id; ELSE target=NEW.leave_record_id; END IF;
 SELECT * INTO STRICT parent FROM employee_leave_records WHERE id=target;
 SELECT sum(days),count(*) INTO allocation_sum,allocation_count FROM employee_leave_allocations WHERE leave_record_id=target;
 expected=(extract(year FROM parent.to_date)-extract(year FROM parent.from_date))*12+extract(month FROM parent.to_date)-extract(month FROM parent.from_date)+1;
 IF allocation_sum IS DISTINCT FROM parent.days OR allocation_count<>expected OR EXISTS(
  SELECT 1 FROM employee_leave_allocations a WHERE a.leave_record_id=target AND
   (a.month<date_trunc('month',parent.from_date)::date OR a.month>date_trunc('month',parent.to_date)::date OR
    a.days>least(parent.to_date,(a.month+interval '1 month - 1 day')::date)-greatest(parent.from_date,a.month)+1)
 ) THEN RAISE EXCEPTION 'Confirmed monthly allocations must match leave period and total' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER leave_totals_parent AFTER INSERT ON employee_leave_records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_leave_allocations();
CREATE CONSTRAINT TRIGGER leave_totals_child AFTER INSERT ON employee_leave_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_leave_allocations();
CREATE TRIGGER employee_leave_records_immutable BEFORE UPDATE OR DELETE ON employee_leave_records FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER employee_leave_allocations_immutable BEFORE UPDATE OR DELETE ON employee_leave_allocations FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER employee_leave_records_no_truncate BEFORE TRUNCATE ON employee_leave_records FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER employee_leave_allocations_no_truncate BEFORE TRUNCATE ON employee_leave_allocations FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
COMMIT;
