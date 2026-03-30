"""VMP CRM API - Main Application Entry Point.

This is the slim orchestrator that imports all route modules and
configures the FastAPI application.
"""
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import os
import asyncio

from deps import db, client, logger

# Import all route modules
from routes import (
    auth, doctors, medicals, agencies, tasks,
    email_routes, dashboard, items, payments,
    company_settings, customers, otp_orders, fallback_otp,
    marketing, orders_admin, pending_items, transport,
    expenses, greeting_templates, followups, reminders,
    whatsapp_config, message_templates, push,
    admin_profile, database, users, mr, visual_aids
)

# Import background tasks
from background_tasks import (
    send_daily_reminder_summary,
    send_birthday_anniversary_greetings,
    seed_default_greeting_templates,
    send_monthly_ledger_statements,
)

# Create the main app
app = FastAPI(title="VMP CRM API")

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
    company_settings, customers, otp_orders, fallback_otp,
    marketing, orders_admin, pending_items, transport,
    expenses, greeting_templates, followups, reminders,
    whatsapp_config, message_templates, push,
    admin_profile, database, users, mr, visual_aids,
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


@app.on_event("startup")
async def startup_event():
    """Start background tasks on app startup"""
    global daily_reminder_task, backup_scheduler_task, greeting_task, monthly_ledger_task

    daily_reminder_task = asyncio.create_task(send_daily_reminder_summary())
    logger.info("Daily reminder background task started")

    # Import run_scheduled_backups from the database routes module
    from routes.database import run_scheduled_backups
    backup_scheduler_task = asyncio.create_task(run_scheduled_backups())
    logger.info("Backup scheduler task started")

    greeting_task = asyncio.create_task(send_birthday_anniversary_greetings())
    logger.info("Birthday/Anniversary greeting task started")

    monthly_ledger_task = asyncio.create_task(send_monthly_ledger_statements())
    logger.info("Monthly ledger statement task started")

    # Seed default templates
    await seed_default_greeting_templates()


@app.on_event("shutdown")
async def shutdown_db_client():
    global daily_reminder_task, backup_scheduler_task, greeting_task, monthly_ledger_task

    for task_name, task in [
        ("daily_reminder", daily_reminder_task),
        ("backup_scheduler", backup_scheduler_task),
        ("greeting", greeting_task),
        ("monthly_ledger", monthly_ledger_task),
    ]:
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            logger.info(f"{task_name} task stopped")

    client.close()
