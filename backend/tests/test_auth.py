import pytest
import uuid
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.database import create_db_client
from app.core import security
from app.services import auth_service

@pytest.mark.asyncio
async def test_argon2id_hashing_and_verification():
    raw_password = "SuperPassword2026!"
    hashed = security.hash_password(raw_password)
    assert hashed != raw_password
    assert hashed.startswith("$argon2id$")
    assert security.verify_password(raw_password, hashed) is True
    assert security.verify_password("WrongPassword", hashed) is False

@pytest.mark.asyncio
async def test_auth_full_lifecycle():
    client_db = create_db_client()
    unique_suffix = str(uuid.uuid4())[:8]
    test_email = f"propietario_{unique_suffix}@example.com"
    test_password = "PasswordSeguro2026*"
    test_name = "Doña Clara Test"

    try:
        # 1. Crear usuario de prueba
        user = await auth_service.create_initial_admin(
            client=client_db,
            email=test_email,
            password=test_password,
            full_name=test_name
        )
        assert user["email"] == test_email.lower()
        assert user["full_name"] == test_name

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 2. Intento de acceso a ruta protegida sin sesión -> 401
            me_unauth = await client.get("/api/auth/me")
            assert me_unauth.status_code == 401

            # 3. Intento de login con clave incorrecta -> 401
            bad_login = await client.post("/api/auth/login", json={
                "email": test_email,
                "password": "ClaveIncorrecta"
            })
            assert bad_login.status_code == 401
            assert "Credenciales inválidas" in bad_login.json()["detail"]

            # 4. Login con credenciales correctas -> 200 y Cookie HttpOnly
            good_login = await client.post("/api/auth/login", json={
                "email": test_email,
                "password": test_password
            })
            assert good_login.status_code == 200
            login_data = good_login.json()
            assert login_data["email"] == test_email.lower()
            assert "merceria_session" in good_login.cookies

            session_cookie = good_login.cookies["merceria_session"]
            assert session_cookie

            # 5. Acceso a /api/auth/me con la cookie recibida -> 200
            client.cookies.set("merceria_session", session_cookie)
            me_resp = await client.get("/api/auth/me")
            assert me_resp.status_code == 200
            assert me_resp.json()["email"] == test_email.lower()

            # 6. Logout -> 200 y sesión invalidada
            logout_resp = await client.post("/api/auth/logout")
            assert logout_resp.status_code == 200
            
            # 7. Intentar acceder a /api/auth/me con el token viejo -> 401
            # (Aunque el cliente mande la cookie que tenía antes de borrarla)
            me_after_logout = await client.get(
                "/api/auth/me",
                cookies={"merceria_session": session_cookie}
            )
            assert me_after_logout.status_code == 401

    finally:
        # Limpieza de usuario de prueba y sus relaciones en Turso
        await client_db.execute("DELETE FROM users WHERE email = ?", [test_email.lower()])
        await client_db.close()

@pytest.mark.asyncio
async def test_brute_force_lockout_after_five_failed_attempts():
    client_db = create_db_client()
    unique_suffix = str(uuid.uuid4())[:8]
    test_email = f"lockout_{unique_suffix}@example.com"
    test_password = "PasswordValido123"

    try:
        await auth_service.create_initial_admin(
            client=client_db,
            email=test_email,
            password=test_password,
            full_name="Usuario Bloqueo"
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 4 intentos fallidos -> 401
            for i in range(4):
                res = await client.post("/api/auth/login", json={
                    "email": test_email,
                    "password": f"incorrecta_{i}"
                })
                assert res.status_code == 401

            # 5to intento fallido -> 429 Bloqueo temporal
            res_fifth = await client.post("/api/auth/login", json={
                "email": test_email,
                "password": "incorrecta_5"
            })
            assert res_fifth.status_code == 429
            assert "bloqueada" in res_fifth.json()["detail"].lower()

            # Incluso enviando la contraseña correcta ahora, debe seguir bloqueado
            res_locked = await client.post("/api/auth/login", json={
                "email": test_email,
                "password": test_password
            })
            assert res_locked.status_code == 429

    finally:
        await client_db.execute("DELETE FROM users WHERE email = ?", [test_email.lower()])
        await client_db.close()

@pytest.mark.asyncio
async def test_password_reset_flow():
    client_db = create_db_client()
    unique_suffix = str(uuid.uuid4())[:8]
    test_email = f"reset_{unique_suffix}@example.com"
    test_password = "PasswordOriginal123"
    new_password = "NuevoPassword2026!"

    try:
        await auth_service.create_initial_admin(
            client=client_db,
            email=test_email,
            password=test_password,
            full_name="Usuario Reset"
        )

        # 1. Solicitar restablecimiento mediante el servicio para obtener el raw_token
        success, raw_token = await auth_service.request_password_reset(client_db, test_email)
        assert success is True
        assert raw_token is not None

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 2. Resetear contraseña con el token
            reset_resp = await client.post("/api/auth/reset-password", json={
                "token": raw_token,
                "new_password": new_password
            })
            assert reset_resp.status_code == 200

            # 3. Intentar reusar el mismo token -> 400
            reuse_resp = await client.post("/api/auth/reset-password", json={
                "token": raw_token,
                "new_password": "OtroPassword123"
            })
            assert reuse_resp.status_code == 400

            # 4. Probar login con la contraseña nueva -> 200
            login_new = await client.post("/api/auth/login", json={
                "email": test_email,
                "password": new_password
            })
            assert login_new.status_code == 200

    finally:
        await client_db.execute("DELETE FROM users WHERE email = ?", [test_email.lower()])
        await client_db.close()
