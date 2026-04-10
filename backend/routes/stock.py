"""Stock & Inventory Management Routes.

Handles: Suppliers, Opening Balances, Purchases, Returns, Stock calculations, Ledgers.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from deps import db, get_current_user, logger
from datetime import datetime, timezone
from bson import ObjectId
import uuid

router = APIRouter(prefix="/api")

# ============== SUPPLIER MANAGEMENT ==============

@router.get("/suppliers")
async def get_suppliers(user=Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {'_id': 0}).sort('name', 1).to_list(1000)
    return suppliers

@router.post("/suppliers")
async def create_supplier(data: dict, user=Depends(get_current_user)):
    if not data.get('name'):
        raise HTTPException(status_code=400, detail="Supplier name is required")
    supplier = {
        'id': str(uuid.uuid4()),
        'name': data['name'].strip(),
        'mobile': data.get('mobile', '').strip(),
        'address': data.get('address', '').strip(),
        'gst_number': data.get('gst_number', '').strip(),
        'status': 'active',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'created_by': user.get('email', '')
    }
    await db.suppliers.insert_one(supplier)
    supplier.pop('_id', None)
    return supplier

@router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, data: dict, user=Depends(get_current_user)):
    update = {}
    for field in ['name', 'mobile', 'address', 'gst_number', 'status']:
        if field in data:
            update[field] = data[field].strip() if isinstance(data[field], str) else data[field]
    update['updated_at'] = datetime.now(timezone.utc).isoformat()
    result = await db.suppliers.update_one({'id': supplier_id}, {'$set': update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"message": "Supplier updated"}

@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, user=Depends(get_current_user)):
    # Check if supplier has purchases
    has_purchases = await db.stock_transactions.find_one({'supplier_id': supplier_id})
    if has_purchases:
        raise HTTPException(status_code=400, detail="Cannot delete supplier with existing purchases. Deactivate instead.")
    await db.suppliers.delete_one({'id': supplier_id})
    return {"message": "Supplier deleted"}


# ============== OPENING BALANCE ==============

@router.get("/stock/opening-balances")
async def get_opening_balances(user=Depends(get_current_user)):
    balances = await db.opening_balances.find({}, {'_id': 0}).to_list(5000)
    return balances

@router.post("/stock/opening-balance")
async def set_opening_balance(data: dict, user=Depends(get_current_user)):
    item_id = data.get('item_id')
    quantity = data.get('quantity', 0)
    balance_date = data.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d'))
    
    if not item_id:
        raise HTTPException(status_code=400, detail="Item ID is required")
    
    try:
        quantity = float(quantity)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid quantity")
    
    # Upsert opening balance for this item
    await db.opening_balances.update_one(
        {'item_id': item_id},
        {'$set': {
            'item_id': item_id,
            'quantity': quantity,
            'date': balance_date,
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'updated_by': user.get('email', '')
        }},
        upsert=True
    )
    return {"message": "Opening balance set", "item_id": item_id, "quantity": quantity}

@router.post("/stock/opening-balance/bulk")
async def set_opening_balance_bulk(data: dict, user=Depends(get_current_user)):
    items = data.get('items', [])
    fallback_date = data.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d'))
    updated = 0
    for item in items:
        item_id = item.get('item_id')
        quantity = item.get('quantity', 0)
        item_date = item.get('date', fallback_date)
        if not item_id:
            continue
        try:
            quantity = float(quantity)
        except (ValueError, TypeError):
            continue
        await db.opening_balances.update_one(
            {'item_id': item_id},
            {'$set': {
                'item_id': item_id,
                'quantity': quantity,
                'date': item_date,
                'updated_at': datetime.now(timezone.utc).isoformat(),
                'updated_by': user.get('email', '')
            }},
            upsert=True
        )
        updated += 1
    return {"message": f"Opening balance set for {updated} items"}


# ============== PURCHASE ENTRY ==============

@router.get("/stock/purchases")
async def get_purchases(
    user=Depends(get_current_user),
    from_date: str = Query(None),
    to_date: str = Query(None),
    supplier_id: str = Query(None)
):
    query = {'type': 'purchase'}
    if supplier_id:
        query['supplier_id'] = supplier_id
    if from_date or to_date:
        date_filter = {}
        if from_date:
            date_filter['$gte'] = from_date
        if to_date:
            date_filter['$lte'] = to_date
        query['date'] = date_filter
    
    purchases = await db.stock_transactions.find(query, {'_id': 0}).sort('date', -1).to_list(5000)
    return purchases

@router.post("/stock/purchase")
async def create_purchase(data: dict, user=Depends(get_current_user)):
    supplier_id = data.get('supplier_id')
    items = data.get('items', [])
    purchase_date = data.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d'))
    invoice_no = data.get('invoice_no', '').strip()
    notes = data.get('notes', '').strip()
    
    if not supplier_id:
        raise HTTPException(status_code=400, detail="Supplier is required")
    if not items:
        raise HTTPException(status_code=400, detail="At least one item is required")
    
    purchase_id = str(uuid.uuid4())
    transactions = []
    
    for item in items:
        item_id = item.get('item_id')
        quantity = item.get('quantity', 0)
        purchase_rate = item.get('purchase_rate', 0)
        
        if not item_id:
            continue
        try:
            quantity = float(quantity)
            purchase_rate = float(purchase_rate)
        except (ValueError, TypeError):
            continue
        
        txn = {
            'id': str(uuid.uuid4()),
            'purchase_id': purchase_id,
            'type': 'purchase',
            'item_id': item_id,
            'quantity': quantity,
            'rate': purchase_rate,
            'supplier_id': supplier_id,
            'invoice_no': invoice_no,
            'date': purchase_date,
            'notes': notes,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'created_by': user.get('email', '')
        }
        transactions.append(txn)
    
    if transactions:
        await db.stock_transactions.insert_many(transactions)
        # Remove _id from response
        for t in transactions:
            t.pop('_id', None)
    
    return {"message": f"Purchase recorded with {len(transactions)} items", "purchase_id": purchase_id, "transactions": transactions}


# ============== PURCHASE RETURN ==============

@router.post("/stock/purchase-return")
async def create_purchase_return(data: dict, user=Depends(get_current_user)):
    supplier_id = data.get('supplier_id')
    items = data.get('items', [])
    return_date = data.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d'))
    notes = data.get('notes', '').strip()
    
    if not supplier_id:
        raise HTTPException(status_code=400, detail="Supplier is required")
    if not items:
        raise HTTPException(status_code=400, detail="At least one item is required")
    
    return_id = str(uuid.uuid4())
    transactions = []
    
    for item in items:
        item_id = item.get('item_id')
        quantity = item.get('quantity', 0)
        rate = item.get('rate', 0)
        
        if not item_id:
            continue
        try:
            quantity = float(quantity)
            rate = float(rate)
        except (ValueError, TypeError):
            continue
        
        txn = {
            'id': str(uuid.uuid4()),
            'return_id': return_id,
            'type': 'purchase_return',
            'item_id': item_id,
            'quantity': quantity,
            'rate': rate,
            'supplier_id': supplier_id,
            'date': return_date,
            'notes': notes,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'created_by': user.get('email', '')
        }
        transactions.append(txn)
    
    if transactions:
        await db.stock_transactions.insert_many(transactions)
        for t in transactions:
            t.pop('_id', None)
    
    return {"message": f"Purchase return recorded with {len(transactions)} items", "return_id": return_id}


# ============== SALES RETURN ==============

@router.post("/stock/sales-return")
async def create_sales_return(data: dict, user=Depends(get_current_user)):
    items = data.get('items', [])
    return_date = data.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d'))
    order_id = data.get('order_id', '').strip()
    customer_name = data.get('customer_name', '').strip()
    customer_phone = data.get('customer_phone', '').strip()
    notes = data.get('notes', '').strip()
    
    if not items:
        raise HTTPException(status_code=400, detail="At least one item is required")
    
    return_id = str(uuid.uuid4())
    transactions = []
    
    for item in items:
        item_id = item.get('item_id')
        quantity = item.get('quantity', 0)
        rate = item.get('rate', 0)
        
        if not item_id:
            continue
        try:
            quantity = float(quantity)
            rate = float(rate)
        except (ValueError, TypeError):
            continue
        
        txn = {
            'id': str(uuid.uuid4()),
            'return_id': return_id,
            'type': 'sales_return',
            'item_id': item_id,
            'quantity': quantity,
            'rate': rate,
            'order_id': order_id,
            'customer_name': customer_name,
            'customer_phone': customer_phone,
            'date': return_date,
            'notes': notes,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'created_by': user.get('email', '')
        }
        transactions.append(txn)
    
    if transactions:
        await db.stock_transactions.insert_many(transactions)
        for t in transactions:
            t.pop('_id', None)
    
    return {"message": f"Sales return recorded with {len(transactions)} items", "return_id": return_id}


# ============== STOCK STATUS & REPORTS ==============

async def _calculate_stock(item_id: str = None):
    """Calculate current stock for one or all items.
    Stock = Opening + Purchases + Sales Returns - Sales (dispatched) - Purchase Returns
    """
    # Get all items
    item_query = {'id': item_id} if item_id else {}
    items = await db.items.find(item_query, {'_id': 0, 'id': 1, 'item_name': 1, 'item_code': 1, 'rate': 1, 'status': 1}).to_list(5000)
    item_map = {i['id']: i for i in items}
    
    # Get opening balances
    ob_query = {'item_id': item_id} if item_id else {}
    opening_balances = await db.opening_balances.find(ob_query, {'_id': 0}).to_list(5000)
    ob_map = {ob['item_id']: ob.get('quantity', 0) for ob in opening_balances}
    
    # Get all stock transactions
    txn_query = {'item_id': item_id} if item_id else {}
    transactions = await db.stock_transactions.find(txn_query, {'_id': 0}).to_list(50000)
    
    # Aggregate by item
    purchase_map = {}
    purchase_return_map = {}
    sales_return_map = {}
    purchase_rate_map = {}
    
    for txn in transactions:
        iid = txn['item_id']
        qty = txn.get('quantity', 0)
        rate = txn.get('rate', 0)
        
        if txn['type'] == 'purchase':
            purchase_map[iid] = purchase_map.get(iid, 0) + qty
            # Track latest purchase rate
            purchase_rate_map[iid] = rate
        elif txn['type'] == 'purchase_return':
            purchase_return_map[iid] = purchase_return_map.get(iid, 0) + qty
        elif txn['type'] == 'sales_return':
            sales_return_map[iid] = sales_return_map.get(iid, 0) + qty
    
    # Get dispatched order quantities (sales)
    dispatch_pipeline = [
        {'$match': {'status': {'$in': ['shipped', 'delivered']}}},
        {'$unwind': '$items'},
    ]
    if item_id:
        dispatch_pipeline.append({'$match': {'items.item_id': item_id}})
    dispatch_pipeline.append({
        '$group': {
            '_id': '$items.item_id',
            'total_sold': {'$sum': {'$toDouble': {'$ifNull': ['$items.dispatch_quantity', '$items.quantity']}}}
        }
    })
    
    sold_map = {}
    try:
        async for doc in db.orders.aggregate(dispatch_pipeline):
            sold_map[doc['_id']] = doc['total_sold']
    except Exception as e:
        logger.error(f"Error calculating sales: {e}")
    
    # Build stock status
    results = []
    for iid, item in item_map.items():
        opening = ob_map.get(iid, 0)
        purchased = purchase_map.get(iid, 0)
        purchase_returned = purchase_return_map.get(iid, 0)
        sales_returned = sales_return_map.get(iid, 0)
        sold = sold_map.get(iid, 0)
        
        closing = opening + purchased + sales_returned - sold - purchase_returned
        
        results.append({
            'item_id': iid,
            'item_name': item.get('item_name', ''),
            'item_code': item.get('item_code', ''),
            'rate': item.get('rate', 0),
            'status': item.get('status', 'active'),
            'opening_balance': opening,
            'purchased': purchased,
            'purchase_returned': purchase_returned,
            'sold': sold,
            'sales_returned': sales_returned,
            'closing_balance': closing,
            'last_purchase_rate': purchase_rate_map.get(iid, 0)
        })
    
    results.sort(key=lambda x: x.get('item_name', ''))
    return results

@router.get("/stock/status")
async def get_stock_status(user=Depends(get_current_user), item_id: str = Query(None)):
    """Get stock status for all items or a specific item"""
    results = await _calculate_stock(item_id)
    return results

@router.get("/stock/item-ledger/{item_id}")
async def get_item_ledger(item_id: str, user=Depends(get_current_user)):
    """Get credit/debit ledger for a specific item"""
    # Opening balance
    ob = await db.opening_balances.find_one({'item_id': item_id}, {'_id': 0})
    opening_qty = ob.get('quantity', 0) if ob else 0
    opening_date = ob.get('date', '') if ob else ''
    
    # All transactions for this item
    transactions = await db.stock_transactions.find(
        {'item_id': item_id}, {'_id': 0}
    ).sort('date', 1).to_list(50000)
    
    # Get dispatched orders for this item
    orders = await db.orders.find(
        {'status': {'$in': ['shipped', 'delivered']}, 'items.item_id': item_id},
        {'_id': 0, 'id': 1, 'order_number': 1, 'customer_name': 1, 'customer_phone': 1, 'items': 1, 'status': 1, 'updated_at': 1, 'created_at': 1}
    ).sort('updated_at', 1).to_list(50000)
    
    # Build ledger entries
    ledger = []
    
    if opening_qty > 0:
        ledger.append({
            'date': opening_date,
            'type': 'opening_balance',
            'description': 'Opening Balance',
            'credit': opening_qty,
            'debit': 0,
            'rate': 0,
            'reference': ''
        })
    
    for txn in transactions:
        if txn['type'] == 'purchase':
            ledger.append({
                'date': txn.get('date', ''),
                'type': 'purchase',
                'description': f"Purchase - Invoice: {txn.get('invoice_no', 'N/A')}",
                'credit': txn.get('quantity', 0),
                'debit': 0,
                'rate': txn.get('rate', 0),
                'reference': txn.get('supplier_id', '')
            })
        elif txn['type'] == 'purchase_return':
            ledger.append({
                'date': txn.get('date', ''),
                'type': 'purchase_return',
                'description': "Purchase Return",
                'credit': 0,
                'debit': txn.get('quantity', 0),
                'rate': txn.get('rate', 0),
                'reference': txn.get('supplier_id', '')
            })
        elif txn['type'] == 'sales_return':
            ledger.append({
                'date': txn.get('date', ''),
                'type': 'sales_return',
                'description': f"Sales Return - {txn.get('customer_name', '')}",
                'credit': txn.get('quantity', 0),
                'debit': 0,
                'rate': txn.get('rate', 0),
                'reference': txn.get('order_id', '')
            })
    
    for order in orders:
        for oi in order.get('items', []):
            if oi.get('item_id') == item_id:
                qty = oi.get('dispatch_quantity', oi.get('quantity', 0))
                try:
                    qty = float(qty)
                except (ValueError, TypeError):
                    qty = 0
                order_date = order.get('updated_at', order.get('created_at', ''))
                if isinstance(order_date, str) and 'T' in order_date:
                    order_date = order_date.split('T')[0]
                cust_name = order.get('doctor_name', '') or order.get('customer_name', '')
                order_num = order.get('order_number', '')
                ledger.append({
                    'date': order_date,
                    'type': 'sale',
                    'description': f"Sale - {cust_name} ({order_num})",
                    'credit': 0,
                    'debit': qty,
                    'rate': oi.get('rate', 0),
                    'reference': order.get('id', '')
                })
    
    # Sort by date
    ledger.sort(key=lambda x: x.get('date', ''))
    
    # Calculate running balance
    balance = 0
    for entry in ledger:
        balance += entry['credit'] - entry['debit']
        entry['balance'] = balance
    
    return {
        'item_id': item_id,
        'opening_balance': opening_qty,
        'ledger': ledger,
        'closing_balance': balance
    }

@router.get("/stock/user-ledger")
async def get_user_ledger(
    user=Depends(get_current_user),
    customer_phone: str = Query(None),
    customer_name: str = Query(None)
):
    """Get item-wise ledger for a specific user/customer"""
    query = {'status': {'$in': ['shipped', 'delivered']}}
    if customer_phone:
        query['$or'] = [
            {'doctor_phone': {'$regex': customer_phone}},
            {'customer_phone': {'$regex': customer_phone}}
        ]
    elif customer_name:
        query['$or'] = [
            {'doctor_name': {'$regex': customer_name, '$options': 'i'}},
            {'customer_name': {'$regex': customer_name, '$options': 'i'}}
        ]
    
    orders = await db.orders.find(query, {
        '_id': 0, 'id': 1, 'order_number': 1, 'doctor_name': 1, 'customer_name': 1, 
        'doctor_phone': 1, 'customer_phone': 1, 'items': 1, 'status': 1, 'created_at': 1, 'updated_at': 1
    }).sort('created_at', -1).to_list(5000)
    
    # Aggregate by item
    item_totals = {}
    order_details = []
    
    for order in orders:
        cust_name = order.get('doctor_name', '') or order.get('customer_name', '')
        cust_phone = order.get('doctor_phone', '') or order.get('customer_phone', '')
        for oi in order.get('items', []):
            iid = oi.get('item_id', '')
            qty = oi.get('dispatch_quantity', oi.get('quantity', 0))
            try:
                qty = float(qty)
            except (ValueError, TypeError):
                qty = 0
            
            item_totals[iid] = item_totals.get(iid, 0) + qty
            
            order_details.append({
                'order_id': order.get('id'),
                'order_number': order.get('order_number'),
                'customer_name': cust_name,
                'customer_phone': cust_phone,
                'item_id': iid,
                'item_name': oi.get('item_name', ''),
                'quantity': qty,
                'rate': oi.get('rate', 0),
                'date': order.get('updated_at', order.get('created_at', ''))
            })
    
    return {
        'item_totals': item_totals,
        'orders': order_details
    }


@router.get("/stock/customer-orders")
async def get_customer_orders_for_return(
    user=Depends(get_current_user),
    phone: str = Query(None),
    name: str = Query(None)
):
    """Get customer's previous orders for sales return flow"""
    query = {'status': {'$in': ['shipped', 'delivered']}}
    if phone:
        query['$or'] = [
            {'doctor_phone': {'$regex': phone}},
            {'customer_phone': {'$regex': phone}}
        ]
    elif name:
        query['$or'] = [
            {'doctor_name': {'$regex': name, '$options': 'i'}},
            {'customer_name': {'$regex': name, '$options': 'i'}}
        ]
    else:
        return {'customers': [], 'orders': []}
    
    orders = await db.orders.find(query, {
        '_id': 0, 'id': 1, 'order_number': 1, 'doctor_name': 1, 'customer_name': 1,
        'doctor_phone': 1, 'customer_phone': 1, 'items': 1, 'status': 1, 'created_at': 1
    }).sort('created_at', -1).to_list(5000)
    
    # Build order list with item details
    result_orders = []
    for order in orders:
        cust_name = order.get('doctor_name', '') or order.get('customer_name', '')
        cust_phone = order.get('doctor_phone', '') or order.get('customer_phone', '')
        for oi in order.get('items', []):
            qty = oi.get('dispatch_quantity', oi.get('quantity', 0))
            try:
                qty = float(qty)
            except (ValueError, TypeError):
                qty = 0
            result_orders.append({
                'order_id': order.get('id'),
                'order_number': order.get('order_number'),
                'customer_name': cust_name,
                'customer_phone': cust_phone,
                'item_id': oi.get('item_id', ''),
                'item_name': oi.get('item_name', ''),
                'quantity': qty,
                'rate': oi.get('rate', 0),
                'date': (order.get('created_at', '') or '').split('T')[0]
            })
    
    return {'orders': result_orders}


# ============== STOCK AVAILABILITY FOR ORDER PROCESSING ==============

@router.get("/stock/availability")
async def get_stock_availability(user=Depends(get_current_user)):
    """Get current stock availability for order processing view.
    Returns item_id -> closing_balance mapping.
    """
    stock = await _calculate_stock()
    availability = {}
    for s in stock:
        availability[s['item_id']] = {
            'closing_balance': s['closing_balance'],
            'last_purchase_rate': s['last_purchase_rate']
        }
    return availability
