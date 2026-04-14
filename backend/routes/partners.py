from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid

from deps import db, logger, get_current_user
from utils.partner_reports import generate_outstanding_report, generate_orders_expenses_report, generate_top_performers_report, send_report_to_partners

router = APIRouter(prefix="/api")


# ============== PARTNER MANAGEMENT ==============

@router.get("/partners")
async def get_partners(current_user: dict = Depends(get_current_user)):
    partners = await db.partners.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)
    return partners


@router.post("/partners")
async def create_partner(data: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    if not data.get('name') or not data.get('phone'):
        raise HTTPException(status_code=400, detail="Name and phone are required")
    partner = {
        'id': str(uuid.uuid4()),
        'name': data['name'],
        'phone': ''.join(filter(str.isdigit, data['phone'])),
        'active': True,
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.partners.insert_one(partner)
    partner.pop('_id', None)
    return partner


@router.put("/partners/{partner_id}")
async def update_partner(partner_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    update = {}
    if 'name' in data:
        update['name'] = data['name']
    if 'phone' in data:
        update['phone'] = ''.join(filter(str.isdigit, data['phone']))
    if 'active' in data:
        update['active'] = data['active']
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    result = await db.partners.update_one({'id': partner_id}, {'$set': update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    partner = await db.partners.find_one({'id': partner_id}, {'_id': 0})
    return partner


@router.delete("/partners/{partner_id}")
async def delete_partner(partner_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    result = await db.partners.delete_one({'id': partner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    return {"message": "Partner deleted"}


# ============== REPORT PREVIEW & SEND ==============

@router.post("/partner-reports/preview")
async def preview_report(data: dict, current_user: dict = Depends(get_current_user)):
    """Preview report messages without sending"""
    report_type = data.get('report_type')  # outstanding, orders_expenses, top_performers
    period = data.get('period', 'week')  # week, month, custom
    from_date = data.get('from_date')
    to_date = data.get('to_date')

    if period == 'week':
        today = datetime.now(timezone.utc)
        to_date = today.strftime('%Y-%m-%d')
        from_date = (today - timedelta(days=7)).strftime('%Y-%m-%d')
    elif period == 'month':
        today = datetime.now(timezone.utc)
        from_date = today.replace(day=1).strftime('%Y-%m-%d')
        to_date = today.strftime('%Y-%m-%d')

    if report_type == 'outstanding':
        messages = await generate_outstanding_report()
        return {"messages": messages, "type": "outstanding"}
    elif report_type == 'orders_expenses':
        messages = await generate_orders_expenses_report(from_date, to_date)
        return {"messages": messages, "type": "orders_expenses"}
    elif report_type == 'top_performers':
        messages = await generate_top_performers_report(from_date, to_date)
        return {"messages": messages, "type": "top_performers"}
    else:
        raise HTTPException(status_code=400, detail="Invalid report_type")


@router.post("/partner-reports/send")
async def send_report(data: dict, current_user: dict = Depends(get_current_user)):
    """Manually send reports to all active partners"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")

    report_type = data.get('report_type')  # outstanding, orders_expenses, top_performers, all
    period = data.get('period', 'week')
    from_date = data.get('from_date')
    to_date = data.get('to_date')

    if period == 'week':
        today = datetime.now(timezone.utc)
        to_date = today.strftime('%Y-%m-%d')
        from_date = (today - timedelta(days=7)).strftime('%Y-%m-%d')
    elif period == 'month':
        today = datetime.now(timezone.utc)
        from_date = today.replace(day=1).strftime('%Y-%m-%d')
        to_date = today.strftime('%Y-%m-%d')

    all_messages = []
    if report_type in ('outstanding', 'all'):
        msgs = await generate_outstanding_report()
        all_messages.extend(msgs)
    if report_type in ('orders_expenses', 'all'):
        msgs = await generate_orders_expenses_report(from_date, to_date)
        all_messages.extend(msgs)
    if report_type in ('top_performers', 'all'):
        msgs = await generate_top_performers_report(from_date, to_date)
        all_messages.extend(msgs)

    if not all_messages:
        raise HTTPException(status_code=400, detail="No reports generated")

    sent, failed = await send_report_to_partners(all_messages)
    return {"message": f"Reports sent to {sent} partner(s), {failed} failed", "sent": sent, "failed": failed}


@router.get("/partner-reports/history")
async def get_report_history(current_user: dict = Depends(get_current_user)):
    """Get last 50 report send logs"""
    logs = await db.partner_report_logs.find({}, {'_id': 0}).sort('sent_at', -1).to_list(50)
    return logs
