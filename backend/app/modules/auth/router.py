from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth import service
from app.modules.auth.schemas import (
    LoginRequest,
    OtpSendRequest,
    OtpVerifyRequest,
    OtpVerifyResponse,
    TokenResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    try:
        token, user = service.login(db, email=payload.email, password=payload.password)
    except service.AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
    return TokenResponse(access_token=token, role=user.role, user_id=user.id, full_name=user.full_name)


@router.post("/otp/send")
def send_otp(payload: OtpSendRequest, db: Session = Depends(get_db)):
    service.send_otp(db, mobile=payload.mobile, purpose=payload.purpose)
    return {"sent": True}


@router.post("/otp/verify", response_model=OtpVerifyResponse)
def verify_otp(payload: OtpVerifyRequest, db: Session = Depends(get_db)):
    ok = service.verify_otp(db, mobile=payload.mobile, code=payload.code, purpose=payload.purpose)
    return OtpVerifyResponse(verified=ok)
