"""SQLite database (standard library only). Simple helper functions, no ORM."""
import json
import os
import secrets
import sqlite3

from app.config import BASE_DIR, FEATURE_NAMES

DB_PATH = os.environ.get("CSCORE_DB", os.path.join(BASE_DIR, "cscore.db"))


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # rows behave like dicts
    return conn


def init_db():
    """Create all tables (safe to call many times)."""
    conn = get_conn()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS repos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT UNIQUE NOT NULL,      -- e.g. "client/order-service"
            installation_id INTEGER,             -- GitHub App installation
            api_key TEXT,                        -- for telemetry ingestion
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Phase 1: history of changes/deployments per service
        CREATE TABLE IF NOT EXISTS deploy_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            repo_id INTEGER NOT NULL,
            service_name TEXT NOT NULL,
            commit_sha TEXT,
            services_touched TEXT,               -- JSON list, >1 means co-deploy
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Phase 2: who calls whom (consumer -> provider)
        CREATE TABLE IF NOT EXISTS service_registry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            repo_id INTEGER NOT NULL,
            consumer TEXT NOT NULL,
            provider TEXT NOT NULL,
            UNIQUE(repo_id, consumer, provider)
        );

        -- Phase 3: raw runtime metrics pushed by OpenTelemetry collector
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            repo_id INTEGER NOT NULL,
            service_name TEXT,
            metric TEXT NOT NULL,                -- e.g. "max_call_depth"
            value REAL NOT NULL,
            ts TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Final result of every PR analysis
        CREATE TABLE IF NOT EXISTS feature_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            repo_id INTEGER NOT NULL,
            pr_number INTEGER,
            commit_sha TEXT,
            service_name TEXT,
            features TEXT,                       -- JSON of the 10 features
            blast_radius REAL,
            cscore REAL,
            decision TEXT,                       -- LOW_RISK / HIGH_RISK
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    conn.commit()
    conn.close()


# ---------- repos ----------
def add_repo(full_name, installation_id=None):
    conn = get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO repos (full_name, installation_id) VALUES (?, ?)",
        (full_name, installation_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM repos WHERE full_name=?", (full_name,)).fetchone()
    conn.close()
    return dict(row)


def get_repo(full_name):
    conn = get_conn()
    row = conn.execute("SELECT * FROM repos WHERE full_name=?", (full_name,)).fetchone()
    conn.close()
    return dict(row) if row else None


def create_api_key(repo_id):
    key = secrets.token_hex(16)
    conn = get_conn()
    conn.execute("UPDATE repos SET api_key=? WHERE id=?", (key, repo_id))
    conn.commit()
    conn.close()
    return key


def get_repo_by_api_key(api_key):
    conn = get_conn()
    row = conn.execute("SELECT * FROM repos WHERE api_key=?", (api_key,)).fetchone()
    conn.close()
    return dict(row) if row else None


# ---------- service registry ----------
def add_dependency(repo_id, consumer, provider):
    conn = get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO service_registry (repo_id, consumer, provider) VALUES (?,?,?)",
        (repo_id, consumer, provider),
    )
    conn.commit()
    conn.close()


def get_consumers(repo_id, provider):
    conn = get_conn()
    rows = conn.execute(
        "SELECT consumer FROM service_registry WHERE repo_id=? AND provider=?",
        (repo_id, provider),
    ).fetchall()
    conn.close()
    return [r["consumer"] for r in rows]


def get_all_dependencies(repo_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT consumer, provider FROM service_registry WHERE repo_id=?", (repo_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------- deploy events (Phase 1) ----------
def add_deploy_event(repo_id, service_name, commit_sha, services_touched):
    conn = get_conn()
    conn.execute(
        "INSERT INTO deploy_events (repo_id, service_name, commit_sha, services_touched) VALUES (?,?,?,?)",
        (repo_id, service_name, commit_sha, json.dumps(services_touched)),
    )
    conn.commit()
    conn.close()


def get_deploy_events(repo_id, service_name, days=30):
    conn = get_conn()
    rows = conn.execute(
        """SELECT * FROM deploy_events
           WHERE repo_id=? AND service_name=? AND timestamp >= datetime('now', ?)""",
        (repo_id, service_name, f"-{days} days"),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------- telemetry (Phase 3) ----------
def add_telemetry(repo_id, service_name, metric, value):
    conn = get_conn()
    conn.execute(
        "INSERT INTO telemetry (repo_id, service_name, metric, value) VALUES (?,?,?,?)",
        (repo_id, service_name, metric, value),
    )
    conn.commit()
    conn.close()


def get_latest_telemetry(repo_id, service_name):
    """Most recent value of every metric for a service -> {metric: value}."""
    conn = get_conn()
    rows = conn.execute(
        """SELECT metric, value FROM telemetry
           WHERE repo_id=? AND service_name=? ORDER BY id ASC""",
        (repo_id, service_name),
    ).fetchall()
    conn.close()
    return {r["metric"]: r["value"] for r in rows}  # later rows overwrite earlier


# ---------- results ----------
def save_run(repo_id, pr_number, commit_sha, service_name, result):
    conn = get_conn()
    conn.execute(
        """INSERT INTO feature_runs
           (repo_id, pr_number, commit_sha, service_name, features, blast_radius, cscore, decision)
           VALUES (?,?,?,?,?,?,?,?)""",
        (
            repo_id, pr_number, commit_sha, service_name,
            json.dumps({k: result["features"].get(k) for k in FEATURE_NAMES}),
            result.get("blast_radius", 0), result["cscore"], result["decision"],
        ),
    )
    conn.commit()
    conn.close()


def get_runs(repo_id=None, limit=50):
    conn = get_conn()
    if repo_id:
        rows = conn.execute(
            "SELECT * FROM feature_runs WHERE repo_id=? ORDER BY id DESC LIMIT ?", (repo_id, limit)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM feature_runs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]
