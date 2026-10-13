import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_health_check_returns_ok():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "Trazos Librería"
    assert "timestamp_utc" in data
    assert "timestamp_local" in data
    assert data["timezone"] == "America/Argentina/Tucuman"
    assert "turso_configured" in data
