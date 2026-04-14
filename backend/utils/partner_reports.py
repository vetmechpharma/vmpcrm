"""Partner report generation and sending utilities."""
from datetime import datetime, timezone, timedelta
import uuid

from deps import db, logger
from utils.whatsapp import get_whatsapp_config, send_wa_msg, log_whatsapp_message
from utils.templates import get_company_short_name


async def generate_outstanding_report():
    """Generate 3 outstanding messages: Doctors, Medicals, Agencies with totals."""
    short_name, _ = await get_company_short_name()
    messages = []

    for ctype, collection, label in [('doctor', 'doctors', 'DOCTORS'), ('medical', 'medicals', 'MEDICALS'), ('agency', 'agencies', 'AGENCIES')]:
        customers = await db[collection].find({}, {'_id': 0, 'id': 1, 'name': 1, 'opening_balance': 1, 'customer_code': 1}).to_list(5000)
        cust_ids = [c['id'] for c in customers]
        if not cust_ids:
            continue

        # Batch invoiced
        inv_map = {}
        async for doc in db.orders.aggregate([
            {'$match': {'doctor_id': {'$in': cust_ids}, 'invoice_value': {'$ne': None}}},
            {'$group': {'_id': '$doctor_id', 'total': {'$sum': {'$toDouble': '$invoice_value'}}}}
        ]):
            inv_map[doc['_id']] = doc['total']

        # Batch paid
        pay_map = {}
        async for doc in db.payments.aggregate([
            {'$match': {'customer_id': {'$in': cust_ids}}},
            {'$group': {'_id': '$customer_id', 'total': {'$sum': '$amount'}}}
        ]):
            pay_map[doc['_id']] = doc['total']

        lines = []
        grand_total = 0
        for c in customers:
            ob = c.get('opening_balance', 0) or 0
            invoiced = inv_map.get(c['id'], 0)
            paid = pay_map.get(c['id'], 0)
            outstanding = ob + invoiced - paid
            if outstanding != 0:
                lines.append((c['name'], outstanding))
                grand_total += outstanding

        if not lines:
            messages.append(f"*{short_name}*\n*{label} OUTSTANDING*\n{'─' * 25}\nNo outstanding dues.\n{'─' * 25}")
            continue

        lines.sort(key=lambda x: x[1], reverse=True)
        msg = f"*{short_name}*\n*{label} OUTSTANDING*\n{'─' * 25}\n"
        for name, amt in lines:
            sign = '' if amt > 0 else '(CR) '
            msg += f"{name}: {sign}Rs.{abs(amt):,.0f}\n"
        msg += f"{'─' * 25}\n*TOTAL: Rs.{grand_total:,.0f}*\n{'─' * 25}"
        messages.append(msg)

    return messages


async def generate_orders_expenses_report(from_date: str, to_date: str):
    """Generate orders summary + expenses breakdown message."""
    short_name, _ = await get_company_short_name()

    # Orders by status in date range
    order_query = {}
    if from_date and to_date:
        order_query['created_at'] = {'$gte': from_date, '$lte': to_date + 'T23:59:59'}

    status_counts = {}
    async for doc in db.orders.aggregate([
        {'$match': order_query},
        {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
    ]):
        status_counts[doc['_id']] = doc['count']

    total_orders = sum(status_counts.values())
    status_labels = {
        'pending': 'Received', 'confirmed': 'Confirmed', 'processing': 'Processing',
        'ready_to_despatch': 'Ready to Dispatch', 'shipped': 'Shipped',
        'delivered': 'Delivered', 'cancelled': 'Cancelled'
    }

    msg = f"*{short_name}*\n*ORDERS & EXPENSES REPORT*\n*{from_date} to {to_date}*\n{'─' * 28}\n"
    msg += f"*Total Orders: {total_orders}*\n"
    for status_key in ['pending', 'confirmed', 'processing', 'ready_to_despatch', 'shipped', 'delivered', 'cancelled']:
        count = status_counts.get(status_key, 0)
        if count > 0:
            msg += f"  {status_labels.get(status_key, status_key)}: {count}\n"

    # Expenses by category
    expense_query = {}
    if from_date and to_date:
        expense_query['date'] = {'$gte': from_date, '$lte': to_date}

    expense_map = {}
    total_expense = 0
    async for doc in db.expenses.aggregate([
        {'$match': expense_query},
        {'$group': {'_id': '$category', 'total': {'$sum': '$amount'}}}
    ]):
        cat = doc['_id'] or 'Uncategorized'
        expense_map[cat] = doc['total']
        total_expense += doc['total']

    msg += f"\n{'─' * 28}\n*EXPENSES: Rs.{total_expense:,.0f}*\n"
    if expense_map:
        for cat, amt in sorted(expense_map.items(), key=lambda x: x[1], reverse=True):
            msg += f"  {cat}: Rs.{amt:,.0f}\n"
    else:
        msg += "  No expenses recorded\n"
    msg += f"{'─' * 28}"

    return [msg]


async def generate_top_performers_report(from_date: str, to_date: str):
    """Generate top 5 items by qty and top 5 customers by invoice value."""
    short_name, _ = await get_company_short_name()

    order_query = {}
    if from_date and to_date:
        order_query['created_at'] = {'$gte': from_date, '$lte': to_date + 'T23:59:59'}

    # Top 5 items by quantity
    item_qty = {}
    orders = await db.orders.find(order_query, {'_id': 0, 'items': 1}).to_list(10000)
    for order in orders:
        for item in (order.get('items') or []):
            name = item.get('item_name', 'Unknown')
            qty_str = str(item.get('quantity', '0'))
            # Handle scheme format "10+5"
            qty = sum(int(p) for p in qty_str.split('+') if p.strip().isdigit())
            item_qty[name] = item_qty.get(name, 0) + qty

    top_items = sorted(item_qty.items(), key=lambda x: x[1], reverse=True)[:5]

    # Top 5 customers by invoice value
    cust_inv = {}
    async for doc in db.orders.aggregate([
        {'$match': {**order_query, 'invoice_value': {'$ne': None}}},
        {'$group': {'_id': '$doctor_name', 'total': {'$sum': {'$toDouble': '$invoice_value'}}}}
    ]):
        if doc['_id']:
            cust_inv[doc['_id']] = doc['total']

    top_customers = sorted(cust_inv.items(), key=lambda x: x[1], reverse=True)[:5]

    msg = f"*{short_name}*\n*TOP PERFORMERS*\n*{from_date} to {to_date}*\n{'─' * 28}\n"
    msg += "*Top 5 Items (by Qty):*\n"
    for i, (name, qty) in enumerate(top_items, 1):
        msg += f"  {i}. {name} - {qty}\n"
    if not top_items:
        msg += "  No data\n"

    msg += f"\n*Top 5 Customers (by Invoice):*\n"
    for i, (name, amt) in enumerate(top_customers, 1):
        msg += f"  {i}. {name} - Rs.{amt:,.0f}\n"
    if not top_customers:
        msg += "  No data\n"
    msg += f"{'─' * 28}"

    return [msg]


async def send_report_to_partners(messages: list):
    """Send list of messages to all active partners."""
    config = await get_whatsapp_config()
    if not config.get('api_url') or not config.get('auth_token'):
        logger.warning("WhatsApp not configured for partner reports")
        return 0, 0

    partners = await db.partners.find({'active': True}, {'_id': 0}).to_list(500)
    if not partners:
        return 0, 0

    sent = 0
    failed = 0
    for partner in partners:
        phone = ''.join(filter(str.isdigit, partner.get('phone', '')))
        if len(phone) < 10:
            failed += 1
            continue
        wa_phone = f"91{phone[-10:]}"
        partner_ok = True
        for msg in messages:
            try:
                resp = await send_wa_msg(wa_phone, msg, config=config)
                if not resp or resp.status_code != 200:
                    partner_ok = False
            except Exception as e:
                logger.error(f"Partner report send error ({partner['name']}): {e}")
                partner_ok = False
        if partner_ok:
            sent += 1
        else:
            failed += 1

    # Log the send
    await db.partner_report_logs.insert_one({
        'id': str(uuid.uuid4()),
        'sent_at': datetime.now(timezone.utc).isoformat(),
        'partners_sent': sent,
        'partners_failed': failed,
        'message_count': len(messages),
        'trigger': 'manual',
    })

    return sent, failed


async def auto_send_partner_reports(period: str = 'week'):
    """Called by scheduler for weekly/monthly auto-send."""
    today = datetime.now(timezone.utc)

    if period == 'week':
        to_date = today.strftime('%Y-%m-%d')
        from_date = (today - timedelta(days=7)).strftime('%Y-%m-%d')
    elif period == 'month':
        # Previous month
        first_this = today.replace(day=1)
        last_prev = first_this - timedelta(days=1)
        from_date = last_prev.replace(day=1).strftime('%Y-%m-%d')
        to_date = last_prev.strftime('%Y-%m-%d')
    else:
        return

    all_messages = []
    try:
        all_messages.extend(await generate_outstanding_report())
        all_messages.extend(await generate_orders_expenses_report(from_date, to_date))
        all_messages.extend(await generate_top_performers_report(from_date, to_date))
    except Exception as e:
        logger.error(f"Partner report generation error: {e}")
        return

    if all_messages:
        sent, failed = await send_report_to_partners(all_messages)
        # Update log trigger
        await db.partner_report_logs.update_one(
            {'sent_at': {'$gte': today.isoformat()[:10]}},
            {'$set': {'trigger': f'auto_{period}'}},
        )
        logger.info(f"Partner {period} report: sent={sent}, failed={failed}")
