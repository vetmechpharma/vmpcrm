"""Ledger calculation and PDF generation utilities."""
from deps import db, logger
from datetime import datetime, timezone
from fpdf import FPDF
from typing import Optional


async def get_customer_ledger(
    customer_type: str,
    customer_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    """Get ledger for a customer - opening balance + invoices + payments + sales returns"""
    collection = {'doctor': 'doctors', 'medical': 'medicals', 'agency': 'agencies'}.get(customer_type)
    if not collection:
        return None

    customer = await db[collection].find_one({'id': customer_id}, {'_id': 0, 'image_webp': 0})
    if not customer:
        return None

    opening_balance = customer.get('opening_balance', 0) or 0

    # Get orders (invoices) for this customer
    order_query = {'doctor_id': customer_id}
    if from_date or to_date:
        date_q = {}
        if from_date:
            date_q['$gte'] = from_date
        if to_date:
            date_q['$lte'] = to_date + 'T23:59:59'
        order_query['created_at'] = date_q

    orders = await db.orders.find(order_query, {'_id': 0}).sort('created_at', 1).to_list(5000)

    # Get payments for this customer
    pay_query = {'customer_id': customer_id}
    if from_date or to_date:
        date_q = {}
        if from_date:
            date_q['$gte'] = from_date
        if to_date:
            date_q['$lte'] = to_date
        pay_query['date'] = date_q

    payments = await db.payments.find(pay_query, {'_id': 0}).sort('date', 1).to_list(5000)

    # Get sales returns for this customer (by phone)
    customer_phone = customer.get('phone', '')
    sales_returns = []
    if customer_phone:
        sr_query = {'type': 'sales_return', 'customer_phone': customer_phone}
        if from_date or to_date:
            date_q = {}
            if from_date:
                date_q['$gte'] = from_date
            if to_date:
                date_q['$lte'] = to_date
            sr_query['date'] = date_q
        sales_returns = await db.stock_transactions.find(sr_query, {'_id': 0}).sort('date', 1).to_list(5000)

    # Build ledger entries
    entries = []

    # Opening balance entry
    entries.append({
        'type': 'opening_balance',
        'date': customer.get('created_at', '')[:10] if isinstance(customer.get('created_at', ''), str) else '',
        'description': 'Opening Balance',
        'debit': opening_balance if opening_balance > 0 else 0,
        'credit': abs(opening_balance) if opening_balance < 0 else 0,
        'ref_id': None,
    })

    # Invoice entries from orders
    for order in orders:
        inv_value = order.get('invoice_value')
        if inv_value and float(inv_value) > 0:
            entries.append({
                'type': 'invoice',
                'date': order.get('invoice_date') or (order.get('created_at', '')[:10] if isinstance(order.get('created_at', ''), str) else str(order.get('created_at', ''))[:10]),
                'description': f"Inv# {order.get('invoice_number', 'N/A')} (Order: {order.get('order_number', '')})",
                'invoice_number': order.get('invoice_number', ''),
                'order_number': order.get('order_number', ''),
                'ref_id': order.get('id', ''),
                'debit': float(inv_value),
                'credit': 0,
            })
        elif order.get('total_amount'):
            # Fallback for orders without invoice but with total
            total = float(order.get('total_amount', 0))
            if total > 0:
                entries.append({
                    'type': 'order',
                    'date': (order.get('created_at', '')[:10] if isinstance(order.get('created_at', ''), str) else str(order.get('created_at', ''))[:10]),
                    'description': f"Order: {order.get('order_number', '')} ({order.get('status', '')})",
                    'order_number': order.get('order_number', ''),
                    'ref_id': order.get('id', ''),
                    'debit': total,
                    'credit': 0,
                })

    # Payment entries
    for pay in payments:
        entries.append({
            'type': 'payment',
            'date': pay.get('date', ''),
            'description': f"Payment ({pay.get('mode', 'Cash')})" + (f" - {pay.get('notes')}" if pay.get('notes') else ''),
            'payment_id': pay.get('id'),
            'ref_id': pay.get('id'),
            'debit': 0,
            'credit': float(pay.get('amount', 0)),
        })

    # Sales return entries (credit to customer)
    for sr in sales_returns:
        total = float(sr.get('total_amount', 0) or 0)
        if total <= 0:
            qty = float(sr.get('quantity', 0) or 0)
            rate = float(sr.get('rate', 0) or 0)
            total = qty * rate
        if total > 0:
            item_name = sr.get('item_name', '')
            if not item_name:
                item = await db.items.find_one({'id': sr.get('item_id')}, {'_id': 0, 'item_name': 1})
                item_name = item.get('item_name', '') if item else ''
            entries.append({
                'type': 'sales_return',
                'date': sr.get('date', ''),
                'description': f"Sales Return: {item_name} (Qty: {sr.get('quantity', 0)})",
                'ref_id': sr.get('id', ''),
                'debit': 0,
                'credit': total,
            })

    # Sort by date
    entries.sort(key=lambda x: x.get('date', '') or '')

    # Calculate running balance
    balance = 0
    for entry in entries:
        balance += entry['debit'] - entry['credit']
        entry['balance'] = balance

    total_debit = sum(e['debit'] for e in entries)
    total_credit = sum(e['credit'] for e in entries)

    return {
        'customer': {
            'id': customer_id,
            'name': customer.get('name', ''),
            'phone': customer.get('phone', ''),
            'email': customer.get('email', ''),
            'type': customer_type,
            'customer_code': customer.get('customer_code', ''),
            'opening_balance': opening_balance,
        },
        'entries': entries,
        'total_debit': total_debit,
        'total_credit': total_credit,
        'closing_balance': total_debit - total_credit,
    }


def generate_ledger_pdf_bytes(ledger: dict, company_name: str, from_date: str = None, to_date: str = None) -> bytes:
    """Generate a PDF ledger statement and return bytes."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Header
    pdf.set_font('Helvetica', 'B', 16)
    pdf.cell(0, 10, company_name, ln=True, align='C')
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 6, 'LEDGER STATEMENT', ln=True, align='C')

    # Customer info
    cust = ledger['customer']
    pdf.ln(5)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(0, 6, f"Customer: {cust['name']}", ln=True)
    pdf.set_font('Helvetica', '', 9)
    pdf.cell(0, 5, f"Type: {cust['type'].title()} | Phone: {cust.get('phone', 'N/A')}", ln=True)
    if from_date or to_date:
        pdf.cell(0, 5, f"Period: {from_date or 'Start'} to {to_date or 'Present'}", ln=True)
    pdf.cell(0, 5, f"Statement Date: {datetime.now(timezone.utc).strftime('%d %b %Y')}", ln=True)

    # Table header
    pdf.ln(5)
    pdf.set_fill_color(30, 58, 95)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font('Helvetica', 'B', 8)
    col_widths = [22, 70, 30, 30, 35]
    headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance']
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 7, h, 1, 0, 'C', True)
    pdf.ln()

    # Table rows
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Helvetica', '', 7)
    fill = False
    for entry in ledger['entries']:
        if fill:
            pdf.set_fill_color(245, 245, 245)
        else:
            pdf.set_fill_color(255, 255, 255)

        date_str = entry.get('date', '')[:10] if entry.get('date') else ''
        desc = entry.get('description', '')[:45]
        debit = f"{entry['debit']:,.2f}" if entry['debit'] > 0 else ''
        credit = f"{entry['credit']:,.2f}" if entry['credit'] > 0 else ''
        balance = f"{entry['balance']:,.2f}"

        pdf.cell(col_widths[0], 6, date_str, 1, 0, 'C', True)
        pdf.cell(col_widths[1], 6, desc, 1, 0, 'L', True)
        pdf.cell(col_widths[2], 6, debit, 1, 0, 'R', True)
        pdf.cell(col_widths[3], 6, credit, 1, 0, 'R', True)
        pdf.cell(col_widths[4], 6, balance, 1, 0, 'R', True)
        pdf.ln()
        fill = not fill

    # Totals row
    pdf.set_font('Helvetica', 'B', 8)
    pdf.set_fill_color(30, 58, 95)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(col_widths[0] + col_widths[1], 7, 'TOTALS', 1, 0, 'R', True)
    pdf.cell(col_widths[2], 7, f"{ledger['total_debit']:,.2f}", 1, 0, 'R', True)
    pdf.cell(col_widths[3], 7, f"{ledger['total_credit']:,.2f}", 1, 0, 'R', True)
    pdf.cell(col_widths[4], 7, f"{ledger['closing_balance']:,.2f}", 1, 0, 'R', True)
    pdf.ln()

    return pdf.output()
