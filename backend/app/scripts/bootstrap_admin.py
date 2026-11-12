import asyncio
import os
import sys
import uuid
from sqlalchemy import func, select
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.services.auth import hash_password


async def run_bootstrap():
    admin_email = os.getenv("ADMIN_EMAIL", "admin@agentplatform.local").strip().lower()
    admin_password = os.getenv("ADMIN_PASSWORD", "adminpassword123")
    admin_name = os.getenv("ADMIN_NAME", "System Administrator")

    async with AsyncSessionLocal() as session:
        existing = await session.scalar(
            select(User).where(func.lower(User.email) == admin_email)
        )
        if existing:
            print(f"[BOOTSTRAP] Administrator already exists: {existing.email} (ID: {existing.id})")
            return

        user = User(
            id=uuid.uuid4(),
            email=admin_email,
            hashed_password=hash_password(admin_password),
            full_name=admin_name,
            role="admin",
            is_active=True,
        )
        session.add(user)
        await session.commit()
        print(f"[BOOTSTRAP] Successfully created initial administrator:")
        print(f"            Email:    {admin_email}")
        print(f"            Password: {admin_password}")
        print(f"            Role:     admin")


if __name__ == "__main__":
    asyncio.run(run_bootstrap())

