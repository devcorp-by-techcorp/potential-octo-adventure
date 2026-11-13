"""Opt-in private object storage; object keys never establish application access."""

import hashlib
import os
import re
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from config import get_settings

KEY_PATTERN = re.compile(r"documents/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\Z")


class StorageUnavailable(Exception):
    pass


class StorageSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent / ".env", extra="ignore", env_ignore_empty=True
    )
    document_storage_backend: str = "disabled"
    document_storage_local_root: str | None = None
    document_max_bytes: int = Field(default=10 * 1024 * 1024, ge=1, le=100 * 1024 * 1024)


def validate_key(key):
    if not KEY_PATTERN.fullmatch(key):
        raise StorageUnavailable("Invalid private object identifier.")


class LocalStorage:
    """Development/test only. Exclusive files, no following object symlinks."""

    name = "local"

    def __init__(self, root):
        self.root = Path(root)
        repository = Path(__file__).resolve().parent.parent
        if not self.root.is_absolute() or self.root.is_symlink():
            raise StorageUnavailable("Local storage needs an absolute private directory.")
        self.root = self.root.resolve()
        if self.root.is_relative_to(repository) or repository.is_relative_to(self.root):
            raise StorageUnavailable("Local storage must be outside the repository.")
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        if self.root.stat().st_mode & 0o077:
            raise StorageUnavailable("Local storage requires a private owner-only directory.")

    def path(self, key):
        validate_key(key)
        # Flatten validated identifiers: no attacker-controlled nested directories.
        return self.root / key.replace("/", "_")

    def put(self, key, content, content_type):
        destination = self.path(key)
        try:
            fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        except FileExistsError:
            existing = self.get(key, len(content))
            if hashlib.sha256(existing).digest() != hashlib.sha256(content).digest():
                raise StorageUnavailable("An incomplete object requires a new version.") from None
            return
        except OSError:
            raise StorageUnavailable("Private storage is unavailable.") from None
        try:
            with os.fdopen(fd, "wb") as target:
                target.write(content)
                target.flush()
                os.fsync(target.fileno())
        except OSError:
            raise StorageUnavailable("Private storage is unavailable.") from None

    def get(self, key, max_bytes):
        try:
            fd = os.open(self.path(key), os.O_RDONLY | os.O_NOFOLLOW)
            with os.fdopen(fd, "rb") as source:
                content = source.read(max_bytes + 1)
            if len(content) > max_bytes:
                raise StorageUnavailable("Private object exceeds its recorded size.")
            return content
        except OSError:
            raise StorageUnavailable("Private object is unavailable.") from None


class R2Storage:
    """S3-compatible private bucket adapter. Never creates ACLs or public URLs."""

    name = "r2"

    def __init__(self, client, bucket):
        self.client, self.bucket = client, bucket

    def put(self, key, content, content_type):
        validate_key(key)
        from botocore.exceptions import BotoCoreError, ClientError

        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=content,
                ContentType=content_type,
                ContentLength=len(content),
                IfNoneMatch="*",
            )
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") in {"PreconditionFailed", "412"}:
                existing = self.get(key, len(content))
                if hashlib.sha256(existing).digest() == hashlib.sha256(content).digest():
                    return
            raise StorageUnavailable("Private R2 storage is unavailable.") from None
        except BotoCoreError:
            raise StorageUnavailable("Private R2 storage is unavailable.") from None

    def get(self, key, max_bytes):
        validate_key(key)
        from botocore.exceptions import BotoCoreError, ClientError

        body = None
        try:
            result = self.client.get_object(Bucket=self.bucket, Key=key)
            body = result["Body"]
            if result["ContentLength"] > max_bytes:
                raise StorageUnavailable("Private object exceeds its recorded size.")
            content = body.read(max_bytes + 1)
            if len(content) > max_bytes:
                raise StorageUnavailable("Private object exceeds its recorded size.")
            return content
        except (BotoCoreError, ClientError, OSError):
            raise StorageUnavailable("Private R2 object is unavailable.") from None
        finally:
            if body is not None:
                body.close()


def get_storage():
    storage, settings = StorageSettings(), get_settings()
    if storage.document_storage_backend == "local":
        if settings.is_production or not storage.document_storage_local_root:
            raise StorageUnavailable(
                "Local storage is available only for configured development/tests."
            )
        return LocalStorage(storage.document_storage_local_root)
    if storage.document_storage_backend == "r2":
        values = [
            settings.r2_account_id,
            settings.r2_access_key_id,
            settings.r2_secret_access_key,
            settings.r2_bucket_originals,
        ]
        if not all(values) or not re.fullmatch(r"[0-9a-f]{32}", settings.r2_account_id):
            raise StorageUnavailable("Private R2 storage requires complete server configuration.")
        import boto3
        from botocore.config import Config

        client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            region_name="auto",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=Config(
                connect_timeout=5,
                read_timeout=15,
                retries={"max_attempts": 2},
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
        )
        return R2Storage(client, settings.r2_bucket_originals)
    raise StorageUnavailable("Document storage has not been configured.")
