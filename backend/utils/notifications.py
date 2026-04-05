"""Order notification utilities - WhatsApp and Email notifications for orders"""
from deps import db, logger
from utils.whatsapp import get_whatsapp_config, send_wa_msg, log_whatsapp_message
from utils.email_utils import send_notification_email
from utils.templates import render_wa_template, get_company_short_name, get_wa_template, get_email_template


async def send_whatsapp_order(customer_phone: str, items: list, order_number: str, customer_name: str):
    """Send order confirmation via WhatsApp"""
    try:
        config = await get_whatsapp_config()
        if not config.get('api_url') or not config.get('auth_token'):
            return

        # Build items text
        items_lines = []
        total = 0
        for item in items:
            item_dict = item.dict() if hasattr(item, 'dict') else item
            name = item_dict.get('item_name', 'Item')
            qty = item_dict.get('quantity', 1)
            rate = float(item_dict.get('rate', 0))
            amount = qty * rate
            total += amount
            items_lines.append(f"• {name} x{qty} = ₹{amount:.2f}")

        items_text = "\n".join(items_lines)
        short_name, _ = await get_company_short_name()

        # Try template first
        tmpl = await get_wa_template('order_confirmation')
        if tmpl:
            try:
                message = tmpl.format(
                    customer_name=customer_name,
                    order_number=order_number,
                    items_text=items_text,
                    total=f"₹{total:.2f}",
                    company_short_name=short_name
                )
            except Exception:
                message = f"Order Confirmed! #{order_number}\n\nDear {customer_name},\n\n{items_text}\n\nTotal: ₹{total:.2f}\n\nThank you - {short_name}"
        else:
            message = f"Order Confirmed! #{order_number}\n\nDear {customer_name},\n\n{items_text}\n\nTotal: ₹{total:.2f}\n\nThank you - {short_name}"

        wa_phone = customer_phone if customer_phone.startswith('91') else f"91{customer_phone[-10:]}"
        resp = await send_wa_msg(wa_phone, message, config=config)
        status = 'success' if resp and resp.status_code == 200 else 'failed'
        await log_whatsapp_message(wa_phone, 'order_confirmation', message, status)
    except Exception as e:
        logger.error(f"send_whatsapp_order error: {e}")


async def send_order_confirmation_email(order_doc: dict, items: list):
    """Send order confirmation email"""
    try:
        customer_email = order_doc.get('doctor_email') or order_doc.get('email')
        if not customer_email:
            return

        short_name, _ = await get_company_short_name()
        order_number = order_doc.get('order_number', '')
        customer_name = order_doc.get('doctor_name', order_doc.get('customer_name', 'Customer'))

        items_html = ""
        total = 0
        for item in items:
            item_dict = item if isinstance(item, dict) else item.dict()
            name = item_dict.get('item_name', 'Item')
            qty = item_dict.get('quantity', 1)
            rate = float(item_dict.get('rate', 0))
            amount = qty * rate
            total += amount
            items_html += f"<tr><td>{name}</td><td>{qty}</td><td>₹{rate:.2f}</td><td>₹{amount:.2f}</td></tr>"

        tmpl = await get_email_template('order_confirmation')
        if tmpl:
            try:
                body = tmpl.format(
                    customer_name=customer_name,
                    order_number=order_number,
                    items_html=items_html,
                    total=f"₹{total:.2f}",
                    company_short_name=short_name
                )
            except Exception:
                body = f"<h2>Order #{order_number} Confirmed</h2><p>Dear {customer_name}, your order has been placed successfully. Total: ₹{total:.2f}</p>"
        else:
            body = f"<h2>Order #{order_number} Confirmed</h2><p>Dear {customer_name}, your order has been placed successfully. Total: ₹{total:.2f}</p>"

        await send_notification_email(
            customer_email,
            f"Order #{order_number} Confirmed - {short_name}",
            body,
            customer_name
        )
    except Exception as e:
        logger.error(f"send_order_confirmation_email error: {e}")


async def send_whatsapp_out_of_stock(order_doc: dict, pending_items: list):
    """Send WhatsApp notification about out-of-stock items"""
    try:
        config = await get_whatsapp_config()
        if not config.get('api_url') or not config.get('auth_token'):
            return

        customer_phone = order_doc.get('doctor_phone', '')
        customer_name = order_doc.get('doctor_name', order_doc.get('customer_name', 'Customer'))
        order_number = order_doc.get('order_number', '')
        short_name, _ = await get_company_short_name()

        items_text = "\n".join([f"• {p.get('item_name', 'Item')} x{p.get('quantity', 1)}" for p in pending_items])

        message = f"Dear {customer_name},\n\nSome items from your order #{order_number} are currently out of stock:\n\n{items_text}\n\nWe will notify you once they are available.\n\n- {short_name}"

        wa_phone = customer_phone if customer_phone.startswith('91') else f"91{customer_phone[-10:]}"
        resp = await send_wa_msg(wa_phone, message, config=config)
        status = 'success' if resp and resp.status_code == 200 else 'failed'
        await log_whatsapp_message(wa_phone, 'out_of_stock', message, status)
    except Exception as e:
        logger.error(f"send_whatsapp_out_of_stock error: {e}")


async def send_whatsapp_status_update(order_doc: dict, new_status: str, update_data: dict = None):
    """Send WhatsApp notification for order status change"""
    try:
        config = await get_whatsapp_config()
        if not config.get('api_url') or not config.get('auth_token'):
            return

        customer_phone = order_doc.get('doctor_phone', '')
        customer_name = order_doc.get('doctor_name', order_doc.get('customer_name', 'Customer'))
        order_number = order_doc.get('order_number', '')
        short_name, _ = await get_company_short_name()

        status_labels = {
            'confirmed': 'Confirmed', 'processing': 'Processing',
            'ready_to_despatch': 'Ready to Dispatch', 'shipped': 'Dispatched',
            'delivered': 'Delivered', 'cancelled': 'Cancelled'
        }
        status_label = status_labels.get(new_status, new_status.title())

        tmpl = await get_wa_template('order_status_update')
        if tmpl:
            try:
                message = tmpl.format(
                    customer_name=customer_name,
                    order_number=order_number,
                    status=status_label,
                    company_short_name=short_name
                )
            except Exception:
                message = f"Dear {customer_name},\n\nYour order #{order_number} status: *{status_label}*\n\n- {short_name}"
        else:
            message = f"Dear {customer_name},\n\nYour order #{order_number} status: *{status_label}*\n\n- {short_name}"

        # Add tracking info for shipped
        if new_status == 'shipped' and update_data:
            tracking = update_data.get('tracking_number', '')
            transport = update_data.get('transport_name', '')
            if tracking:
                message += f"\n\nTracking: {tracking}"
            if transport:
                message += f"\nTransport: {transport}"

        wa_phone = customer_phone if customer_phone.startswith('91') else f"91{customer_phone[-10:]}"
        resp = await send_wa_msg(wa_phone, message, config=config)
        status = 'success' if resp and resp.status_code == 200 else 'failed'
        await log_whatsapp_message(wa_phone, 'order_status', message, status)
    except Exception as e:
        logger.error(f"send_whatsapp_status_update error: {e}")


async def send_whatsapp_ready_to_despatch(order_doc: dict, update_data: dict = None):
    """Send WhatsApp notification when order is ready to dispatch"""
    try:
        # Notify customer
        await send_whatsapp_status_update(order_doc, 'ready_to_despatch', update_data)

        # Notify transporter if available
        config = await get_whatsapp_config()
        if not config.get('api_url') or not config.get('auth_token'):
            return

        transport_phone = order_doc.get('transport_phone') or (update_data or {}).get('transport_phone', '')
        if not transport_phone:
            return

        short_name, _ = await get_company_short_name()
        transport_name = order_doc.get('transport_name') or (update_data or {}).get('transport_name', 'Transporter')
        order_number = order_doc.get('order_number', '')
        customer_name = order_doc.get('doctor_name', order_doc.get('customer_name', 'Customer'))

        message = f"Dear {transport_name},\n\nOrder #{order_number} for {customer_name} is ready for pickup/dispatch.\n\n- {short_name}"

        wa_phone = transport_phone if transport_phone.startswith('91') else f"91{transport_phone[-10:]}"
        resp = await send_wa_msg(wa_phone, message, config=config)
        status = 'success' if resp and resp.status_code == 200 else 'failed'
        await log_whatsapp_message(wa_phone, 'ready_to_despatch', message, status)
    except Exception as e:
        logger.error(f"send_whatsapp_ready_to_despatch error: {e}")


async def send_order_status_email(order_doc: dict, new_status: str, update_data: dict = None):
    """Send email notification for order status change"""
    try:
        customer_email = order_doc.get('doctor_email') or order_doc.get('email')
        if not customer_email:
            return

        short_name, _ = await get_company_short_name()
        order_number = order_doc.get('order_number', '')
        customer_name = order_doc.get('doctor_name', order_doc.get('customer_name', 'Customer'))

        status_labels = {
            'confirmed': 'Confirmed', 'processing': 'Processing',
            'ready_to_despatch': 'Ready to Dispatch', 'shipped': 'Dispatched',
            'delivered': 'Delivered', 'cancelled': 'Cancelled'
        }
        status_label = status_labels.get(new_status, new_status.title())

        body = f"<h2>Order #{order_number} - {status_label}</h2><p>Dear {customer_name},</p><p>Your order status has been updated to <strong>{status_label}</strong>.</p>"

        if new_status == 'shipped' and update_data:
            tracking = update_data.get('tracking_number', '')
            transport = update_data.get('transport_name', '')
            if tracking or transport:
                body += "<p>"
                if transport:
                    body += f"Transport: {transport}<br>"
                if tracking:
                    body += f"Tracking Number: {tracking}"
                body += "</p>"

        body += f"<p>Thank you,<br>{short_name}</p>"

        await send_notification_email(
            customer_email,
            f"Order #{order_number} - {status_label} | {short_name}",
            body,
            customer_name
        )
    except Exception as e:
        logger.error(f"send_order_status_email error: {e}")


async def send_whatsapp_stock_arrived(doctor_phone: str, doctor_name: str, item_name: str, item_code: str = '', quantity: str = ''):
    """Send WhatsApp notification when pending item is back in stock"""
    try:
        config = await get_whatsapp_config()
        if not config.get('api_url') or not config.get('auth_token'):
            return False

        short_name, _ = await get_company_short_name()

        tmpl = await get_wa_template('stock_arrived')
        if tmpl:
            try:
                message = tmpl.format(
                    doctor_name=doctor_name,
                    item_name=item_name,
                    item_code=item_code,
                    quantity=quantity,
                    company_short_name=short_name
                )
            except Exception:
                message = f"Dear {doctor_name},\n\nGood news! *{item_name}* ({item_code}) is now back in stock.\n\nYou can place your order now.\n\n- {short_name}"
        else:
            message = f"Dear {doctor_name},\n\nGood news! *{item_name}* ({item_code}) is now back in stock.\n\nYou can place your order now.\n\n- {short_name}"

        wa_phone = doctor_phone if doctor_phone.startswith('91') else f"91{doctor_phone[-10:]}"
        resp = await send_wa_msg(wa_phone, message, config=config)
        status = 'success' if resp and resp.status_code == 200 else 'failed'
        await log_whatsapp_message(wa_phone, 'stock_arrived', message, status)
        return status == 'success'
    except Exception as e:
        logger.error(f"send_whatsapp_stock_arrived error: {e}")
        return False
