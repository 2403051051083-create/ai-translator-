# AI Language Translator

A polished Flask-based language translator with authentication, translation history, and a modern UI.

## Features
- Login system with admin credentials
- Translation between many languages
- Translation history and dashboard metrics
- Copy, clear, and text-to-speech actions
- Light/dark mode toggle
- SQLite-backed persistence

## Setup
1. Create and activate a virtual environment.
2. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file and add your API key if you want to connect to a real translation provider.
4. Run the app:
   ```bash
   python app.py
   ```
5. Open http://127.0.0.1:5000/login

## Default login
- Username: `admin`
- Password: `Admin@123`
