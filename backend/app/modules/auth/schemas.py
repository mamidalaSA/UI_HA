import uuid

from pydantic import BaseModel, EmailStr

from app.core.roles import Role


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
    user_id: uuid.UUID
    full_name: str


class OtpSendRequest(BaseModel):
    mobile: str
    purpose: str = "verify_mobile"


class OtpVerifyRequest(BaseModel):
    mobile: str
    code: str
    purpose: str = "verify_mobile"


class OtpVerifyResponse(BaseModel):
    verified: bool
