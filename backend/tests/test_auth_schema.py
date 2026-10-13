import base64

import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterRequest


def test_registration_accepts_valid_png_logo():
    one_pixel_png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/wZ8AAAAASUVORK5CYII="
    )
    logo = f"data:image/png;base64,{base64.b64encode(one_pixel_png).decode('ascii')}"

    request = RegisterRequest(
        business_name="Comercio de prueba",
        full_name="Persona de prueba",
        email="persona@example.com",
        password="PasswordSeguro123",
        business_logo_data_url=logo,
    )

    assert request.business_logo_data_url == logo


@pytest.mark.parametrize(
    "logo",
    [
        "data:image/svg+xml;base64,PHN2Zz4=",
        "data:image/png;base64,PGh0bWw+",
    ],
    ids=["svg", "mismatched-content"],
)
def test_registration_rejects_invalid_logo(logo):
    with pytest.raises(ValidationError):
        RegisterRequest(
            business_name="Comercio de prueba",
            full_name="Persona de prueba",
            email="persona@example.com",
            password="PasswordSeguro123",
            business_logo_data_url=logo,
        )


def test_registration_rejects_logo_over_size_limit():
    oversized_logo = f"data:image/png;base64,{base64.b64encode(b'0' * (512 * 1024 + 1)).decode('ascii')}"

    with pytest.raises(ValidationError):
        RegisterRequest(
            business_name="Comercio de prueba",
            full_name="Persona de prueba",
            email="persona@example.com",
            password="PasswordSeguro123",
            business_logo_data_url=oversized_logo,
        )
