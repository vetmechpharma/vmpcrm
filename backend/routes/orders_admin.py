from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import ManualOrderCreate, OrderResponse, OrderStatusUpdate, OrderItemsUpdate, OrderCustomerUpdate, OrderItem
from utils.whatsapp import get_whatsapp_config, send_wa_msg, log_whatsapp_message
from utils.email_utils import send_notification_email
from utils.templates import render_wa_template, get_company_short_name
from utils.push import send_push_to_user, send_push_to_admins
from utils.notifications import (send_whatsapp_order, send_order_confirmation_email,
    send_whatsapp_out_of_stock, send_whatsapp_status_update, send_whatsapp_ready_to_despatch,
    send_order_status_email)
from routes.expenses import ensure_default_categories

router = APIRouter(prefix="/api")

# ============== ORDERS ADMIN ROUTES ==============

@router.get("/customers/search")
async def search_customers(q: str, current_user: dict = Depends(get_current_user)):
    """Search across doctors, medicals, and agencies by name or phone"""
    if not q or len(q) < 2:
        return []
    
    search_regex = {'$regex': q, '$options': 'i'}
    results = []
    
    # Search doctors
    doctors = await db.doctors.find({
        '$or': [
            {'name': search_regex},
            {'phone': search_regex},
            {'customer_code': search_regex}
        ]
    }, {'_id': 0}).limit(10).to_list(10)
    
    for doc in doctors:
        results.append({
            'id': doc['id'],
            'name': doc.get('name', ''),
            'phone': doc.get('phone', ''),
            'email': doc.get('email', ''),
            'address': doc.get('address', ''),
            'customer_code': doc.get('customer_code', ''),
            'type': 'doctor',
            'type_label': 'Doctor'
        })
    
    # Search medicals
    medicals = await db.medicals.find({
        '$or': [
            {'name': search_regex},
            {'phone': search_regex},
            {'customer_code': search_regex}
        ]
    }, {'_id': 0}).limit(10).to_list(10)
    
    for med in medicals:
        results.append({
            'id': med['id'],
            'name': med.get('name', ''),
            'phone': med.get('phone', ''),
            'email': med.get('email', ''),
            'address': med.get('address', ''),
            'customer_code': med.get('customer_code', ''),
            'type': 'medical',
            'type_label': 'Medical'
        })
    
    # Search agencies
    agencies = await db.agencies.find({
        '$or': [
            {'name': search_regex},
            {'phone': search_regex},
            {'customer_code': search_regex}
        ]
    }, {'_id': 0}).limit(10).to_list(10)
    
    for agency in agencies:
        results.append({
            'id': agency['id'],
            'name': agency.get('name', ''),
            'phone': agency.get('phone', ''),
            'email': agency.get('email', ''),
            'address': agency.get('address', ''),
            'customer_code': agency.get('customer_code', ''),
            'type': 'agency',
            'type_label': 'Agency'
        })
    
    return results

@router.post("/orders")
async def create_manual_order(order_data: ManualOrderCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Create a new order manually by admin/staff"""
    # Generate order number
    today_str = datetime.now(timezone.utc).strftime('%Y%m%d')
    today_orders = await db.orders.count_documents({
        'order_number': {'$regex': f'^ORD-{today_str}'}
    })
    order_number = f"ORD-{today_str}-{(today_orders + 1):04d}"
    
    order_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Clean phone number
    clean_phone = ''.join(filter(str.isdigit, order_data.customer_phone))
    if len(clean_phone) > 10:
        clean_phone = clean_phone[-10:]
    
    entity_id = order_data.customer_id
    entity_type = order_data.customer_type
    
    # If no customer_id provided, try to find existing or create new
    if not entity_id:
        # Search for existing entity by phone
        collection_map = {
            'doctor': db.doctors,
            'medical': db.medicals,
            'agency': db.agencies
        }
        collection = collection_map.get(entity_type, db.doctors)
        
        existing = await collection.find_one({'phone': {'$regex': clean_phone}}, {'_id': 0})
        
        if existing:
            entity_id = existing['id']
        else:
            # Create new entity
            entity_id = str(uuid.uuid4())
            
            # Generate customer code based on type
            prefix_map = {'doctor': 'VMP', 'medical': 'MED', 'agency': 'AGN'}
            prefix = prefix_map.get(entity_type, 'VMP')
            
            last_entity = await collection.find_one({}, sort=[('customer_code', -1)])
            if last_entity and last_entity.get('customer_code', '').startswith(f'{prefix}-'):
                try:
                    last_num = int(last_entity['customer_code'].split('-')[1])
                    customer_code = f"{prefix}-{last_num + 1:04d}"
                except:
                    customer_code = f"{prefix}-0001"
            else:
                customer_code = f"{prefix}-0001"
            
            entity_doc = {
                'id': entity_id,
                'name': order_data.customer_name,
                'customer_code': customer_code,
                'phone': clean_phone,
                'email': order_data.customer_email or '',
                'address': order_data.customer_address or '',
                'lead_status': 'Customer',
                'priority': 'moderate',
                'created_at': now.isoformat()
            }
            
            # Add reg_no for doctors
            if entity_type == 'doctor':
                entity_doc['reg_no'] = ''
            
            await collection.insert_one(entity_doc)
    
    # Create order
    order_doc = {
        'id': order_id,
        'order_number': order_number,
        'doctor_id': entity_id,  # Keep as doctor_id for backward compatibility
        'customer_type': entity_type,
        'doctor_name': order_data.customer_name,
        'doctor_phone': clean_phone,
        'doctor_email': order_data.customer_email,
        'doctor_address': order_data.customer_address,
        'items': [item.dict() for item in order_data.items],
        'status': 'pending',
        'created_by': current_user['name'],
        'created_by_id': current_user['id'],
        'source': 'admin_panel',
        'created_at': now.isoformat()
    }
    
    await db.orders.insert_one(order_doc)
    
    # Handle pending items (out of stock items)
    if order_data.pending_items and len(order_data.pending_items) > 0:
        for pending_item in order_data.pending_items:
            item_id = pending_item.get('item_id')
            
            # Dedup: Remove existing pending for same customer + item
            await db.pending_items.delete_many({
                'doctor_phone': clean_phone,
                'item_id': item_id
            })
            
            pending_doc = {
                'id': str(uuid.uuid4()),
                'order_id': order_id,
                'original_order_id': order_id,
                'original_order_number': order_number,
                'original_order_date': now.isoformat(),
                'doctor_phone': clean_phone,
                'doctor_name': order_data.customer_name,
                'item_id': item_id,
                'item_code': pending_item.get('item_code'),
                'item_name': pending_item.get('item_name'),
                'quantity': pending_item.get('quantity', '1'),
                'status': 'pending',
                'created_at': now.isoformat()
            }
            await db.pending_items.insert_one(pending_doc)
        
        # Send WhatsApp notification for out of stock items
        background_tasks.add_task(send_whatsapp_out_of_stock, order_doc, order_data.pending_items)
    
    # Send WhatsApp confirmation
    background_tasks.add_task(
        send_whatsapp_order,
        clean_phone,
        order_data.items,
        order_number,
        order_data.customer_name
    )
    
    # Send Email confirmation to customer
    background_tasks.add_task(
        send_order_confirmation_email,
        order_doc,
        [item.dict() for item in order_data.items]
    )
    
    # Push notification to admins for new order
    background_tasks.add_task(
        send_push_to_admins,
        'New Order Received',
        f'Order {order_number} from {order_data.customer_name}',
        '/admin/orders',
        'new-order'
    )
    
    return {
        "message": "Order created successfully",
        "order_number": order_number,
        "order_id": order_id,
        "customer_type": entity_type,
        "customer_id": entity_id,
        "pending_items_count": len(order_data.pending_items) if order_data.pending_items else 0
    }

@router.get("/orders", response_model=List[OrderResponse])
async def get_orders(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query['status'] = status
    
    orders = await db.orders.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    result = []
    for order in orders:
        created_at = order['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        items = [OrderItem(**item) for item in order.get('items', [])]
        
        result.append(OrderResponse(
            id=order['id'],
            order_number=order['order_number'],
            doctor_id=order.get('doctor_id'),
            doctor_name=order.get('doctor_name'),
            doctor_phone=order['doctor_phone'],
            doctor_email=order.get('doctor_email'),
            doctor_address=order.get('doctor_address'),
            items=items,
            status=order['status'],
            transport_id=order.get('transport_id'),
            transport_name=order.get('transport_name'),
            tracking_number=order.get('tracking_number'),
            tracking_url=order.get('tracking_url'),
            delivery_station=order.get('delivery_station'),
            payment_mode=order.get('payment_mode'),
            payment_amount=order.get('payment_amount'),
            expense_paid_by=order.get('expense_paid_by'),
            expense_account=order.get('expense_account'),
            boxes_count=order.get('boxes_count'),
            cans_count=order.get('cans_count'),
            bags_count=order.get('bags_count'),
            invoice_number=order.get('invoice_number'),
            invoice_date=order.get('invoice_date'),
            invoice_value=order.get('invoice_value'),
            cancellation_reason=order.get('cancellation_reason'),
            ip_address=order.get('ip_address'),
            location=order.get('location'),
            device_info=order.get('device_info'),
            created_at=created_at,
            source=order.get('source'),
            mr_id=order.get('mr_id'),
            mr_name=order.get('mr_name'),
            cancel_requested=order.get('cancel_requested'),
            cancel_requested_by=order.get('cancel_requested_by'),
            cancel_reason=order.get('cancel_reason'),
            notes=order.get('notes'),
            customer_type=order.get('customer_type'),
            created_by=order.get('created_by'),
            transferred_to_agency_id=order.get('transferred_to_agency_id'),
            transferred_to_agency_name=order.get('transferred_to_agency_name'),
            transferred_to_agency_phone=order.get('transferred_to_agency_phone'),
            transferred_at=order.get('transferred_at'),
        ))
    
    return result

async def auto_create_transport_expense(order: dict, update_data: dict, current_user: dict):
    """Auto-create an expense entry when order is shipped with 'paid' payment mode"""
    try:
        # Ensure default categories exist
        await ensure_default_categories()
        
        # Find Transport/Shipping category
        transport_category = await db.expense_categories.find_one({'name': 'Transport/Shipping'}, {'_id': 0})
        if not transport_category:
            return  # Skip if category not found
        
        now = datetime.now(timezone.utc)
        transport_name = order.get('transport_name') or update_data.get('transport_name', 'Unknown Transport')
        delivery_station = order.get('delivery_station') or update_data.get('delivery_station', '')
        order_number = order.get('order_number', 'N/A')
        
        # Use payment_amount for expense, fallback to invoice_value for backward compatibility
        payment_amount = update_data.get('payment_amount') or order.get('payment_amount') or order.get('invoice_value', 0)
        expense_paid_by = update_data.get('expense_paid_by') or order.get('expense_paid_by')
        expense_account = update_data.get('expense_account') or order.get('expense_account', 'company_account')
        
        if not payment_amount or payment_amount <= 0:
            logger.info(f"Skipping expense creation for order {order_number} - no payment amount")
            return
        
        # Check if expense already exists for this order
        existing = await db.expenses.find_one({'order_id': order['id'], 'is_auto_generated': True}, {'_id': 0})
        if existing:
            return  # Don't create duplicate
        
        expense_doc = {
            'id': str(uuid.uuid4()),
            'category_id': transport_category['id'],
            'category_name': transport_category['name'],
            'date': now.strftime('%Y-%m-%d'),
            'amount': payment_amount,
            'payment_type': 'cash' if expense_account == 'cash' else 'net_banking',
            'payment_account': expense_account or 'company_account',
            'paid_by': expense_paid_by,
            'reason': f'Transport for Order #{order_number} via {transport_name}',
            'transport_id': order.get('transport_id'),
            'transport_name': transport_name,
            'transport_location': delivery_station,
            'order_id': order['id'],
            'order_number': order_number,
            'is_auto_generated': True,
            'created_at': now.isoformat(),
            'updated_at': now.isoformat(),
            'created_by': current_user['id']
        }
        
        await db.expenses.insert_one(expense_doc)
        logger.info(f"Auto-created transport expense ₹{payment_amount} for order {order_number}")
    except Exception as e:
        logger.error(f"Failed to auto-create transport expense: {str(e)}")

@router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status_data: OrderStatusUpdate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Update order status with optional transport details (for ready_to_despatch/shipped) or cancellation reason"""
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    new_status = status_data.status
    update_data = {
        'status': new_status,
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    # Add transport/shipping details if status is 'ready_to_despatch'
    if new_status == 'ready_to_despatch':
        if status_data.transport_id:
            update_data['transport_id'] = status_data.transport_id
        if status_data.transport_name:
            update_data['transport_name'] = status_data.transport_name
        if status_data.delivery_station:
            update_data['delivery_station'] = status_data.delivery_station
        if status_data.payment_mode:
            update_data['payment_mode'] = status_data.payment_mode
        # Payment amount (for both to_pay and paid)
        if status_data.payment_amount is not None:
            update_data['payment_amount'] = status_data.payment_amount
        # Expense details (only relevant for 'paid' mode)
        if status_data.expense_paid_by:
            update_data['expense_paid_by'] = status_data.expense_paid_by
        if status_data.expense_account:
            update_data['expense_account'] = status_data.expense_account
        # Package counts
        if status_data.boxes_count is not None:
            update_data['boxes_count'] = status_data.boxes_count
        if status_data.cans_count is not None:
            update_data['cans_count'] = status_data.cans_count
        if status_data.bags_count is not None:
            update_data['bags_count'] = status_data.bags_count
        # Invoice details
        if status_data.invoice_number:
            update_data['invoice_number'] = status_data.invoice_number
        if status_data.invoice_date:
            update_data['invoice_date'] = status_data.invoice_date
        if status_data.invoice_value is not None:
            update_data['invoice_value'] = status_data.invoice_value
    
    # Only add tracking number if status is 'shipped'
    if new_status == 'shipped':
        if status_data.tracking_number:
            update_data['tracking_number'] = status_data.tracking_number
        if status_data.tracking_url:
            update_data['tracking_url'] = status_data.tracking_url
        # Also update transport if provided (for cases where ready_to_despatch was skipped)
        if status_data.transport_id:
            update_data['transport_id'] = status_data.transport_id
        if status_data.transport_name:
            update_data['transport_name'] = status_data.transport_name
        
        # Auto-create expense for shipped orders with 'paid' payment mode
        payment_mode = order.get('payment_mode') or update_data.get('payment_mode', '')
        payment_amount = order.get('payment_amount') or update_data.get('payment_amount', 0)
        if payment_mode == 'paid' and payment_amount > 0:
            await auto_create_transport_expense(order, update_data, current_user)
    
    # Only add cancellation reason if status is 'cancelled'
    if new_status == 'cancelled' and status_data.cancellation_reason:
        update_data['cancellation_reason'] = status_data.cancellation_reason
    
    await db.orders.update_one({'id': order_id}, {'$set': update_data})
    
    # Send WhatsApp notification for status change
    if new_status in ['confirmed', 'ready_to_despatch', 'shipped', 'delivered', 'cancelled']:
        # For ready_to_despatch, we need to send to both transporter and customer
        if new_status == 'ready_to_despatch':
            background_tasks.add_task(send_whatsapp_ready_to_despatch, order, update_data)
        else:
            background_tasks.add_task(send_whatsapp_status_update, order, new_status, update_data)
        # Send email notification for all status changes
        background_tasks.add_task(send_order_status_email, order, new_status, update_data)
    
    # Send push notification to customer
    status_labels = {'confirmed': 'Confirmed', 'processing': 'Processing', 'ready_to_despatch': 'Ready to Dispatch', 'shipped': 'Dispatched', 'delivered': 'Delivered', 'cancelled': 'Cancelled'}
    status_label = status_labels.get(new_status, new_status.title())
    doctor_id = order.get('doctor_id')
    if doctor_id:
        # Find portal customer linked to this doctor
        portal_customer = await db.portal_customers.find_one({'linked_record_id': doctor_id}, {'_id': 0, 'id': 1})
        if portal_customer:
            background_tasks.add_task(
                send_push_to_user, portal_customer['id'], 'customer',
                f'Order {status_label}',
                f'Your order {order.get("order_number", "")} is now {status_label}',
                f'/orders', f'order-{new_status}'
            )
    
    return {"message": f"Order status updated to {new_status}"}


@router.post("/orders/{order_id}/transfer")
async def transfer_order_to_agency(
    order_id: str,
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Transfer an order to an agency - sends WhatsApp to agency and customer"""
    agency_id = data.get('agency_id')
    if not agency_id:
        raise HTTPException(status_code=400, detail="Agency ID required")
    
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    agency = await db.agencies.find_one({'id': agency_id}, {'_id': 0})
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")
    
    now = datetime.now(timezone.utc)
    await db.orders.update_one({'id': order_id}, {'$set': {
        'status': 'transferred',
        'transferred_to_agency_id': agency_id,
        'transferred_to_agency_name': agency['name'],
        'transferred_to_agency_phone': agency.get('phone', ''),
        'transferred_at': now.isoformat(),
        'updated_at': now.isoformat(),
    }})
    
    # Build items summary
    items_summary = ""
    for item in order.get('items', []):
        items_summary += f"- {item.get('item_name', '')} x {item.get('quantity', '')}\n"
    
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = (company or {}).get('company_name', 'VMP CRM')
    
    # WhatsApp to Agency - Doctor/Medical details + order info
    cust_name = order.get('doctor_name', '')
    cust_phone = order.get('doctor_phone', '')
    cust_type = (order.get('customer_type', 'doctor')).title()
    cust_address = order.get('doctor_address', '')
    
    agency_msg = (
        f"*{company_name}*\n"
        f"*ORDER TRANSFER*\n"
        f"{'─' * 28}\n"
        f"Order No: {order.get('order_number', '')}\n"
        f"{'─' * 28}\n"
        f"*{cust_type} Details:*\n"
        f"Name: {cust_name}\n"
        f"Phone: {cust_phone}\n"
    )
    if cust_address:
        agency_msg += f"Location: {cust_address}\n"
    
    agency_msg += (
        f"{'─' * 28}\n"
        f"*Order Items:*\n"
        f"{items_summary}"
        f"{'─' * 28}\n"
        f"Please process this order.\n"
    )
    
    # WhatsApp to Customer - confirmation with agency info
    customer_msg = (
        f"*{company_name}*\n\n"
        f"Your order *{order.get('order_number', '')}* has been successfully placed at:\n\n"
        f"*{agency['name']}*\n"
        f"Contact: {agency.get('phone', '')}\n\n"
        f"*Order Details:*\n"
        f"{items_summary}\n"
        f"Thank you for your order!\n"
    )
    
    config = await get_whatsapp_config()
    if config and config.get('api_url') and config.get('auth_token'):
        # Send to agency
        agency_phone = agency.get('phone', '')
        if agency_phone:
            wa_agency = agency_phone if agency_phone.startswith('91') else f"91{agency_phone[-10:]}"
            background_tasks.add_task(send_wa_msg, wa_agency, agency_msg, None, None, config)
        
        # Send to customer
        if cust_phone:
            wa_cust = cust_phone if cust_phone.startswith('91') else f"91{cust_phone[-10:]}"
            background_tasks.add_task(send_wa_msg, wa_cust, customer_msg, None, None, config)
    
    # Send email to customer
    cust_email = order.get('doctor_email', '')
    if cust_email:
        email_body = f"""<p>Dear <strong>{cust_name}</strong>,</p>
<p>Your order <strong>{order.get('order_number', '')}</strong> has been placed at:</p>
<div style="background:#f0fdf4;padding:16px;border-radius:6px;border-left:4px solid #10b981;margin:16px 0;">
<p style="margin:0;font-weight:bold;">{agency['name']}</p>
<p style="margin:4px 0 0 0;">Contact: {agency.get('phone', '')}</p></div>
<p><strong>Items:</strong></p><ul>{''.join(f"<li>{item.get('item_name','')} x {item.get('quantity','')}</li>" for item in order.get('items', []))}</ul>"""
        background_tasks.add_task(send_notification_email, cust_email, cust_name, f"Order Transferred - {order.get('order_number','')}", email_body, order.get('doctor_id'), 'order_transfer')
    
    return {"message": f"Order transferred to {agency['name']}"}


# Keep legacy endpoint for backward compatibility
@router.put("/orders/{order_id}/transport")
async def update_order_transport(order_id: str, transport_data: OrderStatusUpdate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Legacy endpoint - redirects to status update"""
    return await update_order_status(order_id, transport_data, background_tasks, current_user)

@router.delete("/orders/{order_id}")
async def delete_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an order (admin only or with delete_orders permission)"""
    if current_user.get('role') != 'admin':
        perms = current_user.get('permissions', {})
        if not perms.get('delete_orders', False):
            raise HTTPException(status_code=403, detail="You don't have permission to delete orders")
    
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await db.orders.delete_one({'id': order_id})
    return {"message": "Order deleted successfully"}

@router.put("/orders/{order_id}/items")
async def update_order_items(order_id: str, update_data: OrderItemsUpdate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):

    """Update order items and optionally create pending items for removed items"""
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update order items
    items_data = [item.dict() for item in update_data.items]
    await db.orders.update_one(
        {'id': order_id},
        {'$set': {
            'items': items_data,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create pending items if any and send WhatsApp notification
    if update_data.pending_items and len(update_data.pending_items) > 0:
        now = datetime.now(timezone.utc)
        order_date = order.get('created_at')
        if isinstance(order_date, str):
            order_date = datetime.fromisoformat(order_date.replace('Z', '+00:00'))
        
        for pending_item in update_data.pending_items:
            doctor_phone = order.get('doctor_phone')
            item_id = pending_item.get('item_id')
            
            # Dedup: Remove existing pending for same customer + item
            await db.pending_items.delete_many({
                'doctor_phone': doctor_phone,
                'item_id': item_id
            })
            
            pending_doc = {
                'id': str(uuid.uuid4()),
                'doctor_phone': doctor_phone,
                'doctor_name': order.get('doctor_name'),
                'item_id': item_id,
                'item_code': pending_item.get('item_code'),
                'item_name': pending_item.get('item_name'),
                'quantity': pending_item.get('quantity'),
                'original_order_id': order_id,
                'original_order_number': order.get('order_number'),
                'original_order_date': order_date.isoformat() if isinstance(order_date, datetime) else order_date,
                'created_at': now.isoformat()
            }
            await db.pending_items.insert_one(pending_doc)
        
        # Send WhatsApp notification for out of stock items
        background_tasks.add_task(send_whatsapp_out_of_stock, order, update_data.pending_items)
    
    return {"message": "Order items updated successfully"}

@router.put("/orders/{order_id}/customer")
async def update_order_customer(order_id: str, customer_data: OrderCustomerUpdate, current_user: dict = Depends(get_current_user)):
    """Update customer/doctor information for an order"""
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    if customer_data.doctor_name:
        update_data['doctor_name'] = customer_data.doctor_name
    if customer_data.doctor_email:
        update_data['doctor_email'] = customer_data.doctor_email
    if customer_data.doctor_address:
        update_data['doctor_address'] = customer_data.doctor_address
    if customer_data.doctor_phone:
        update_data['doctor_phone'] = customer_data.doctor_phone
    
    # Update the order
    await db.orders.update_one({'id': order_id}, {'$set': update_data})
    
    # Also update pending items for this customer if phone changed
    old_phone = order.get('doctor_phone')
    new_phone = customer_data.doctor_phone or old_phone
    new_name = customer_data.doctor_name or order.get('doctor_name')
    
    if old_phone:
        await db.pending_items.update_many(
            {'doctor_phone': old_phone},
            {'$set': {'doctor_phone': new_phone, 'doctor_name': new_name}}
        )
    
    # If link_to_doctor is true, find or create doctor record
    if customer_data.link_to_doctor:
        phone = new_phone or old_phone
        existing_doctor = await db.doctors.find_one({'phone': phone}, {'_id': 0})
        
        if existing_doctor:
            # Update existing doctor
            doctor_update = {}
            if new_name:
                doctor_update['name'] = new_name
            if customer_data.doctor_email:
                doctor_update['email'] = customer_data.doctor_email
            if customer_data.doctor_address:
                doctor_update['address'] = customer_data.doctor_address
            
            if doctor_update:
                await db.doctors.update_one({'phone': phone}, {'$set': doctor_update})
            
            # Link order to doctor
            await db.orders.update_one({'id': order_id}, {'$set': {'doctor_id': existing_doctor['id']}})
            
            return {"message": "Customer info updated and linked to existing doctor", "doctor_id": existing_doctor['id']}
        else:
            # Create new doctor
            count = await db.doctors.count_documents({})
            customer_code = f"VMP-{str(count + 1).zfill(4)}"
            
            new_doctor = {
                'id': str(uuid.uuid4()),
                'name': new_name or 'Unknown',
                'reg_no': '',
                'address': customer_data.doctor_address or '',
                'email': customer_data.doctor_email or '',
                'phone': phone,
                'dob': None,
                'lead_status': 'Customer',
                'customer_code': customer_code,
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            
            await db.doctors.insert_one(new_doctor)
            await db.orders.update_one({'id': order_id}, {'$set': {'doctor_id': new_doctor['id']}})
            
            return {"message": "Customer info updated and new doctor created", "doctor_id": new_doctor['id'], "customer_code": customer_code}
    
    return {"message": "Customer info updated successfully"}

@router.get("/orders/{order_id}/lookup-doctor")
async def lookup_doctor_for_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Look up existing doctor by order's phone number"""
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    phone = order.get('doctor_phone')
    if not phone:
        return {"found": False, "doctor": None}
    
    # Clean phone number - get last 10 digits
    clean_phone = ''.join(filter(str.isdigit, phone))[-10:]
    
    # Search for doctor with matching phone
    doctor = await db.doctors.find_one(
        {'phone': {'$regex': clean_phone}},
        {'_id': 0}
    )
    
    if doctor:
        return {"found": True, "doctor": doctor}
    
    return {"found": False, "doctor": None}


