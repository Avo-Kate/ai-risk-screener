"""Authentication: verify Supabase-issued JWTs and resolve the current user.

Supabase (GoTrue) owns credentials and token issuance. This module only VERIFIES
the access token with the PyJWT library — no password hashing or hand-rolled
crypto. Two verification methods are supported (see config.py):

  * Asymmetric (SUPABASE_URL set): fetch the project's public keys from its JWKS
    endpoint and verify the ES256/RS256 signature. This is the default for
    current Supabase projects and needs no secret.
  * Symmetric (SUPABASE_JWT_SECRET set): verify an HS256 signature with the
    shared legacy secret. Takes precedence if both are configured.

On a valid token we mirror the identity into the local `users` table (upsert by
Supabase user id) so assessments can hold a foreign key to a user we own.

Use `Depends(get_current_user)` on any route that must be authenticated.
"""

import uuid
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError, PyJWTError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import config
from .database import get_db
from .models import User

_UNAUTH_HEADERS = {"WWW-Authenticate": "Bearer"}
_ASYMMETRIC_ALGS = ["ES256", "RS256", "EdDSA"]


@lru_cache(maxsize=4)
def _jwks_client(jwks_url: str) -> PyJWKClient:
    """Cached JWKS client (it also caches fetched keys internally)."""
    return PyJWKClient(jwks_url)


def _bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Provide a Bearer access token.",
            headers=_UNAUTH_HEADERS,
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=401,
            detail="Malformed Authorization header. Expected 'Bearer <token>'.",
            headers=_UNAUTH_HEADERS,
        )
    return token.strip()


def _decode(token: str) -> dict:
    """Verify + decode the token. Strategy is chosen by configuration, not by the
    token's own `alg` header, which avoids algorithm-confusion attacks."""
    aud = config.SUPABASE_JWT_AUD

    secret = config.get_jwt_secret()
    if secret:
        return jwt.decode(token, secret, algorithms=["HS256"], audience=aud)

    if config.SUPABASE_URL:
        jwks_url = f"{config.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        signing_key = _jwks_client(jwks_url).get_signing_key_from_jwt(token)
        return jwt.decode(
            token, signing_key.key, algorithms=_ASYMMETRIC_ALGS, audience=aud
        )

    # Neither method configured — server misconfiguration, not the caller's fault.
    raise HTTPException(
        status_code=503,
        detail=(
            "Authentication is not configured on the server. Set SUPABASE_URL "
            "(recommended) or SUPABASE_JWT_SECRET in backend/.env."
        ),
    )


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user from the Supabase JWT, or raise.

    - 503 if the server is not configured to verify tokens.
    - 401 if the token is absent, malformed, invalid, or expired.
    """
    token = _bearer_token(authorization)
    try:
        payload = _decode(token)
    except HTTPException:
        raise  # 503 from _decode passes through unchanged
    except (PyJWTError, PyJWKClientError) as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token.",
            headers=_UNAUTH_HEADERS,
        ) from e

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=401,
            detail="Token is missing the subject (sub) claim.",
            headers=_UNAUTH_HEADERS,
        )
    try:
        user_id = uuid.UUID(str(sub))
    except ValueError as e:
        raise HTTPException(
            status_code=401,
            detail="Token subject is not a valid user id.",
            headers=_UNAUTH_HEADERS,
        ) from e

    email = payload.get("email") or ""
    return _upsert_user(db, user_id, email)


def _upsert_user(db: Session, user_id: uuid.UUID, email: str) -> User:
    """Get the user, creating it on first sight and refreshing a changed email."""
    user = db.get(User, user_id)
    if user is None:
        user = User(id=user_id, email=email)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # Concurrent first request from the same user inserted it first.
            db.rollback()
            user = db.get(User, user_id)
        else:
            db.refresh(user)
            return user

    if user is not None and email and user.email != email:
        user.email = email
        db.commit()
    return user
