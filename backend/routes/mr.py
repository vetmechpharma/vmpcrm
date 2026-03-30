from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import MRCreate, MRUpdate
from pydantic import BaseModel
from deps import create_mr_token, get_current_mr
from utils.whatsapp import get_whatsapp_config, send_wa_msg, log_whatsapp_message
from utils.email_utils import send_notification_email
from utils.templates import render_wa_template, get_company_short_name
from utils.push import send_push_to_admins
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter(prefix="/api")

# ============== MR (MEDICAL REPRESENTATIVE) ROUTES ==============

@router.post("/mr/login")
async def mr_login(data: dict):
    """MR Login with phone + password"""
    phone = data.get('phone', '').strip()
    password = data.get('password', '').strip()
    if not phone or not password:
        raise HTTPException(status_code=400, detail="Phone and password required")
    
    clean_phone = ''.join(filter(str.isdigit, phone))
    mr = await db.mrs.find_one({'phone': {'$regex': clean_phone + '$'}}, {'_id': 0})
    if not mr:
        raise HTTPException(status_code=401, detail="Invalid phone or password")
    if mr.get('status') != 'active':
        raise HTTPException(status_code=403, detail="Your account is inactive")
    if not verify_password(password, mr['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid phone or password")
    
    token = create_mr_token(mr['id'], mr['name'])
    return {
        "access_token": token,
        "mr": {
            "id": mr['id'], "name": mr['name'], "phone": mr['phone'],
            "email": mr.get('email', ''), "state": mr['state'],
            "districts": mr.get('districts', []),
        }
    }

@router.get("/mr/me")
async def get_mr_profile(mr: dict = Depends(get_current_mr)):
    """Get current MR profile"""
    return mr

@router.get("/mr/dashboard")
async def get_mr_dashboard(mr: dict = Depends(get_current_mr)):
    """Get MR dashboard stats"""
    state = mr.get('state', '')
    districts = mr.get('districts', [])
    loc_q = {'state': state}
    if districts:
        loc_q['district'] = {'$in': districts}
    
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    doctors_count = await db.doctors.count_documents(loc_q)
    medicals_count = await db.medicals.count_documents(loc_q)
    agencies_count = await db.agencies.count_documents(loc_q)
    
    today_visits = await db.mr_visits.count_documents({'mr_id': mr['id'], 'visit_date': today})
    total_visits = await db.mr_visits.count_documents({'mr_id': mr['id']})
    
    # Pending follow-ups (visits with follow_up_required and next_follow_up_date <= today)
    pending_followups = await db.mr_visits.count_documents({
        'mr_id': mr['id'],
        'outcome': 'follow_up_required',
        'follow_up_done': {'$ne': True},
        'next_follow_up_date': {'$lte': today}
    })
    
    overdue_followups = await db.mr_visits.count_documents({
        'mr_id': mr['id'],
        'outcome': 'follow_up_required',
        'follow_up_done': {'$ne': True},
        'next_follow_up_date': {'$lt': today}
    })
    
    active_decks = await db.visual_aid_decks.count_documents({'status': 'active'})
    
    return {
        'doctors': doctors_count,
        'medicals': medicals_count,
        'agencies': agencies_count,
        'total_customers': doctors_count + medicals_count + agencies_count,
        'today_visits': today_visits,
        'total_visits': total_visits,
        'pending_followups': pending_followups,
        'overdue_followups': overdue_followups,
        'active_decks': active_decks,
    }

@router.get("/mr/customers")
async def get_mr_customers(entity_type: Optional[str] = None, search: Optional[str] = None, mr: dict = Depends(get_current_mr)):
    """Get customers in MR's territory"""
    state = mr.get('state', '')
    districts = mr.get('districts', [])
    loc_q = {'state': state}
    if districts:
        loc_q['district'] = {'$in': districts}
    
    results = []
    types = [entity_type] if entity_type else ['doctor', 'medical', 'agency']
    collections = {'doctor': 'doctors', 'medical': 'medicals', 'agency': 'agencies'}
    
    for t in types:
        col_name = collections.get(t)
        if not col_name:
            continue
        q = {**loc_q}
        if search:
            q['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'phone': {'$regex': search, '$options': 'i'}},
            ]
        docs = await db[col_name].find(q, {'_id': 0}).sort('name', 1).to_list(500)
        for d in docs:
            d['entity_type'] = t
        results.extend(docs)
    
    return results


@router.get("/mr/outstanding")
async def get_mr_outstanding(mr: dict = Depends(get_current_mr)):
    """Get outstanding balances for customers in MR's territory"""
    state = mr.get('state', '')
    districts = mr.get('districts', [])
    loc_q = {'state': state}
    if districts:
        loc_q['district'] = {'$in': districts}
    
    results = []
    collections = {'doctor': 'doctors', 'medical': 'medicals', 'agency': 'agencies'}
    totals = {'doctor': 0, 'medical': 0, 'agency': 0, 'grand_total': 0}
    
    for ctype, col_name in collections.items():
        customers = await db[col_name].find(loc_q, {
            '_id': 0, 'id': 1, 'name': 1, 'phone': 1, 'district': 1,
            'opening_balance': 1, 'customer_code': 1
        }).sort('name', 1).to_list(2000)
        
        for cust in customers:
            cust_id = cust['id']
            opening_bal = cust.get('opening_balance', 0) or 0
            
            inv_pipeline = [
                {'$match': {'doctor_id': cust_id, 'invoice_value': {'$ne': None}}},
                {'$group': {'_id': None, 'total': {'$sum': {'$toDouble': '$invoice_value'}}}}
            ]
            inv_result = await db.orders.aggregate(inv_pipeline).to_list(1)
            total_invoiced = inv_result[0]['total'] if inv_result else 0
            
            pay_pipeline = [
                {'$match': {'customer_id': cust_id}},
                {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
            ]
            pay_result = await db.payments.aggregate(pay_pipeline).to_list(1)
            total_paid = pay_result[0]['total'] if pay_result else 0
            
            outstanding = opening_bal + total_invoiced - total_paid
            
            results.append({
                'customer_id': cust_id,
                'customer_code': cust.get('customer_code', ''),
                'customer_name': cust['name'],
                'customer_phone': cust.get('phone', ''),
                'district': cust.get('district', ''),
                'customer_type': ctype,
                'opening_balance': round(opening_bal, 2),
                'total_invoiced': round(total_invoiced, 2),
                'total_paid': round(total_paid, 2),
                'outstanding': round(outstanding, 2),
            })
            if outstanding != 0:
                totals[ctype] = round(totals[ctype] + outstanding, 2)
                totals['grand_total'] = round(totals['grand_total'] + outstanding, 2)
    
    results.sort(key=lambda x: x['outstanding'], reverse=True)
    return {
        'customers': results,
        'totals': totals,
        'synced_at': datetime.now(timezone.utc).isoformat()
    }


@router.post("/mr/visits")
async def create_mr_visit(data: dict, mr: dict = Depends(get_current_mr)):
    """Record a visit"""
    visit_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    visit = {
        'id': visit_id,
        'mr_id': mr['id'],
        'mr_name': mr['name'],
        'entity_type': data.get('entity_type', ''),
        'entity_id': data.get('entity_id', ''),
        'entity_name': data.get('entity_name', ''),
        'visit_date': data.get('visit_date', now[:10]),
        'notes': data.get('notes', ''),
        'outcome': data.get('outcome', ''),
        'next_follow_up_date': data.get('next_follow_up_date', ''),
        'next_follow_up_notes': data.get('next_follow_up_notes', ''),
        'follow_up_done': False,
        'created_at': now,
        'updated_at': now,
    }
    await db.mr_visits.insert_one(visit)
    visit.pop('_id', None)
    return visit

@router.get("/mr/visits")
async def get_mr_visits(from_date: Optional[str] = None, to_date: Optional[str] = None, outcome: Optional[str] = None, mr: dict = Depends(get_current_mr)):
    """Get MR's visits"""
    q = {'mr_id': mr['id']}
    if from_date or to_date:
        dq = {}
        if from_date: dq['$gte'] = from_date
        if to_date: dq['$lte'] = to_date
        q['visit_date'] = dq
    if outcome:
        q['outcome'] = outcome
    
    visits = await db.mr_visits.find(q, {'_id': 0}).sort('created_at', -1).to_list(500)
    return visits

@router.put("/mr/visits/{visit_id}")
async def update_mr_visit(visit_id: str, data: dict, mr: dict = Depends(get_current_mr)):
    """Update a visit"""
    update_data = {}
    for k in ['notes', 'outcome', 'next_follow_up_date', 'next_follow_up_notes', 'follow_up_done']:
        if k in data:
            update_data[k] = data[k]
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.mr_visits.update_one({'id': visit_id, 'mr_id': mr['id']}, {'$set': update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    visit = await db.mr_visits.find_one({'id': visit_id}, {'_id': 0})
    return visit

@router.get("/mr/followups")
async def get_mr_followups(filter_type: Optional[str] = None, mr: dict = Depends(get_current_mr)):
    """Get MR's follow-ups from visits"""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    q = {'mr_id': mr['id'], 'outcome': 'follow_up_required', 'follow_up_done': {'$ne': True}}
    
    if filter_type == 'today':
        q['next_follow_up_date'] = today
    elif filter_type == 'overdue':
        q['next_follow_up_date'] = {'$lt': today}
    elif filter_type == 'upcoming':
        q['next_follow_up_date'] = {'$gt': today}
    
    followups = await db.mr_visits.find(q, {'_id': 0}).sort('next_follow_up_date', 1).to_list(500)
    return followups

@router.get("/mr/visual-aids")
async def get_mr_visual_aids(mr: dict = Depends(get_current_mr)):
    """Get active visual aid decks for MR"""
    decks = await db.visual_aid_decks.find({'status': 'active'}, {'_id': 0}).sort('name', 1).to_list(100)
    return decks

@router.get("/mr/visual-aids/{deck_id}")
async def get_mr_visual_aid_deck(deck_id: str, mr: dict = Depends(get_current_mr)):
    """Get deck with slides for MR slideshow"""
    deck = await db.visual_aid_decks.find_one({'id': deck_id, 'status': 'active'}, {'_id': 0})
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    slides = await db.visual_aid_slides.find({'deck_id': deck_id}, {'_id': 0}).sort('order', 1).to_list(100)
    deck['slides'] = slides
    return deck

@router.get("/mr/pending-items/{phone}")
async def get_mr_pending_items_by_phone(phone: str, mr: dict = Depends(get_current_mr)):
    """Get pending items for a customer by phone - MR accessible"""
    pending_items = await db.pending_items.find({'doctor_phone': phone}, {'_id': 0}).sort('created_at', -1).to_list(100)
    result = []
    for item in pending_items:
        created_at = item.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        order_date = item.get('original_order_date') or item.get('created_at')
        if isinstance(order_date, str):
            order_date = datetime.fromisoformat(order_date.replace('Z', '+00:00'))
        result.append({
            'id': item['id'],
            'doctor_phone': item['doctor_phone'],
            'doctor_name': item.get('doctor_name', ''),
            'item_id': item['item_id'],
            'item_code': item['item_code'],
            'item_name': item['item_name'],
            'quantity': item['quantity'],
            'original_order_number': item.get('original_order_number', ''),
            'original_order_date': str(order_date) if order_date else '',
            'created_at': str(created_at) if created_at else '',
        })
    return result


# ============== MR ORDER ROUTES ==============

@router.get("/mr/items")
async def get_mr_items(search: Optional[str] = None, category: Optional[str] = None, mr: dict = Depends(get_current_mr)):
    """Get items available for MR ordering"""
    q = {'out_of_stock': {'$ne': True}, 'is_hidden': {'$ne': True}}
    if search:
        q['$or'] = [
            {'item_name': {'$regex': search, '$options': 'i'}},
            {'item_code': {'$regex': search, '$options': 'i'}},
        ]
    if category:
        q['main_category'] = category
    
    items = await db.items.find(q, {'_id': 0, 'image_webp': 0}).sort('item_name', 1).to_list(500)
    # Add image URL
    for item in items:
        item['image_url'] = f"/api/items/{item['id']}/image"
    return items

@router.post("/mr/orders")
async def create_mr_order(data: dict, background_tasks: BackgroundTasks, mr: dict = Depends(get_current_mr)):
    """Create an order from MR on behalf of a customer"""
    items = data.get('items', [])
    customer_id = data.get('customer_id', '')
    customer_name = data.get('customer_name', '')
    customer_phone = data.get('customer_phone', '')
    customer_type = data.get('customer_type', 'doctor')
    notes = data.get('notes', '')
    
    if not items:
        raise HTTPException(status_code=400, detail="No items in order")
    if not customer_name:
        raise HTTPException(status_code=400, detail="Customer name required")
    
    # Generate order number
    today_str = datetime.now(timezone.utc).strftime('%Y%m%d')
    today_orders = await db.orders.count_documents({'order_number': {'$regex': f'^ORD-{today_str}'}})
    order_number = f"ORD-{today_str}-{(today_orders + 1):04d}"
    
    order_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    order_items = []
    for item in items:
        order_items.append({
            'item_id': item.get('item_id', ''),
            'item_code': item.get('item_code', ''),
            'item_name': item.get('item_name', ''),
            'quantity': str(item.get('quantity', '1')),
            'rate': float(item.get('rate', 0)),
            'mrp': float(item.get('mrp', 0)),
        })
    
    order_doc = {
        'id': order_id,
        'order_number': order_number,
        'doctor_id': customer_id,
        'customer_type': customer_type,
        'doctor_name': customer_name,
        'doctor_phone': customer_phone,
        'doctor_email': '',
        'doctor_address': '',
        'items': order_items,
        'status': 'pending',
        'notes': notes,
        'source': 'mr',
        'mr_id': mr['id'],
        'mr_name': mr['name'],
        'created_by': f"MR: {mr['name']}",
        'created_by_id': mr['id'],
        'created_at': now.isoformat(),
    }
    
    await db.orders.insert_one(order_doc)
    order_doc.pop('_id', None)
    
    # Send WhatsApp notification
    try:
        background_tasks.add_task(send_whatsapp_order, customer_phone, [OrderItem(**i) for i in order_items], order_number, customer_name)
    except Exception as e:
        logger.error(f"WhatsApp order notification error: {e}")
    
    return {'id': order_id, 'order_number': order_number, 'status': 'pending', 'message': 'Order created successfully'}

@router.get("/mr/orders")
async def get_mr_orders(mr: dict = Depends(get_current_mr)):
    """Get orders placed by this MR"""
    orders = await db.orders.find({'mr_id': mr['id']}, {'_id': 0}).sort('created_at', -1).to_list(200)
    for o in orders:
        if isinstance(o.get('created_at'), str):
            pass
    return orders

@router.post("/mr/orders/{order_id}/cancel-request")
async def mr_order_cancel_request(order_id: str, data: dict, mr: dict = Depends(get_current_mr)):
    """MR requests order cancellation"""
    order = await db.orders.find_one({'id': order_id, 'mr_id': mr['id']}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order['status'] in ['cancelled', 'dispatched', 'delivered']:
        raise HTTPException(status_code=400, detail=f"Cannot cancel order with status: {order['status']}")
    
    now = datetime.now(timezone.utc).isoformat()
    reason = data.get('reason', '')
    
    await db.orders.update_one({'id': order_id}, {'$set': {
        'cancel_requested': True,
        'cancel_requested_by': f"MR: {mr['name']}",
        'cancel_requested_at': now,
        'cancel_reason': reason,
    }})
    
    return {'message': 'Cancellation request submitted', 'order_id': order_id}


# ============== MR PAYMENT REQUESTS ==============

@router.post("/mr/payment-requests")
async def create_mr_payment_request(data: dict, mr: dict = Depends(get_current_mr)):
    """MR records a payment for admin approval"""
    customer_id = data.get('customer_id', '')
    customer_name = data.get('customer_name', '')
    customer_type = data.get('customer_type', 'doctor')
    amount = float(data.get('amount', 0))
    mode = data.get('mode', 'cash')
    notes = data.get('notes', '')
    date = data.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d'))
    
    if not customer_id or not customer_name:
        raise HTTPException(status_code=400, detail="Customer required")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    
    now = datetime.now(timezone.utc)
    request_doc = {
        'id': str(uuid.uuid4()),
        'customer_id': customer_id,
        'customer_name': customer_name,
        'customer_type': customer_type,
        'customer_phone': data.get('customer_phone', ''),
        'amount': amount,
        'mode': mode,
        'date': date,
        'notes': notes,
        'status': 'pending',
        'mr_id': mr['id'],
        'mr_name': mr['name'],
        'created_at': now.isoformat(),
    }
    
    await db.payment_requests.insert_one(request_doc)
    request_doc.pop('_id', None)
    
    # Notify admins
    try:
        admins = await db.users.find({'role': 'admin'}, {'_id': 0, 'id': 1}).to_list(10)
        for admin in admins:
            await send_push_to_user(admin['id'], 'admin', 'Payment Request',
                f'{mr["name"]} recorded Rs.{amount:,.0f} from {customer_name}', '/payments', 'payment-request')
    except Exception as e:
        logger.error(f"Payment request push notification error: {e}")
    
    return {'id': request_doc['id'], 'message': 'Payment request submitted for approval'}

@router.get("/mr/payment-requests")
async def get_mr_payment_requests(mr: dict = Depends(get_current_mr)):
    """Get payment requests created by this MR"""
    requests = await db.payment_requests.find({'mr_id': mr['id']}, {'_id': 0}).sort('created_at', -1).to_list(200)
    return requests

@router.get("/payment-requests")
async def get_all_payment_requests(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Admin: Get all payment requests"""
    q = {}
    if status:
        q['status'] = status
    requests = await db.payment_requests.find(q, {'_id': 0}).sort('created_at', -1).to_list(500)
    return requests

@router.post("/payment-requests/{request_id}/approve")
async def approve_payment_request(request_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Admin approves or rejects a payment request. On approval, creates actual payment and updates ledger."""
    req = await db.payment_requests.find_one({'id': request_id}, {'_id': 0})
    if not req:
        raise HTTPException(status_code=404, detail="Payment request not found")
    
    action = data.get('action', '')  # 'approve' or 'reject'
    now = datetime.now(timezone.utc)
    
    if action == 'approve':
        # Create actual payment
        payment_id = str(uuid.uuid4())
        payment_doc = {
            'id': payment_id,
            'customer_id': req['customer_id'],
            'customer_name': req['customer_name'],
            'customer_type': req['customer_type'],
            'customer_phone': req.get('customer_phone', ''),
            'amount': req['amount'],
            'mode': req['mode'],
            'date': req['date'],
            'notes': f"{req.get('notes', '')} [Recorded by MR: {req['mr_name']}]".strip(),
            'order_id': '',
            'invoice_number': '',
            'created_by': current_user['name'],
            'approved_by': current_user['name'],
            'mr_recorded': True,
            'mr_name': req['mr_name'],
            'mr_id': req['mr_id'],
            'created_at': now.isoformat(),
        }
        await db.payments.insert_one(payment_doc)
        
        # Update request status
        await db.payment_requests.update_one({'id': request_id}, {'$set': {
            'status': 'approved',
            'approved_by': current_user['name'],
            'approved_at': now.isoformat(),
            'payment_id': payment_id,
        }})
        
        return {'message': f'Payment of Rs.{req["amount"]:,.2f} approved and recorded', 'payment_id': payment_id}
    
    elif action == 'reject':
        reason = data.get('reason', '')
        await db.payment_requests.update_one({'id': request_id}, {'$set': {
            'status': 'rejected',
            'rejected_by': current_user['name'],
            'rejected_at': now.isoformat(),
            'rejection_reason': reason,
        }})
        return {'message': 'Payment request rejected'}
    
    raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'reject'")


@router.post("/orders/{order_id}/approve-cancel")
async def approve_cancel_order(order_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Admin approves or rejects cancellation request"""
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    action = data.get('action', '')  # approve or reject
    now = datetime.now(timezone.utc).isoformat()
    
    if action == 'approve':
        await db.orders.update_one({'id': order_id}, {'$set': {
            'status': 'cancelled',
            'cancellation_reason': order.get('cancel_reason', 'Cancelled by admin'),
            'cancel_approved_by': current_user.get('name', 'Admin'),
            'cancel_approved_at': now,
            'cancel_requested': False,
        }})
        return {'message': 'Order cancelled'}
    elif action == 'reject':
        await db.orders.update_one({'id': order_id}, {'$set': {
            'cancel_requested': False,
            'cancel_rejected_by': current_user.get('name', 'Admin'),
            'cancel_rejected_at': now,
        }})
        return {'message': 'Cancellation rejected'}
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@router.post("/mrs")
async def create_mr(data: MRCreate, current_user: dict = Depends(get_current_user)):
    """Create a new Medical Representative"""
    mr_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Check duplicate phone
    existing = await db.mrs.find_one({'phone': data.phone}, {'_id': 0, 'id': 1})
    if existing:
        raise HTTPException(status_code=400, detail="MR with this phone already exists")
    
    mr_doc = {
        'id': mr_id,
        'name': data.name,
        'phone': data.phone,
        'email': data.email or '',
        'password_hash': hash_password(data.password),
        'state': data.state,
        'districts': data.districts,
        'status': data.status,
        'created_at': now,
        'updated_at': now,
    }
    await db.mrs.insert_one(mr_doc)
    mr_doc.pop('_id', None)
    mr_doc.pop('password_hash', None)
    return mr_doc

@router.get("/mrs")
async def get_mrs(search: Optional[str] = None, state: Optional[str] = None, status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all Medical Representatives"""
    query = {}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'phone': {'$regex': search, '$options': 'i'}},
            {'email': {'$regex': search, '$options': 'i'}},
        ]
    if state:
        query['state'] = state
    if status:
        query['status'] = status
    
    mrs = await db.mrs.find(query, {'_id': 0, 'password_hash': 0}).sort('created_at', -1).to_list(500)
    return mrs

@router.get("/mrs/{mr_id}")
async def get_mr(mr_id: str, current_user: dict = Depends(get_current_user)):
    """Get single MR"""
    mr = await db.mrs.find_one({'id': mr_id}, {'_id': 0, 'password_hash': 0})
    if not mr:
        raise HTTPException(status_code=404, detail="MR not found")
    return mr

@router.put("/mrs/{mr_id}")
async def update_mr(mr_id: str, data: MRUpdate, current_user: dict = Depends(get_current_user)):
    """Update MR"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if 'password' in update_data:
        update_data['password_hash'] = hash_password(update_data.pop('password'))
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.mrs.update_one({'id': mr_id}, {'$set': update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="MR not found")
    
    mr = await db.mrs.find_one({'id': mr_id}, {'_id': 0, 'password_hash': 0})
    return mr

@router.delete("/mrs/{mr_id}")
async def delete_mr(mr_id: str, current_user: dict = Depends(get_current_user)):
    """Delete MR"""
    result = await db.mrs.delete_one({'id': mr_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="MR not found")
    return {"message": "MR deleted"}


