import uuid
from functools import lru_cache

import boto3
from botocore.client import Config

from app.core.config import settings


@lru_cache
def get_s3_client():
    scheme = "https" if settings.minio_secure else "http"
    return boto3.client(
        "s3",
        endpoint_url=f"{scheme}://{settings.minio_endpoint}",
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def ensure_bucket() -> None:
    client = get_s3_client()
    existing = {b["Name"] for b in client.list_buckets().get("Buckets", [])}
    if settings.minio_bucket not in existing:
        client.create_bucket(Bucket=settings.minio_bucket)


def upload_file(*, key_prefix: str, filename: str, content: bytes, content_type: str) -> str:
    """Uploads to the real MinIO instance (S3-compatible, self-hosted via docker-compose —
    no external account needed) and returns the object key stored on the record."""
    ensure_bucket()
    key = f"{key_prefix}/{uuid.uuid4().hex}_{filename}"
    get_s3_client().put_object(
        Bucket=settings.minio_bucket, Key=key, Body=content, ContentType=content_type
    )
    return key


def presigned_url(key: str, expires_seconds: int = 3600) -> str:
    return get_s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.minio_bucket, "Key": key},
        ExpiresIn=expires_seconds,
    )
