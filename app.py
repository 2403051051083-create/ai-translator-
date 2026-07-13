import os
import sqlite3
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

import requests
from dotenv import load_dotenv
from flask import Flask, flash, g, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv(Path(__file__).with_name('.env'))

DATABASE = Path(__file__).with_name('translations.db')


def get_db():
    if 'db' not in g:
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        g.db = conn
    return g.db


def close_db(exc=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.execute(
        '''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
        '''
    )
    db.execute(
        '''
        CREATE TABLE IF NOT EXISTS translations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            source_language TEXT NOT NULL,
            target_language TEXT NOT NULL,
            source_text TEXT NOT NULL,
            translated_text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            starred INTEGER DEFAULT 0
        )
        '''
    )
    db.commit()


def generate_csrf_token():
    token = session.get('_csrf_token')
    if not token:
        token = os.urandom(24).hex()
        session['_csrf_token'] = token
    return token


LANGUAGES = {
    'auto': 'Auto Detect',
    'en': 'English',
    'hi': 'Hindi',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ar': 'Arabic',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'as': 'Assamese',
    'bn': 'Bengali',
    'brx': 'Bodo',
    'doi': 'Dogri',
    'gu': 'Gujarati',
    'kn': 'Kannada',
    'ks': 'Kashmiri',
    'gom': 'Konkani',
    'mai': 'Maithili',
    'ml': 'Malayalam',
    'mni': 'Manipuri',
    'mr': 'Marathi',
    'ne': 'Nepali',
    'or': 'Odia',
    'pa': 'Punjabi',
    'sa': 'Sanskrit',
    'sat': 'Santali',
    'sd': 'Sindhi',
    'ta': 'Tamil',
    'te': 'Telugu',
    'ur': 'Urdu',
    'bho': 'Bhojpuri'
}


def translate_text(text, source_lang, target_lang, tone='auto'):
    if source_lang == target_lang:
        return text

    source_name = LANGUAGES.get(source_lang, source_lang)
    target_name = LANGUAGES.get(target_lang, target_lang)

    extra_instructions = []

    # Dialect and script guidelines for Bhojpuri
    if target_lang == 'bho':
        extra_instructions.append(
            "The target language is Bhojpuri. Translate the text into authentic, natural, and colloquial Bhojpuri "
            "using the Devanagari script. Ensure correct grammatical markers (e.g., use 'बा', 'बानी', 'बाड़े', 'बाटी' for 'है/हैं/हूँ', "
            "and pronouns like 'रउआ' for formal/respectful you, 'तूं' for informal, and 'हमार/तोहार' for possessive). "
            "Avoid literal translations from Hindi; use native Bhojpuri words (e.g. use 'नेवता' instead of 'निमंत्रण', 'लइका/बबुआ' instead of 'बच्चा', 'भोर' instead of 'सुबह', 'खीस' instead of 'क्रोध')."
        )
    elif source_lang == 'bho':
        extra_instructions.append(
            "The source language is Bhojpuri. Note that it might be written in either the Devanagari script or Romanized script "
            "(transliterated using Latin characters like 'ka hal ba', 'ka karat bani'). Understand the colloquial meaning "
            "of the source text and translate it accurately into the target language."
        )

    # Tone/Honorific guidelines
    if tone == 'formal':
        if target_lang in ['hi', 'bho']:
            extra_instructions.append(
                "Use a formal, polite, and respectful tone (आदरसूचक शैली). "
                f"In {target_name}, use respectful pronouns (like 'आप' in Hindi or 'रउआ' in Bhojpuri) "
                "with matching respectful verb conjugations (e.g., 'करत बानी', 'आइल बानी', 'कीजिए', 'कर रहे हैं')."
            )
        else:
            extra_instructions.append("Use a formal, professional, and polite tone for the translation.")
    elif tone == 'informal':
        if target_lang in ['hi', 'bho']:
            extra_instructions.append(
                "Use an informal, friendly, close, and colloquial tone (अनौपचारिक/घनिष्ठ शैली). "
                f"In {target_name}, use informal pronouns (like 'तुम/तू' in Hindi or 'तूं/तें' in Bhojpuri) "
                "with corresponding informal verb conjugations (e.g., 'करत बाड़अ', 'करत हउअ', 'करो', 'कर रहे हो')."
            )
        else:
            extra_instructions.append("Use an informal, friendly, and conversational tone for the translation.")

    instructions_str = "\n".join(f"- {inst}" for inst in extra_instructions) if extra_instructions else ""

    prompt_text = (
        f"You are an expert, professional translator.\n"
        f"Translate the following text from {source_name if source_lang != 'auto' else 'the detected source language'} to {target_name}.\n"
    )
    if instructions_str:
        prompt_text += f"\nAdditional translation guidelines:\n{instructions_str}\n"

    prompt_text += (
        f"\nReturn ONLY the translated text. Do NOT wrap the translation in quotes, backticks, or markdown code blocks. "
        f"Do NOT include any notes, explanations, warnings, commentary, or alternate choices. Just output the translation itself.\n\n"
        f"Text to translate:\n{text}"
    )

    groq_api_key = os.getenv('GROQ_API_KEY', '').strip()
    gemini_api_key = os.getenv('GEMINI_API_KEY', '').strip()

    if groq_api_key:
        # Use Groq OpenAI-compatible Chat Completions API
        url = 'https://api.groq.com/openai/v1/chat/completions'
        payload = {
            'model': 'llama-3.3-70b-versatile',
            'messages': [
                {
                    'role': 'system',
                    'content': 'You are a professional, accurate translator. You only output the translation text itself, without any introductory phrases, notes, explanations, or commentary.'
                },
                {
                    'role': 'user',
                    'content': prompt_text
                }
            ],
            'temperature': 0.2
        }
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {groq_api_key}',
        }
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=25)
            response.raise_for_status()
            data = response.json()
            if 'choices' in data and len(data['choices']) > 0:
                content = data['choices'][0]['message']['content']
                return content.strip()
        except Exception as error:
            print('Groq API request failed:', error)

    elif gemini_api_key:
        # Use Gemini Developer API
        url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_api_key}'
        payload = {
            'contents': [
                {
                    'parts': [
                        {
                            'text': prompt_text
                        }
                    ]
                }
            ],
            'generationConfig': {
                'temperature': 0.2,
                'maxOutputTokens': 512
            }
        }
        headers = {
            'Content-Type': 'application/json',
        }
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=25)
            response.raise_for_status()
            data = response.json()
            if 'candidates' in data and len(data['candidates']) > 0:
                parts = data['candidates'][0]['content']['parts']
                if len(parts) > 0 and 'text' in parts[0]:
                    return parts[0]['text'].strip()
        except Exception as error:
            print('Gemini API request failed:', error)

    return f"[{target_lang.upper()}] {text}"


def create_app(testing=False):
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
    app.config['TESTING'] = testing
    app.teardown_appcontext(close_db)

    @app.before_request
    def setup_db():
        if not DATABASE.exists():
            init_db()
        else:
            # Migration check: make sure 'starred' column exists in translations table
            db = get_db()
            try:
                db.execute('SELECT starred FROM translations LIMIT 1')
            except sqlite3.OperationalError:
                db.execute('ALTER TABLE translations ADD COLUMN starred INTEGER DEFAULT 0')
                db.commit()

    @app.context_processor
    def inject_csrf_token():
        return {'csrf_token': generate_csrf_token()}

    def login_required(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if 'user' not in session:
                return redirect(url_for('login'))
            return view(*args, **kwargs)

        return wrapped

    @app.route('/')
    @login_required
    def index():
        return redirect(url_for('dashboard'))

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if request.method == 'POST':
            if request.form.get('csrf_token') != session.get('_csrf_token'):
                flash('Invalid request.', 'error')
                return render_template('login.html')
            username = request.form.get('username', '').strip()
            password = request.form.get('password', '')
            if not username or not password:
                flash('Please enter both username and password.', 'error')
                return render_template('login.html')
            if len(username) > 50 or len(password) > 100:
                flash('Input length is too long.', 'error')
                return render_template('login.html')

            db = get_db()
            user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
            if user is None:
                # Seed admin user if missing
                if username == 'admin' and password == 'Admin@123':
                    db.execute(
                        'INSERT INTO users (username, password) VALUES (?, ?)',
                        (username, generate_password_hash(password)),
                    )
                    db.commit()
                    session['user'] = username
                    flash('Admin account created and logged in.', 'success')
                    return redirect(url_for('dashboard'))
                flash('Invalid credentials.', 'error')
                return render_template('login.html')

            if not check_password_hash(user['password'], password):
                flash('Invalid credentials.', 'error')
                return render_template('login.html')

            session['user'] = username
            flash('Logged in successfully.', 'success')
            return redirect(url_for('dashboard'))

        return render_template('login.html')

    @app.route('/logout')
    def logout():
        session.pop('user', None)
        flash('You have been logged out.', 'success')
        return redirect(url_for('login'))

    @app.route('/dashboard')
    @login_required
    def dashboard():
        db = get_db()
        history = db.execute(
            'SELECT * FROM translations WHERE username = ? ORDER BY id DESC LIMIT 5',
            (session['user'],),
        ).fetchall()
        count = db.execute(
            'SELECT COUNT(*) AS total FROM translations WHERE username = ?',
            (session['user'],),
        ).fetchone()['total']
        return render_template('index.html', history=history, total_translations=count)

    @app.route('/translate', methods=['POST'])
    @login_required
    def translate():
        if request.form.get('csrf_token') != session.get('_csrf_token'):
            return jsonify({'error': 'Invalid request.'}), 400

        source_text = request.form.get('source_text', '').strip()
        source_lang = request.form.get('source_lang', 'auto')
        target_lang = request.form.get('target_lang', 'en')
        tone = request.form.get('tone', 'auto')

        if not source_text:
            return jsonify({'error': 'Please enter text to translate.'}), 400
        if len(source_text) > 1000:
            return jsonify({'error': 'Text must be 1000 characters or fewer.'}), 400
        if not target_lang:
            return jsonify({'error': 'Please select a target language.'}), 400

        translated_text = translate_text(source_text, source_lang, target_lang, tone=tone)
        db = get_db()
        db.execute(
            '''
            INSERT INTO translations (username, source_language, target_language, source_text, translated_text, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ''',
            (session['user'], source_lang, target_lang, source_text, translated_text, datetime.now(timezone.utc).isoformat()),
        )
        db.commit()

        # Fetch the newly inserted translation's ID to return to the UI
        new_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

        return jsonify({
            'id': new_id,
            'translated_text': translated_text,
            'source_language': source_lang,
            'target_language': target_lang,
            'starred': 0
        })

    @app.route('/toggle_star', methods=['POST'])
    @login_required
    def toggle_star():
        if request.form.get('csrf_token') != session.get('_csrf_token'):
            return jsonify({'error': 'Invalid request.'}), 400

        translation_id = request.form.get('id')
        if not translation_id:
            return jsonify({'error': 'Missing translation ID.'}), 400

        db = get_db()
        row = db.execute(
            'SELECT starred FROM translations WHERE id = ? AND username = ?',
            (translation_id, session['user'])
        ).fetchone()

        if not row:
            return jsonify({'error': 'Translation not found.'}), 404

        new_starred = 1 if row['starred'] == 0 else 0
        db.execute(
            'UPDATE translations SET starred = ? WHERE id = ? AND username = ?',
            (new_starred, translation_id, session['user'])
        )
        db.commit()

        return jsonify({'success': True, 'starred': new_starred})

    @app.route('/delete_translation', methods=['POST'])
    @login_required
    def delete_translation():
        if request.form.get('csrf_token') != session.get('_csrf_token'):
            return jsonify({'error': 'Invalid request.'}), 400

        translation_id = request.form.get('id')
        if not translation_id:
            return jsonify({'error': 'Missing translation ID.'}), 400

        db = get_db()
        db.execute(
            'DELETE FROM translations WHERE id = ? AND username = ?',
            (translation_id, session['user'])
        )
        db.commit()

        count = db.execute(
            'SELECT COUNT(*) AS total FROM translations WHERE username = ?',
            (session['user'],),
        ).fetchone()['total']

        return jsonify({'success': True, 'total_translations': count})

    @app.route('/clear_history', methods=['POST'])
    @login_required
    def clear_history():
        if request.form.get('csrf_token') != session.get('_csrf_token'):
            return jsonify({'error': 'Invalid request.'}), 400

        db = get_db()
        db.execute('DELETE FROM translations WHERE username = ?', (session['user'],))
        db.commit()

        return jsonify({'success': True})

    @app.route('/history')
    @login_required
    def history():
        db = get_db()
        rows = db.execute(
            'SELECT * FROM translations WHERE username = ? ORDER BY id DESC',
            (session['user'],),
        ).fetchall()
        return jsonify([dict(row) for row in rows])

    @app.errorhandler(404)
    def not_found(error):
        return render_template('404.html'), 404

    @app.errorhandler(500)
    def server_error(error):
        return render_template('500.html'), 500

    return app


app = create_app()


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
