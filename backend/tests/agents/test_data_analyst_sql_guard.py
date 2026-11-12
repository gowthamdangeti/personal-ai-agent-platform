import pytest
from app.agents.data_analyst.agent import validate_and_guard_sql


def test_sqlglot_allows_valid_select():
    sql = "SELECT id, name, created_at FROM agents WHERE kind = 'knowledge'"
    guarded = validate_and_guard_sql(sql)
    assert guarded.startswith("SELECT")
    assert "LIMIT 100" in guarded


def test_sqlglot_preserves_existing_limit():
    sql = "SELECT id, name FROM agents LIMIT 25"
    guarded = validate_and_guard_sql(sql)
    assert "LIMIT 25" in guarded
    assert "LIMIT 100" not in guarded


def test_sqlglot_rejects_drop():
    with pytest.raises(ValueError, match="Security Violation: Only SELECT statements are permitted"):
        validate_and_guard_sql("DROP TABLE agents")


def test_sqlglot_rejects_insert():
    with pytest.raises(ValueError, match="Security Violation: Only SELECT statements are permitted"):
        validate_and_guard_sql("INSERT INTO agents (name, slug) VALUES ('Hacked', 'hacked')")


def test_sqlglot_rejects_update():
    with pytest.raises(ValueError, match="Security Violation: Only SELECT statements are permitted"):
        validate_and_guard_sql("UPDATE agents SET description = 'Hacked'")


def test_sqlglot_rejects_alter():
    with pytest.raises(ValueError, match="Security Violation: Only SELECT statements are permitted"):
        validate_and_guard_sql("ALTER TABLE agents ADD COLUMN hacked text")


def test_sqlglot_rejects_delete():
    with pytest.raises(ValueError, match="Security Violation: Only SELECT statements are permitted"):
        validate_and_guard_sql("DELETE FROM documents WHERE id = 1")


def test_sqlglot_rejects_empty():
    with pytest.raises(ValueError, match="SQL statement cannot be empty"):
        validate_and_guard_sql("")

