ALTER TABLE auth_attempts DROP CONSTRAINT IF EXISTS auth_attempts_attempt_kind_check;
ALTER TABLE auth_attempts ADD CONSTRAINT auth_attempts_attempt_kind_check
    CHECK (attempt_kind IN ('Login','RecoveryLookup','RecoveryAnswer','PasswordReset','PasswordChange'));
