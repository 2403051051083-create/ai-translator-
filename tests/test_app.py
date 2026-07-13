import pytest

from app import create_app


@pytest.fixture()
def client():
    app = create_app(testing=True)
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_login_page_renders(client):
    response = client.get('/login')
    assert response.status_code == 200
    assert b'Admin Login' in response.data


def test_dashboard_requires_login(client):
    response = client.get('/dashboard', follow_redirects=False)
    assert response.status_code == 302
    assert response.headers['Location'].endswith('/login')


def test_translate_endpoint_with_valid_csrf(client):
    response = client.get('/login')
    assert response.status_code == 200

    with client.session_transaction() as sess:
        csrf_token = sess.get('_csrf_token')

    assert csrf_token is not None

    login_response = client.post(
        '/login',
        data={
            'username': 'admin',
            'password': 'Admin@123',
            'csrf_token': csrf_token,
        },
        follow_redirects=True,
    )
    assert login_response.status_code == 200
    assert b'Welcome back' in login_response.data

    translate_response = client.post(
        '/translate',
        data={
            'source_text': 'Hello',
            'source_lang': 'en',
            'target_lang': 'en',
            'csrf_token': csrf_token,
        },
    )
    assert translate_response.status_code == 200
    assert translate_response.is_json
    assert translate_response.json['translated_text'] == 'Hello'


def test_history_and_item_operations(client):
    client.get('/login')
    with client.session_transaction() as sess:
        csrf_token = sess.get('_csrf_token')

    client.post(
        '/login',
        data={
            'username': 'admin',
            'password': 'Admin@123',
            'csrf_token': csrf_token,
        },
        follow_redirects=True,
    )

    # Perform a translation to create a history item
    translate_response = client.post(
        '/translate',
        data={
            'source_text': 'Namaste',
            'source_lang': 'hi',
            'target_lang': 'en',
            'csrf_token': csrf_token,
        },
    )
    assert translate_response.status_code == 200
    item_id = translate_response.json['id']

    # Test toggling star
    star_response = client.post(
        '/toggle_star',
        data={
            'id': item_id,
            'csrf_token': csrf_token,
        },
    )
    assert star_response.status_code == 200
    assert star_response.json['starred'] == 1

    # Test toggling star back
    unstar_response = client.post(
        '/toggle_star',
        data={
            'id': item_id,
            'csrf_token': csrf_token,
        },
    )
    assert unstar_response.status_code == 200
    assert unstar_response.json['starred'] == 0

    # Test history endpoint
    history_response = client.get('/history')
    assert history_response.status_code == 200
    history_items = history_response.json
    assert len(history_items) > 0
    assert history_items[0]['id'] == item_id

    # Test deleting history item
    delete_response = client.post(
        '/delete_translation',
        data={
            'id': item_id,
            'csrf_token': csrf_token,
        },
    )
    assert delete_response.status_code == 200
    assert delete_response.json['success'] is True

    # Test clear history endpoint
    clear_response = client.post(
        '/clear_history',
        data={
            'csrf_token': csrf_token,
        },
    )
    assert clear_response.status_code == 200
    assert clear_response.json['success'] is True

    # Verify history is empty
    history_response_empty = client.get('/history')
    assert len(history_response_empty.json) == 0


def test_translate_endpoint_with_tone(client):
    client.get('/login')
    with client.session_transaction() as sess:
        csrf_token = sess.get('_csrf_token')

    client.post(
        '/login',
        data={
            'username': 'admin',
            'password': 'Admin@123',
            'csrf_token': csrf_token,
        },
        follow_redirects=True,
    )

    # Test formal tone translation
    translate_response = client.post(
        '/translate',
        data={
            'source_text': 'Hello friend',
            'source_lang': 'en',
            'target_lang': 'hi',
            'tone': 'formal',
            'csrf_token': csrf_token,
        },
    )
    assert translate_response.status_code == 200
    assert translate_response.is_json
    assert 'translated_text' in translate_response.json

    # Test informal tone translation
    translate_response_inf = client.post(
        '/translate',
        data={
            'source_text': 'Hello friend',
            'source_lang': 'en',
            'target_lang': 'hi',
            'tone': 'informal',
            'csrf_token': csrf_token,
        },
    )
    assert translate_response_inf.status_code == 200
    assert translate_response_inf.is_json
    assert 'translated_text' in translate_response_inf.json
