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

    # SESSIONS TABLE
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id TEXT,
            participant_name TEXT,
            participant_age TEXT,
            sinhala_usage TEXT,
            layouts_json TEXT,
            created_at INTEGER
        )
    """)
    # Ensure new columns exist for older databases
    ensure_column(conn, "sessions", "sinhala_usage", "TEXT")

    # TRIALS TABLE
    cur.execute("""
        CREATE TABLE IF NOT EXISTS trials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            participant_id TEXT,
            layout_id TEXT,
            keyboard_size TEXT,
            round_id TEXT,
            prompt_id TEXT,
            prompt TEXT,
            intended_text TEXT,
            transcribed_text TEXT,
            dwell_main_ms INTEGER,
            dwell_popup_ms INTEGER,
            duration_ms INTEGER,
            total_keystrokes INTEGER,
            deletes INTEGER,
            eye_distance_px REAL,
            word_count INTEGER,
            vowel_popup_clicks INTEGER,
            vowel_popup_more_clicks INTEGER,
            vowel_popup_close_clicks INTEGER,
            gross_wpm REAL,
            net_wpm REAL,
            accuracy_pct REAL,
            kspc REAL,
            created_at INTEGER
        )
    """)

    ensure_column(conn, "trials", "keyboard_size", "TEXT")
    ensure_column(conn, "trials", "vowel_popup_close_clicks", "INTEGER")

    # EVENTS TABLE
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

    # SUS TABLE
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

    # FEEDBACK TABLE
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

# ------------------------------------------------------------
# PROMPTS: ONE UNIFIED POOL
# ------------------------------------------------------------

PROMPT_COUNT = 3   # <---- change this anytime to pick N prompts per session

with open(os.path.join(DATA_DIR, "prompts_sinhala.json"), "r", encoding="utf-8") as f:
    PROMPT_POOL = json.load(f)["prompts"]


@app.get("/prompts")
def get_prompts():
    """Return N randomly-selected Sinhala prompts from a single pool."""
    try:
        selected = random.sample(PROMPT_POOL, min(PROMPT_COUNT, len(PROMPT_POOL)))
        return jsonify({"prompts": selected})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------------------------------------------------
# GAZE & KEYBOARD HELPERS
# ------------------------------------------------------------

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


# ------------------------------------------------------------
# LEVENSHTEIN (MSD) HELPER
# ------------------------------------------------------------
def levenshtein(a: str, b: str) -> int:
    """
    Compute Levenshtein (Minimum String Distance) between two strings.

    This is used for:
      - MSD-based character-level accuracy
      - Net WPM (penalizing errors as wrong characters)
    """
    n, m = len(a), len(b)
    if n > m:
        a, b = b, a
        n, m = m, n

    current = list(range(n + 1))
    for i in range(1, m + 1):
        previous, current = current, [i] + [0] * n
        for j in range(1, n + 1):
            add = previous[j] + 1
            delete = current[j - 1] + 1
            change = previous[j - 1] + (a[j - 1] != b[i - 1])
            current[j] = min(add, delete, change)
    return current[n]


# WORD PREDICTION FILES
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
        return jsonify(suggestions[:30])

    key = prev_base + current_cons
    suggestions = vowel_prediction_map.get(key, [])
    return jsonify(suggestions[:30])


# ------------------------------------------------------------
# SESSION START
# ------------------------------------------------------------
@app.post("/session/start")
def session_start():
    data = request.get_json(force=True)

    participant_id = data.get("participant_id")
    participant_name = data.get("participant_name", "")
    participant_age = data.get("participant_age", "")
    sinhala_usage = data.get("sinhala_usage", data.get("familiarity", ""))
    layouts = data.get("layouts", ["eyespeak", "wijesekara", "helakuru"])

    now = int(time.time()*1000)

    conn = db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO sessions (
            participant_id, participant_name, participant_age,
            sinhala_usage, layouts_json, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        participant_id, participant_name, participant_age,
        sinhala_usage, json.dumps(layouts, ensure_ascii=False),
        now
    ))
    sid = cur.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "session_id": sid,
        "participant_id": participant_id,
        "layouts": layouts
    })


# ------------------------------------------------------------
# EVENTS BULK INSERT
# ------------------------------------------------------------
@app.post("/events/bulk")
def events_bulk():
    data = request.get_json(force=True)
    rows = data.get("events", [])
    if not rows:
        return jsonify({"ok": True, "count": 0})

    conn = db()
    cur = conn.cursor()
    cur.executemany("""
        INSERT INTO events (session_id, participant_id, layout_id, round_id,
            ts_ms, event_type, x, y, key, is_delete)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        (r.get("session_id"), r.get("participant_id"), r.get("layout_id"),
         r.get("round_id"), r.get("ts_ms"), r.get("event_type"),
         r.get("x"), r.get("y"), r.get("key"), 1 if r.get("is_delete") else 0)
        for r in rows
    ])
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "count": len(rows)})


# ------------------------------------------------------------
# TRIAL SUBMISSION + METRIC CALCULATIONS
# ------------------------------------------------------------
@app.post("/trial/submit")
def trial_submit():
    d = request.get_json(force=True)

    session_id = d["session_id"]
    participant_id = d["participant_id"]
    layout_id = d["layout_id"]
    keyboard_size = d.get("keyboard_size", "m")
    round_id = d["round_id"]
    prompt_id = d.get("prompt_id", "")
    prompt = d.get("prompt", "")
    intended_text = d.get("intended_text", "")
    transcribed_text = d.get("transcribed_text", "")

    dwell_main_ms = int(d.get("dwell_main_ms", 600))
    dwell_popup_ms = d.get("dwell_popup_ms", 450)
    duration_ms = int(d.get("duration_ms", 0))

    total_keystrokes = int(d.get("total_keystrokes", 0))
    deletes = int(d.get("deletes", 0))
    eye_distance_px = float(d.get("eye_distance_px", 0.0))
    word_count = int(d.get("word_count", 0))
    vowel_popup_clicks = d.get("vowel_popup_clicks", None)
    vowel_popup_more_clicks = d.get("vowel_popup_more_clicks", None)
    vowel_popup_close_clicks = d.get("vowel_popup_close_clicks", None)

    # WIJESAKARA HAS NO POPUP
    if layout_id == "wijesekara":
        dwell_popup_ms = None
        vowel_popup_clicks = None
        vowel_popup_more_clicks = None
        vowel_popup_close_clicks = None

    # ---------------------------
    # TEXT-ENTRY METRICS (STANDARD, MAC-KENZIE STYLE)
    # ---------------------------
    # Time in minutes (avoid division by zero)
    t_min = max(0.0001, duration_ms / 60000.0)

    # Number of characters typed in the transcribed text
    chars_transcribed = len(transcribed_text)

    # MSD (Levenshtein) errors between intended and transcribed text.
    # This counts the minimum number of insertions, deletions, and substitutions
    # needed to transform one string into the other.
    msd_errors = levenshtein(intended_text, transcribed_text)

    # --- Gross WPM ---
    # Standard formula used in text-entry research:
    #   Gross WPM = ((|T| - 1) / 5) / t_min
    # where:
    #   |T|   = number of transcribed characters
    #   5     = standard average characters per word
    #   t_min = time in minutes
    #
    # The "-1" removes the final ENTER or completion keystroke.
    base_chars = max(chars_transcribed - 1, 0)
    gross_wpm = (base_chars / 5.0) / t_min if chars_transcribed > 0 else 0.0

    # --- Accuracy (MSD-based character-level accuracy) ---
    #   Accuracy = (1 - MSD / max(|I|, |T|)) * 100
    # where:
    #   |I|, |T| are lengths of intended and transcribed strings.
    # This measures how many characters are effectively correct.
    max_len = max(len(intended_text), chars_transcribed)
    if max_len > 0:
        accuracy_pct = (1.0 - (msd_errors / max_len)) * 100.0
        # Numerical safety: clamp tiny negatives to 0
        if accuracy_pct < 0.0:
            accuracy_pct = 0.0
    else:
        accuracy_pct = None  # No text to compare

    # --- Net WPM ---
    # One common "net" variant is to treat MSD errors as wrong characters
    # that reduce the effective number of correctly entered characters:
    #
    #   Effective chars = max((|T| - 1) - MSD, 0)
    #   Net WPM = (Effective chars / 5) / t_min
    #
    # This preserves the WPM units while penalizing errors.
    effective_chars = max(base_chars - msd_errors, 0)
    net_wpm = (effective_chars / 5.0) / t_min if chars_transcribed > 0 else 0.0

    # --- KSPC (Keystrokes Per Character) ---
    #   KSPC = Total keystrokes / |T|
    # Here total_keystrokes should include all actions that produce or
    # correct text (including deletes, popup selections, etc.).
    kspc = total_keystrokes / max(1, chars_transcribed)

    now = int(time.time()*1000)

    conn = db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO trials (
            session_id, participant_id, layout_id, keyboard_size, round_id, prompt_id, prompt,
            intended_text, transcribed_text,
            dwell_main_ms, dwell_popup_ms, duration_ms,
            total_keystrokes, deletes, eye_distance_px,
            word_count, vowel_popup_clicks, vowel_popup_more_clicks, vowel_popup_close_clicks,
            gross_wpm, net_wpm, accuracy_pct, kspc, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        session_id, participant_id, layout_id, keyboard_size, round_id, prompt_id, prompt,
        intended_text, transcribed_text,
        dwell_main_ms, dwell_popup_ms, duration_ms,
        total_keystrokes, deletes, eye_distance_px,
        word_count, vowel_popup_clicks, vowel_popup_more_clicks, vowel_popup_close_clicks,
        gross_wpm, net_wpm, accuracy_pct, kspc, now
    ))
    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "metrics": {
            "gross_wpm": gross_wpm,
            "net_wpm": net_wpm,
            "accuracy_pct": accuracy_pct,
            "kspc": kspc
        }
    })


# ------------------------------------------------------------
# SUS SUBMISSION
# ------------------------------------------------------------
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
        if i % 2 == 0:
            score += (v - 1)
        else:
            score += (5 - v)

    sus_score = score * 2.5
    now = int(time.time()*1000)

    conn = db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO sus (session_id, participant_id, layout_id, items_json, sus_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (session_id, participant_id, layout_id, json.dumps(items, ensure_ascii=False),
          sus_score, now))
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "sus_score": sus_score})


# ------------------------------------------------------------
# FEEDBACK + SESSION EXPORT
# ------------------------------------------------------------
@app.post("/feedback/submit")
def feedback_submit():
    d = request.get_json(force=True)
    session_id = d["session_id"]
    participant_id = d["participant_id"]
    feedback_text = d.get("feedback", "")

    now = int(time.time()*1000)

    conn = db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO feedbacks (session_id, participant_id, feedback, created_at)
        VALUES (?, ?, ?, ?)
    """, (session_id, participant_id, feedback_text, now))

    # Export full session
    export = {}

    # session
    cur.execute("SELECT * FROM sessions WHERE id=?", (session_id,))
    export["session"] = dict(cur.fetchone())

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

    conn.commit()
    conn.close()

    return jsonify({"ok": True, "path": json_path})


# ------------------------------------------------------------
# RUN
# ------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
