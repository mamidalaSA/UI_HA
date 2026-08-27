from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.doctors.router import router as doctors_router
from app.modules.labs.router import router as labs_router
from app.modules.nurses.router import router as nurses_router
from app.modules.patient_app.router import router as patient_app_router
from app.modules.patients.router import router as patients_router
from app.modules.pharmacy.router import router as pharmacy_router
from app.modules.transfers.router import router as transfers_router

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Hospital Management System API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "environment": settings.environment}


app.include_router(auth_router)
app.include_router(patients_router)
app.include_router(doctors_router)
app.include_router(nurses_router)
app.include_router(labs_router)
app.include_router(pharmacy_router)
app.include_router(transfers_router)
app.include_router(admin_router)
app.include_router(patient_app_router)
