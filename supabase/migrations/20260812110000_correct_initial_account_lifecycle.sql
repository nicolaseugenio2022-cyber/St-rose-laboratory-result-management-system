ALTER TABLE user_profiles ALTER COLUMN must_change_password SET DEFAULT FALSE;

UPDATE user_profiles
SET must_change_password = FALSE,
    updated_at = NOW()
WHERE must_change_password = TRUE
  AND security_answer_hash IS NULL;
