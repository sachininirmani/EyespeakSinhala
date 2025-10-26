from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3, time, os, json
import random

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "evaluation.db")

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def table_has_column(conn, table, column):
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    cols = [r[1] for r in cur.fetchall()]
    return column in cols

def ensure_column(conn, table, column, coldef):
    if not table_has_column(conn, table, column):
        cur = conn.cursor()
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coldef}")
        conn.commit()

def init_db():
    conn = db()
    cur = conn.cursor()
    # sessions
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id TEXT,
            layouts_json TEXT,
            created_at INTEGER
        )
    """)
    # migrate: add extended participant metadata (safe if already exists)
    ensure_column(conn, "sessions", "participant_name", "TEXT")
    ensure_column(conn, "sessions", "participant_age", "TEXT")
    ensure_column(conn, "sessions", "familiarity", "TEXT")
    ensure_column(conn, "sessions", "wears_specks", "TEXT")

    # trials
    cur.execute("""
        CREATE TABLE IF NOT EXISTS trials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            participant_id TEXT,
            layout_id TEXT,
            round_id TEXT,
            prompt_id TEXT,
            intended_text TEXT,
            transcribed_text TEXT,
            dwell_main_ms INTEGER,
            dwell_popup_ms INTEGER,
            duration_ms INTEGER,
            total_keystrokes INTEGER,
            deletes INTEGER,
            eye_distance_px REAL,
            gross_wpm REAL,
            net_wpm REAL,
            accuracy_pct REAL,
            kspc REAL,
            created_at INTEGER
        )
    """)

    # events
    cur.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            participant_id TEXT,
            layout_id TEXT,
            round_id TEXT,
            ts_ms INTEGER,
            event_type TEXT,
            x REAL,
            y REAL,
            key TEXT,
            is_delete INTEGER
        )
    """)

    # sus
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sus (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            participant_id TEXT,
            layout_id TEXT,
            items_json TEXT,
            sus_score REAL,
            created_at INTEGER
        )
    """)

    # feedbacks (new)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS feedbacks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            participant_id TEXT,
            feedback TEXT,
            created_at INTEGER
        )
    """)

    conn.commit()
    conn.close()

init_db()

# Load Sinhala prompts / models
with open(os.path.join(DATA_DIR, "prompts_sinhala.json"), "r", encoding="utf-8") as f:
    PROMPTS = json.load(f)

SINHALA_DIACRITICS = set(list("ාැෑිීුූෘෲෙේොෝෞ්ංඃෟ"))
def is_diacritic(ch: str) -> bool:
    return ch in SINHALA_DIACRITICS

def last_base_consonant(word: str) -> str:
    for ch in reversed(word):
        if not is_diacritic(ch):
            return ch
    return ""

def get_last_word(text: str) -> str:
    return text.strip().split(" ")[-1] if text.strip() else ""

with open(os.path.join(DATA_DIR, "word_frequency_clean.txt"), "r", encoding="utf-8") as f:
    corpus_words = f.read().splitlines()

with open(os.path.join(DATA_DIR, "vowel_bigrams.json"), "r", encoding="utf-8") as f:
    vowel_bigrams = json.load(f)

with open(os.path.join(DATA_DIR, "vowel_combination_map_Most_Used.json"), "r", encoding="utf-8") as f:
    vowel_prediction_map = json.load(f)

@app.get("/predict/word")
def predict_word():
    prefix = request.args.get("prefix", "")
    if not prefix:
        return jsonify([])
    predictions = [w for w in corpus_words if w.startswith(prefix)]
    return jsonify(predictions[:5])

@app.get("/predict/vowel")
def predict_vowel():
    prefix = request.args.get("prefix", "")
    current = request.args.get("current", "")
    if not prefix:
        return jsonify([])

    base_scope = prefix[:-1] if prefix else prefix
    prev_base = last_base_consonant(base_scope)
    current_cons = current or (prefix[-1] if prefix else "")

    if not prev_base:
        suggestions = vowel_bigrams.get(current_cons, [])
        return jsonify(suggestions[:15])

    key = prev_base + current_cons
    suggestions = vowel_prediction_map.get(key, [])
    return jsonify(suggestions[:15])


@app.get("/prompts")
def get_prompts():
    """Return randomized prompt subset (4 one-word + 3 composition)."""
    try:
        one_word_all = PROMPTS.get("one_word", [])
        composition_all = PROMPTS.get("composition", [])

        one_word_sample = random.sample(one_word_all, min(4, len(one_word_all)))
        composition_sample = random.sample(composition_all, min(3, len(composition_all)))

        return jsonify({
            "one_word": one_word_sample,
            "composition": composition_sample
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/session/start")
def session_start():
    data = request.get_json(force=True)
    participant_id = data.get("participant_id")
    participant_name = data.get("participant_name", "")
    participant_age = data.get("participant_age", "")
    familiarity = data.get("familiarity", "No")
    wears_specks = data.get("wears_specks", "No")
    layouts = data.get("layouts", ["eyespeak", "wijesekara", "helakuru"])
    now = int(time.time()*1000)
    conn = db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO sessions (participant_id, participant_name, participant_age, familiarity, wears_specks, layouts_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (participant_id, participant_name, participant_age, familiarity, wears_specks, json.dumps(layouts, ensure_ascii=False), now))
    sid = cur.lastrowid
    conn.commit()
    conn.close()
    return jsonify({
        "session_id": sid,
        "participant_id": participant_id,
        "participant_name": participant_name,
        "participant_age": participant_age,
        "familiarity": familiarity,
        "wears_specks": wears_specks,
        "layouts": layouts
    })

@app.post("/events/bulk")
def events_bulk():
    data = request.get_json(force=True)
    rows = data.get("events", [])
    if not rows:
        return jsonify({"ok": True, "count": 0})
    conn = db(); cur = conn.cursor()
    cur.executemany("""
        INSERT INTO events (session_id, participant_id, layout_id, round_id, ts_ms, event_type, x, y, key, is_delete)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        (r.get("session_id"), r.get("participant_id"), r.get("layout_id"), r.get("round_id"),
         r.get("ts_ms"), r.get("event_type"), r.get("x"), r.get("y"), r.get("key"), 1 if r.get("is_delete") else 0)
        for r in rows
    ])
    conn.commit(); conn.close()
    return jsonify({"ok": True, "count": len(rows)})

@app.post("/trial/submit")
def trial_submit():
    d = request.get_json(force=True)
    session_id = d["session_id"]
    participant_id = d["participant_id"]
    layout_id = d["layout_id"]
    round_id = d["round_id"]
    prompt_id = d.get("prompt_id","")
    intended_text = d.get("intended_text","")
    transcribed_text = d.get("transcribed_text","")
    dwell_main_ms = int(d.get("dwell_main_ms", 600))
    dwell_popup_ms = int(d.get("dwell_popup_ms", 450))
    duration_ms = int(d.get("duration_ms", 0))
    total_keystrokes = int(d.get("total_keystrokes", 0))
    deletes = int(d.get("deletes", 0))
    eye_distance_px = float(d.get("eye_distance_px", 0.0))

    def char_count(s):
        return len(s)
    chars = char_count(transcribed_text)
    t_min = max(0.0001, duration_ms / 60000.0)
    gross_wpm = (chars / 5.0) / t_min

    def lev(a, b):
        m, n = len(a), len(b)
        dp = list(range(n+1))
        for i in range(1, m+1):
            prev, dp[0] = dp[0], i
            for j in range(1, n+1):
                tmp = dp[j]
                cost = 0 if a[i-1] == b[j-1] else 1
                dp[j] = min(dp[j]+1, dp[j-1]+1, prev+cost)
                prev = tmp
        return dp[n]

    INF = lev(transcribed_text, intended_text)
    net_wpm = ((chars - INF) / 5.0) / t_min
    accuracy_pct = 100.0 * (max(0, chars - INF) / max(1, chars))
    kspc = (total_keystrokes / max(1, chars))

    now = int(time.time()*1000)
    conn = db(); cur = conn.cursor()
    cur.execute("""
        INSERT INTO trials (session_id, participant_id, layout_id, round_id, prompt_id, intended_text, transcribed_text,
                            dwell_main_ms, dwell_popup_ms, duration_ms, total_keystrokes, deletes, eye_distance_px,
                            gross_wpm, net_wpm, accuracy_pct, kspc, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (session_id, participant_id, layout_id, round_id, prompt_id, intended_text, transcribed_text,
          dwell_main_ms, dwell_popup_ms, duration_ms, total_keystrokes, deletes, eye_distance_px,
          gross_wpm, net_wpm, accuracy_pct, kspc, now))
    conn.commit(); conn.close()

    return jsonify({
        "ok": True,
        "metrics": {
            "gross_wpm": gross_wpm, "net_wpm": net_wpm,
            "accuracy_pct": accuracy_pct, "kspc": kspc
        }
    })

@app.post("/sus/submit")
def sus_submit():
    d = request.get_json(force=True)
    session_id = d["session_id"]
    participant_id = d["participant_id"]
    layout_id = d["layout_id"]
    items = d.get("items", [])

    if len(items) != 10:
        return jsonify({"ok": False, "error": "SUS needs 10 items."}), 400

    score = 0
    for i, v in enumerate(items):
        if (i % 2) == 0:
            score += (v - 1)
        else:
            score += (5 - v)
    sus_score = score * 2.5

    now = int(time.time()*1000)
    conn = db(); cur = conn.cursor()
    cur.execute("""
        INSERT INTO sus (session_id, participant_id, layout_id, items_json, sus_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (session_id, participant_id, layout_id, json.dumps(items, ensure_ascii=False), sus_score, now))
    conn.commit(); conn.close()

    return jsonify({"ok": True, "sus_score": sus_score})

@app.post("/feedback/submit")
def feedback_submit():
    d = request.get_json(force=True)
    session_id = d.get("session_id")
    participant_id = d.get("participant_id")
    feedback_text = d.get("feedback", "")

    now = int(time.time()*1000)
    conn = db(); cur = conn.cursor()
    cur.execute("""
        INSERT INTO feedbacks (session_id, participant_id, feedback, created_at)
        VALUES (?, ?, ?, ?)
    """, (session_id, participant_id, feedback_text, now))
    conn.commit()

    # Build a full JSON export for the session (Sinhala-safe)
    export = {}

    # session
    cur.execute("SELECT * FROM sessions WHERE id=?", (session_id,))
    row = cur.fetchone()
    export["session"] = dict(row) if row else {}

    # trials
    cur.execute("SELECT * FROM trials WHERE session_id=?", (session_id,))
    export["trials"] = [dict(r) for r in cur.fetchall()]

    # sus
    cur.execute("SELECT * FROM sus WHERE session_id=?", (session_id,))
    export["sus"] = [dict(r) for r in cur.fetchall()]

    # events
    cur.execute("SELECT * FROM events WHERE session_id=?", (session_id,))
    export["events"] = [dict(r) for r in cur.fetchall()]

    # feedbacks
    cur.execute("SELECT * FROM feedbacks WHERE session_id=?", (session_id,))
    export["feedbacks"] = [dict(r) for r in cur.fetchall()]

    json_path = os.path.join(DATA_DIR, f"session_{session_id}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(export, f, ensure_ascii=False, indent=2)

    conn.close()
    return jsonify({"ok": True, "path": json_path})

if __name__ == "__main__":
    # Flask dev server
    app.run(host="0.0.0.0", port=5000, debug=True)
