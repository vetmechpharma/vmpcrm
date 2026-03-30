from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import DashboardStats, DoctorResponse

router = APIRouter(prefix="/api")

# ============== DASHBOARD ROUTES ==============

@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    total_doctors = await db.doctors.count_documents({})
    
    pipeline = [
        {'$group': {'_id': '$lead_status', 'count': {'$sum': 1}}}
    ]
    status_counts = await db.doctors.aggregate(pipeline).to_list(100)
    by_status = {item['_id']: item['count'] for item in status_counts}
    
    # Ensure all statuses are represented
    for status in ['Customer', 'Contacted', 'Pipeline', 'Not Interested', 'Closed']:
        if status not in by_status:
            by_status[status] = 0
    
    # Recent emails count (last 7 days)
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_emails = await db.email_logs.count_documents({'created_at': {'$gte': seven_days_ago}})
    
    # Recent doctors
    recent_docs = await db.doctors.find({}, {'_id': 0}).sort('created_at', -1).to_list(5)
    recent_doctors = []
    for doc in recent_docs:
        created_at = doc.get('created_at', datetime.now(timezone.utc))
        updated_at = doc.get('updated_at', created_at)  # Fallback to created_at if missing
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        
        recent_doctors.append(DoctorResponse(
            id=doc['id'],
            customer_code=doc['customer_code'],
            name=doc['name'],
            reg_no=doc['reg_no'],
            address=doc['address'],
            email=doc['email'],
            phone=doc['phone'],
            lead_status=doc['lead_status'],
            dob=doc.get('dob'),
            created_at=created_at,
            updated_at=updated_at
        ))
    
    return DashboardStats(
        total_doctors=total_doctors,
        by_status=by_status,
        recent_emails=recent_emails,
        recent_doctors=recent_doctors
    )


@router.get("/dashboard/comprehensive-stats")
async def get_comprehensive_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Get comprehensive dashboard statistics for all entities"""
    
    # ============== CUSTOMERS STATS (Doctors, Medicals, Agencies) ==============
    # Lead statuses for all entities
    lead_statuses = ['Customer', 'Contacted', 'Pipeline', 'Not Interested', 'Closed']
    
    # Doctors stats
    total_doctors = await db.doctors.count_documents({})
    doctor_status_pipeline = [{'$group': {'_id': '$lead_status', 'count': {'$sum': 1}}}]
    doctor_status_counts = await db.doctors.aggregate(doctor_status_pipeline).to_list(100)
    doctors_by_status = {item['_id']: item['count'] for item in doctor_status_counts if item['_id']}
    for status in lead_statuses:
        if status not in doctors_by_status:
            doctors_by_status[status] = 0
    
    # Medicals stats
    total_medicals = await db.medicals.count_documents({})
    medical_status_pipeline = [{'$group': {'_id': '$lead_status', 'count': {'$sum': 1}}}]
    medical_status_counts = await db.medicals.aggregate(medical_status_pipeline).to_list(100)
    medicals_by_status = {item['_id']: item['count'] for item in medical_status_counts if item['_id']}
    for status in lead_statuses:
        if status not in medicals_by_status:
            medicals_by_status[status] = 0
    
    # Agencies stats
    total_agencies = await db.agencies.count_documents({})
    agency_status_pipeline = [{'$group': {'_id': '$lead_status', 'count': {'$sum': 1}}}]
    agency_status_counts = await db.agencies.aggregate(agency_status_pipeline).to_list(100)
    agencies_by_status = {item['_id']: item['count'] for item in agency_status_counts if item['_id']}
    for status in lead_statuses:
        if status not in agencies_by_status:
            agencies_by_status[status] = 0
    
    # Combined lead status stats
    combined_by_status = {}
    for status in lead_statuses:
        combined_by_status[status] = doctors_by_status.get(status, 0) + medicals_by_status.get(status, 0) + agencies_by_status.get(status, 0)
    
    # ============== ORDERS STATS ==============
    order_statuses = ['pending', 'confirmed', 'ready_to_despatch', 'shipped', 'delivered', 'cancelled', 'transferred']
    order_status_pipeline = [{'$group': {'_id': '$status', 'count': {'$sum': 1}}}]
    order_status_counts = await db.orders.aggregate(order_status_pipeline).to_list(100)
    orders_by_status = {item['_id']: item['count'] for item in order_status_counts if item['_id']}
    for status in order_statuses:
        if status not in orders_by_status:
            orders_by_status[status] = 0
    total_orders = sum(orders_by_status.values())
    
    # Recent orders count (last 7 days)
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_orders = await db.orders.count_documents({'created_at': {'$gte': seven_days_ago}})
    
    # ============== PENDING ITEMS STATS ==============
    pending_items = await db.pending_items.find({}, {'_id': 0}).to_list(1000)
    
    # Helper to safely parse quantity (handles expressions like '10+5')
    def safe_parse_qty(qty_str):
        try:
            if isinstance(qty_str, (int, float)):
                return int(qty_str)
            qty_str = str(qty_str).strip()
            if '+' in qty_str:
                return sum(int(x.strip()) for x in qty_str.split('+') if x.strip().isdigit())
            return int(qty_str) if qty_str.isdigit() else 1
        except:
            return 1
    
    total_pending_qty = sum(safe_parse_qty(item.get('quantity', 1)) for item in pending_items)
    
    # Group pending items by item name
    pending_by_item = {}
    for item in pending_items:
        item_name = item.get('item_name', 'Unknown')
        qty = safe_parse_qty(item.get('quantity', 1))
        if item_name in pending_by_item:
            pending_by_item[item_name] += qty
        else:
            pending_by_item[item_name] = qty
    
    # Sort by quantity descending
    pending_by_item_sorted = dict(sorted(pending_by_item.items(), key=lambda x: x[1], reverse=True)[:10])
    
    # ============== EXPENSES STATS ==============
    now = datetime.now(timezone.utc)
    current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    previous_month_start = (current_month_start - timedelta(days=1)).replace(day=1)
    
    # Current month expenses
    current_month_expenses = await db.expenses.find({
        'date': {'$gte': current_month_start.isoformat()[:10]}
    }, {'_id': 0}).to_list(1000)
    current_month_total = sum(float(e.get('amount', 0)) for e in current_month_expenses)
    
    # Previous month expenses
    previous_month_expenses = await db.expenses.find({
        'date': {'$gte': previous_month_start.isoformat()[:10], '$lt': current_month_start.isoformat()[:10]}
    }, {'_id': 0}).to_list(1000)
    previous_month_total = sum(float(e.get('amount', 0)) for e in previous_month_expenses)
    
    # By category
    category_pipeline = [
        {'$group': {'_id': '$category', 'total': {'$sum': '$amount'}}}
    ]
    expense_by_category = await db.expenses.aggregate(category_pipeline).to_list(100)
    expenses_by_category = {item['_id']: round(item['total'], 2) for item in expense_by_category if item['_id']}
    
    # By payment type
    payment_pipeline = [
        {'$group': {'_id': '$payment_type', 'total': {'$sum': '$amount'}}}
    ]
    expense_by_payment = await db.expenses.aggregate(payment_pipeline).to_list(100)
    expenses_by_payment = {item['_id']: round(item['total'], 2) for item in expense_by_payment if item['_id']}
    
    # ============== ITEMS STATS ==============
    total_items = await db.items.count_documents({})
    
    # Items by subcategory
    subcategory_pipeline = [
        {'$unwind': {'path': '$subcategories', 'preserveNullAndEmptyArrays': True}},
        {'$group': {'_id': '$subcategories', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]
    items_by_subcategory = await db.items.aggregate(subcategory_pipeline).to_list(100)
    subcategory_stats = {item['_id'] or 'Uncategorized': item['count'] for item in items_by_subcategory}
    
    # Items by main category
    main_category_pipeline = [
        {'$unwind': {'path': '$main_categories', 'preserveNullAndEmptyArrays': True}},
        {'$group': {'_id': '$main_categories', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]
    items_by_main_category = await db.items.aggregate(main_category_pipeline).to_list(100)
    main_category_stats = {item['_id'] or 'Uncategorized': item['count'] for item in items_by_main_category}
    
    # Most ordered items (from order items)
    order_items_pipeline = [
        {'$unwind': '$items'},
        {'$group': {'_id': '$items.item_name', 'total_ordered': {'$sum': 1}}},
        {'$sort': {'total_ordered': -1}},
        {'$limit': 10}
    ]
    most_ordered = await db.orders.aggregate(order_items_pipeline).to_list(10)
    most_ordered_items = [{'item_name': item['_id'], 'order_count': item['total_ordered']} for item in most_ordered if item['_id']]
    
    # Least ordered items (items that exist but have fewer orders)
    all_items = await db.items.find({}, {'_id': 0, 'id': 1, 'item_name': 1, 'item_code': 1}).to_list(1000)
    item_order_counts = {item['_id']: item['total_ordered'] for item in most_ordered if item['_id']}
    
    # Get all item names and find least ordered
    all_item_names = [item.get('item_name') for item in all_items]
    least_ordered_items = []
    for item in all_items:
        item_name = item.get('item_name')
        order_count = item_order_counts.get(item_name, 0)
        least_ordered_items.append({'item_name': item_name, 'item_code': item.get('item_code', ''), 'order_count': order_count})
    
    least_ordered_items.sort(key=lambda x: x['order_count'])
    least_ordered_items = least_ordered_items[:10]
    
    # Items with no orders in 30+ days
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    recent_order_items = await db.orders.aggregate([
        {'$match': {'created_at': {'$gte': thirty_days_ago}}},
        {'$unwind': '$items'},
        {'$group': {'_id': '$items.item_name'}}
    ]).to_list(1000)
    recently_ordered_names = {item['_id'] for item in recent_order_items if item['_id']}
    
    stale_items = []
    for item in all_items:
        item_name = item.get('item_name')
        if item_name and item_name not in recently_ordered_names:
            stale_items.append({'item_name': item_name, 'item_code': item.get('item_code', '')})
    
    # ============== SUPPORT TICKETS STATS ==============
    ticket_statuses = ['open', 'in_progress', 'resolved', 'closed']
    ticket_status_pipeline = [{'$group': {'_id': '$status', 'count': {'$sum': 1}}}]
    ticket_status_counts = await db.support_tickets.aggregate(ticket_status_pipeline).to_list(100)
    tickets_by_status = {item['_id']: item['count'] for item in ticket_status_counts if item['_id']}
    for status in ticket_statuses:
        if status not in tickets_by_status:
            tickets_by_status[status] = 0
    total_tickets = sum(tickets_by_status.values())
    
    # Recent tickets (last 7 days)
    recent_tickets = await db.support_tickets.count_documents({'created_at': {'$gte': seven_days_ago}})
    
    return {
        'customers': {
            'doctors': {
                'total': total_doctors,
                'by_status': doctors_by_status
            },
            'medicals': {
                'total': total_medicals,
                'by_status': medicals_by_status
            },
            'agencies': {
                'total': total_agencies,
                'by_status': agencies_by_status
            },
            'combined_by_status': combined_by_status,
            'total_all': total_doctors + total_medicals + total_agencies
        },
        'orders': {
            'total': total_orders,
            'by_status': orders_by_status,
            'recent_7_days': recent_orders
        },
        'pending_items': {
            'total_items': len(pending_items),
            'total_quantity': total_pending_qty,
            'by_item': pending_by_item_sorted
        },
        'expenses': {
            'current_month_total': round(current_month_total, 2),
            'previous_month_total': round(previous_month_total, 2),
            'change_percent': round(((current_month_total - previous_month_total) / previous_month_total * 100) if previous_month_total > 0 else 0, 1),
            'by_category': expenses_by_category,
            'by_payment_type': expenses_by_payment
        },
        'items': {
            'total': total_items,
            'by_main_category': main_category_stats,
            'by_subcategory': subcategory_stats,
            'most_ordered': most_ordered_items,
            'least_ordered': least_ordered_items,
            'no_orders_30_days': stale_items[:20],
            'stale_count': len(stale_items)
        },
        'support_tickets': {
            'total': total_tickets,
            'by_status': tickets_by_status,
            'recent_7_days': recent_tickets
        }
    }


# ============== ANALYTICS REPORTS ==============

@router.get("/analytics/reports")
async def get_analytics_reports(period: str = "6months", current_user: dict = Depends(get_current_user)):
    """Comprehensive analytics reports with time-series data for charts"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can view analytics")

    now = datetime.now(timezone.utc)
    period_map = {'1month': 30, '3months': 90, '6months': 180, '1year': 365}
    days = period_map.get(period, 180)
    start_date = (now - timedelta(days=days)).isoformat()

    # ---- REVENUE & ORDERS OVER TIME (monthly) ----
    monthly_pipeline = [
        {'$match': {'created_at': {'$gte': start_date}}},
        {'$addFields': {'month': {'$substr': ['$created_at', 0, 7]}}},
        {'$unwind': {'path': '$items', 'preserveNullAndEmptyArrays': True}},
        {'$addFields': {
            'item_revenue': {'$multiply': [
                {'$ifNull': ['$items.rate', 0]},
                {'$convert': {'input': {'$ifNull': ['$items.quantity', '1']}, 'to': 'double', 'onError': 1, 'onNull': 1}}
            ]}
        }},
        {'$group': {
            '_id': '$month',
            'order_ids': {'$addToSet': '$id'},
            'total_revenue': {'$sum': '$item_revenue'},
        }},
        {'$addFields': {'order_count': {'$size': '$order_ids'}}},
        {'$project': {'_id': 1, 'order_count': 1, 'total_revenue': 1, 'avg_value': {'$cond': [{'$gt': ['$order_count', 0]}, {'$divide': ['$total_revenue', '$order_count']}, 0]}}},
        {'$sort': {'_id': 1}}
    ]
    monthly_data = await db.orders.aggregate(monthly_pipeline).to_list(24)
    orders_over_time = [{'month': m['_id'], 'orders': m['order_count'], 'revenue': round(m['total_revenue'], 2), 'avg_value': round(m['avg_value'], 2)} for m in monthly_data]

    # ---- ORDER STATUS DISTRIBUTION ----
    status_pipeline = [{'$group': {'_id': '$status', 'count': {'$sum': 1}}}]
    status_data = await db.orders.aggregate(status_pipeline).to_list(20)
    order_status_dist = [{'status': s['_id'] or 'unknown', 'count': s['count']} for s in status_data]

    # ---- TOP PRODUCTS BY QTY (confirmed orders only: rate * qty = value) ----
    confirmed_statuses = ['confirmed', 'ready_to_despatch', 'shipped', 'delivered', 'transferred']
    product_pipeline = [
        {'$match': {'created_at': {'$gte': start_date}, 'status': {'$in': confirmed_statuses}}},
        {'$unwind': '$items'},
        {'$addFields': {
            'qty_num': {'$convert': {'input': {'$ifNull': ['$items.quantity', '1']}, 'to': 'double', 'onError': 1, 'onNull': 1}},
        }},
        {'$addFields': {'item_value': {'$multiply': ['$qty_num', {'$ifNull': ['$items.rate', 0]}]}}},
        {'$group': {
            '_id': '$items.item_name',
            'item_code': {'$first': '$items.item_code'},
            'total_qty': {'$sum': '$qty_num'},
            'total_value': {'$sum': '$item_value'},
            'avg_rate': {'$avg': {'$ifNull': ['$items.rate', 0]}},
            'order_count': {'$sum': 1}
        }},
        {'$sort': {'total_qty': -1}},
        {'$limit': 20}
    ]
    try:
        product_data = await db.orders.aggregate(product_pipeline).to_list(20)
    except Exception:
        product_pipeline_simple = [
            {'$match': {'created_at': {'$gte': start_date}, 'status': {'$in': confirmed_statuses}}},
            {'$unwind': '$items'},
            {'$group': {'_id': '$items.item_name', 'item_code': {'$first': '$items.item_code'}, 'order_count': {'$sum': 1}}},
            {'$sort': {'order_count': -1}},
            {'$limit': 20}
        ]
        product_data = await db.orders.aggregate(product_pipeline_simple).to_list(20)
    top_products = [{'name': p['_id'] or 'Unknown', 'code': p.get('item_code', ''), 'qty': int(p.get('total_qty', 0)), 'value': round(p.get('total_value', 0), 2), 'avg_rate': round(p.get('avg_rate', 0), 2), 'orders': p.get('order_count', 0)} for p in product_data]

    # ---- SLOW MOVERS (items with 0 or very few confirmed orders) ----
    all_items = await db.items.find({'is_hidden': {'$ne': True}}, {'_id': 0, 'id': 1, 'item_name': 1, 'item_code': 1}).to_list(5000)
    ordered_items_pipeline = [
        {'$match': {'created_at': {'$gte': start_date}, 'status': {'$in': confirmed_statuses}}},
        {'$unwind': '$items'},
        {'$addFields': {'qty_num': {'$convert': {'input': {'$ifNull': ['$items.quantity', '1']}, 'to': 'double', 'onError': 1, 'onNull': 1}}}},
        {'$group': {'_id': '$items.item_name', 'total_qty': {'$sum': '$qty_num'}, 'count': {'$sum': 1}}}
    ]
    ordered_items = await db.orders.aggregate(ordered_items_pipeline).to_list(5000)
    ordered_map = {o['_id']: {'count': o['count'], 'qty': int(o.get('total_qty', 0))} for o in ordered_items if o['_id']}
    slow_movers = []
    for item in all_items:
        n = item.get('item_name')
        info = ordered_map.get(n, {'count': 0, 'qty': 0})
        slow_movers.append({'name': n, 'code': item.get('item_code', ''), 'orders': info['count'], 'qty': info['qty']})
    slow_movers.sort(key=lambda x: x['qty'])
    slow_movers = slow_movers[:15]

    # ---- TOP DOCTORS BY REVENUE ----
    doctor_rev_pipeline = [
        {'$match': {'created_at': {'$gte': start_date}, 'doctor_type': {'$in': ['doctor', None]}}},
        {'$unwind': '$items'},
        {'$addFields': {'item_rev': {'$multiply': [{'$ifNull': ['$items.rate', 0]}, {'$convert': {'input': {'$ifNull': ['$items.quantity', '1']}, 'to': 'double', 'onError': 1, 'onNull': 1}}]}}},
        {'$group': {
            '_id': '$doctor_id',
            'name': {'$first': '$doctor_name'},
            'total_revenue': {'$sum': '$item_rev'},
            'order_ids': {'$addToSet': '$id'}
        }},
        {'$addFields': {'order_count': {'$size': '$order_ids'}}},
        {'$sort': {'total_revenue': -1}},
        {'$limit': 10}
    ]
    top_doctors_data = await db.orders.aggregate(doctor_rev_pipeline).to_list(10)
    top_doctors = [{'id': d['_id'], 'name': d.get('name', 'Unknown'), 'revenue': round(d['total_revenue'], 2), 'orders': d['order_count']} for d in top_doctors_data]

    # ---- TOP MEDICALS BY REVENUE ----
    medical_rev_pipeline = [
        {'$match': {'created_at': {'$gte': start_date}, 'doctor_type': 'medical'}},
        {'$unwind': '$items'},
        {'$addFields': {'item_rev': {'$multiply': [{'$ifNull': ['$items.rate', 0]}, {'$convert': {'input': {'$ifNull': ['$items.quantity', '1']}, 'to': 'double', 'onError': 1, 'onNull': 1}}]}}},
        {'$group': {
            '_id': '$doctor_id',
            'name': {'$first': '$doctor_name'},
            'total_revenue': {'$sum': '$item_rev'},
            'order_ids': {'$addToSet': '$id'}
        }},
        {'$addFields': {'order_count': {'$size': '$order_ids'}}},
        {'$sort': {'total_revenue': -1}},
        {'$limit': 10}
    ]
    top_medicals_data = await db.orders.aggregate(medical_rev_pipeline).to_list(10)
    top_medicals = [{'id': m['_id'], 'name': m.get('name', 'Unknown'), 'revenue': round(m['total_revenue'], 2), 'orders': m['order_count']} for m in top_medicals_data]

    # ---- TOP AGENCIES BY REVENUE ----
    agency_rev_pipeline = [
        {'$match': {'created_at': {'$gte': start_date}, 'doctor_type': 'agency'}},
        {'$unwind': '$items'},
        {'$addFields': {'item_rev': {'$multiply': [{'$ifNull': ['$items.rate', 0]}, {'$convert': {'input': {'$ifNull': ['$items.quantity', '1']}, 'to': 'double', 'onError': 1, 'onNull': 1}}]}}},
        {'$group': {
            '_id': '$doctor_id',
            'name': {'$first': '$doctor_name'},
            'total_revenue': {'$sum': '$item_rev'},
            'order_ids': {'$addToSet': '$id'}
        }},
        {'$addFields': {'order_count': {'$size': '$order_ids'}}},
        {'$sort': {'total_revenue': -1}},
        {'$limit': 10}
    ]
    top_agencies_data = await db.orders.aggregate(agency_rev_pipeline).to_list(10)
    top_agencies = [{'id': a['_id'], 'name': a.get('name', 'Unknown'), 'revenue': round(a['total_revenue'], 2), 'orders': a['order_count']} for a in top_agencies_data]

    # ---- FREQUENT ORDERERS (ordered 3+ times in period) ----
    freq_pipeline = [
        {'$match': {'created_at': {'$gte': start_date}}},
        {'$unwind': '$items'},
        {'$addFields': {'item_rev': {'$multiply': [{'$ifNull': ['$items.rate', 0]}, {'$convert': {'input': {'$ifNull': ['$items.quantity', '1']}, 'to': 'double', 'onError': 1, 'onNull': 1}}]}}},
        {'$group': {
            '_id': '$doctor_id',
            'name': {'$first': '$doctor_name'},
            'type': {'$first': '$doctor_type'},
            'total_revenue': {'$sum': '$item_rev'},
            'order_ids': {'$addToSet': '$id'},
            'last_order': {'$max': '$created_at'}
        }},
        {'$addFields': {'order_count': {'$size': '$order_ids'}}},
        {'$match': {'order_count': {'$gte': 3}}},
        {'$sort': {'order_count': -1}},
        {'$limit': 15}
    ]
    frequent_data = await db.orders.aggregate(freq_pipeline).to_list(15)
    frequent_orderers = [{'id': f['_id'], 'name': f.get('name', 'Unknown'), 'type': f.get('type', 'doctor'), 'orders': f['order_count'], 'revenue': round(f['total_revenue'], 2), 'last_order': f.get('last_order', '')} for f in frequent_data]

    # ---- DORMANT CUSTOMERS (had orders before but none in last X days) ----
    dormant_days_list = [30, 60, 90]
    dormant_data = {}
    # Pre-compute all orderers with revenue from items
    all_orderers = await db.orders.aggregate([
        {'$unwind': '$items'},
        {'$addFields': {'item_rev': {'$multiply': [{'$ifNull': ['$items.rate', 0]}, {'$convert': {'input': {'$ifNull': ['$items.quantity', '1']}, 'to': 'double', 'onError': 1, 'onNull': 1}}]}}},
        {'$group': {'_id': '$doctor_id', 'name': {'$first': '$doctor_name'}, 'type': {'$first': '$doctor_type'}, 'phone': {'$first': '$doctor_phone'}, 'last_order': {'$max': '$created_at'}, 'order_ids': {'$addToSet': '$id'}, 'total_revenue': {'$sum': '$item_rev'}}},
        {'$addFields': {'total_orders': {'$size': '$order_ids'}}}
    ]).to_list(5000)

    # Build contact info lookup from entity collections
    contact_lookup = {}
    for coll_name in ['doctors', 'medicals', 'agencies']:
        entities = await db[coll_name].find({}, {'_id': 0, 'id': 1, 'name': 1, 'phone': 1, 'email': 1, 'city': 1, 'address': 1, 'status': 1}).to_list(5000)
        for e in entities:
            contact_lookup[e.get('id')] = {'phone': e.get('phone', ''), 'email': e.get('email', ''), 'city': e.get('city', ''), 'address': e.get('address', ''), 'status': e.get('status', '')}

    for d_days in dormant_days_list:
        cutoff = (now - timedelta(days=d_days)).isoformat()
        dormant_list = []
        for o in all_orderers:
            lo = o.get('last_order', '')
            if lo and lo < cutoff and o['total_orders'] > 0:
                contact = contact_lookup.get(o['_id'], {})
                dormant_list.append({
                    'id': o['_id'], 'name': o.get('name', 'Unknown'), 'type': o.get('type', 'doctor'),
                    'phone': contact.get('phone') or o.get('phone', ''),
                    'email': contact.get('email', ''), 'city': contact.get('city', ''),
                    'address': contact.get('address', ''), 'status': contact.get('status', ''),
                    'last_order': lo, 'total_orders': o['total_orders'], 'revenue': round(o['total_revenue'], 2)
                })
        dormant_list.sort(key=lambda x: x['last_order'])
        dormant_data[f'{d_days}_days'] = dormant_list[:20]

    # ---- ORDERS BY DAY OF WEEK ----
    dow_pipeline = [
        {'$match': {'created_at': {'$gte': start_date}}},
        {'$addFields': {'dow': {'$dayOfWeek': {'$dateFromString': {'dateString': '$created_at', 'onError': now}}}}},
        {'$group': {'_id': '$dow', 'count': {'$sum': 1}}},
        {'$sort': {'_id': 1}}
    ]
    try:
        dow_data = await db.orders.aggregate(dow_pipeline).to_list(7)
        day_names = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        orders_by_day = [{'day': day_names[d['_id']] if d['_id'] < len(day_names) else str(d['_id']), 'orders': d['count']} for d in dow_data]
    except Exception:
        orders_by_day = []

    # ---- CUSTOMER ENTITY COUNTS ----
    entity_counts = {
        'doctors': await db.doctors.count_documents({}),
        'medicals': await db.medicals.count_documents({}),
        'agencies': await db.agencies.count_documents({})
    }

    # ---- PAYMENT MODE DISTRIBUTION ----
    payment_pipeline = [
        {'$match': {'created_at': {'$gte': start_date}}},
        {'$group': {'_id': '$payment_mode', 'count': {'$sum': 1}, 'total': {'$sum': {'$ifNull': ['$amount', 0]}}}},
        {'$sort': {'total': -1}}
    ]
    payment_data = await db.payments.aggregate(payment_pipeline).to_list(20)
    payment_modes = [{'mode': p['_id'] or 'Unknown', 'count': p['count'], 'total': round(p['total'], 2)} for p in payment_data]

    # ---- SUMMARY TOTALS ----
    total_revenue = sum(m.get('revenue', 0) for m in orders_over_time)
    total_orders = await db.orders.count_documents({'created_at': {'$gte': start_date}})
    total_payments = sum(p['total'] for p in payment_modes)

    return {
        'period': period,
        'summary': {
            'total_revenue': round(total_revenue, 2),
            'total_orders': total_orders,
            'total_payments': round(total_payments, 2),
            'total_customers': entity_counts['doctors'] + entity_counts['medicals'] + entity_counts['agencies'],
            'entity_counts': entity_counts
        },
        'orders_over_time': orders_over_time,
        'order_status_distribution': order_status_dist,
        'orders_by_day_of_week': orders_by_day,
        'top_products': top_products,
        'slow_movers': slow_movers,
        'top_doctors': top_doctors,
        'top_medicals': top_medicals,
        'top_agencies': top_agencies,
        'frequent_orderers': frequent_orderers,
        'dormant_customers': dormant_data,
        'payment_modes': payment_modes,
    }




