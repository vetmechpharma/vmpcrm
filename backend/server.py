"""VMP CRM API - Main Application Entry Point.

This is the slim orchestrator that imports all route modules and
configures the FastAPI application.
"""
from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import asyncio
from datetime import datetime, timezone

from deps import db, client, logger

# Import all route modules
from routes import (
    auth, doctors, medicals, agencies, tasks,
    email_routes, dashboard, items, payments,
    company_settings, customers, fallback_otp,
    marketing, orders_admin, pending_items, transport,
    expenses, greeting_templates, followups, reminders,
    whatsapp_config, message_templates, push,
    admin_profile, database, users, mr, visual_aids,
    stock
)

# Import background tasks
from background_tasks import (
    send_daily_reminder_summary,
    send_birthday_anniversary_greetings,
    seed_default_greeting_templates,
    send_monthly_ledger_statements,
    cleanup_temp_files,
)

# Create the main app
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

def _get_real_ip(request: Request) -> str:
    """Get real client IP from X-Forwarded-For or X-Real-IP headers (behind proxy)"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return get_remote_address(request)

limiter = Limiter(key_func=_get_real_ip)
app = FastAPI(title="VMP CRM API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Health check router (inline - too small to separate)
health_router = APIRouter(prefix="/api")

@health_router.get("/")
async def root():
    return {"message": "VMP CRM API is running"}

@health_router.get("/health")
async def health_check():
    return {"status": "healthy"}


# ============== REGISTER ALL ROUTERS ==============

route_modules = [
    auth, doctors, medicals, agencies, tasks,
    email_routes, dashboard, items, payments,
    company_settings, customers, fallback_otp,
    marketing, orders_admin, pending_items, transport,
    expenses, greeting_templates, followups, reminders,
    whatsapp_config, message_templates, push,
    admin_profile, database, users, mr, visual_aids,
    stock,
]

for module in route_modules:
    app.include_router(module.router)

app.include_router(health_router)


# ============== MIDDLEWARE ==============

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== BACKGROUND TASKS ==============

daily_reminder_task = None
greeting_task = None
monthly_ledger_task = None
backup_scheduler_task = None
cleanup_task = None


@app.on_event("startup")
async def startup_event():
    """Start background tasks on app startup"""
    global daily_reminder_task, backup_scheduler_task, greeting_task, monthly_ledger_task, cleanup_task

    daily_reminder_task = asyncio.create_task(send_daily_reminder_summary())
    logger.info("Daily reminder background task started")

    from routes.database import run_scheduled_backups
    backup_scheduler_task = asyncio.create_task(run_scheduled_backups())
    logger.info("Backup scheduler task started")

    greeting_task = asyncio.create_task(send_birthday_anniversary_greetings())
    logger.info("Birthday/Anniversary greeting task started")

    monthly_ledger_task = asyncio.create_task(send_monthly_ledger_statements())
    logger.info("Monthly ledger statement task started")

    cleanup_task = asyncio.create_task(cleanup_temp_files())
    logger.info("Temp file cleanup task started (runs every 6 hours)")

    # Seed default templates
    await seed_default_greeting_templates()

    # Seed default admin if no users exist
    existing_admin = await db.users.find_one({'role': 'admin'}, {'_id': 1})
    if not existing_admin:
        from deps import hash_password
        import uuid as _uuid
        admin_doc = {
            'id': str(_uuid.uuid4()),
            'email': 'info@vetmech.in',
            'password': hash_password('Kongu@@44884'),
            'name': 'Admin VETMECH',
            'role': 'admin',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_doc)
        logger.info("Default admin user seeded (info@vetmech.in)")


@app.on_event("shutdown")
async def shutdown_db_client():
    global daily_reminder_task, backup_scheduler_task, greeting_task, monthly_ledger_task, cleanup_task

    for task_name, task in [
        ("daily_reminder", daily_reminder_task),
        ("backup_scheduler", backup_scheduler_task),
        ("greeting", greeting_task),
        ("monthly_ledger", monthly_ledger_task),
        ("cleanup", cleanup_task),
    ]:
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            logger.info(f"{task_name} task stopped")

    client.close()
