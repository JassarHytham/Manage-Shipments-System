"""Seed script: creates the default admin user."""

import asyncio

from prisma import Prisma

from app.services.auth import hash_password

ADMIN_EMAIL = "admin@wakkiez.com"
ADMIN_PASSWORD = "admin123"  # Change in production
ADMIN_NAME = "Wakkiez Admin"


async def main():
    db = Prisma()
    await db.connect()

    existing = await db.user.find_unique(where={"email": ADMIN_EMAIL})
    if existing:
        print(f"Admin user already exists: {ADMIN_EMAIL}")
    else:
        user = await db.user.create(
            data={
                "name": ADMIN_NAME,
                "email": ADMIN_EMAIL,
                "password_hash": hash_password(ADMIN_PASSWORD),
                "role": "admin",
                "is_active": True,
            }
        )
        print(f"Created admin user: {user.email} (id: {user.id})")

    await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
