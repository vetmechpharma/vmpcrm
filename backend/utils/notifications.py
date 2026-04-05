"""Order notification utilities - WhatsApp and Email notifications for orders"""
from deps import db, logger
from utils.whatsapp import get_whatsapp_config, send_wa_msg, log_whatsapp_message
from utils.email_utils import send_notification_email
from utils.templates import render_wa_template, get_company_short_name, get_email_template


async def send_whatsapp_order(customer_phone: str, items: list, order_number: str, customer_name: str):
    """Send order confirmation via WhatsApp"""
    try:
        config = await get_whatsapp_config()
        if not config.get('api_url') or not config.get('auth_token'):
            return

        items_lines = []
        total = 0
        for item in items:
            item_dict = item.dict() if hasattr(item, 'dict') else item
            name = item_dict.get('item_name', 'Item')
            qty = int(item_dict.get('quantity', 1))
            rate = float(item_dict.get('rate', 0))
            amount = qty * rate
            total += amount
            items_lines.append(f"• {name} x{qty} = Rs.{amount:.2f}")

        items_text = "\n".join(items_lines)
        item_count = len(items_lines)

        message = await render_wa_template('order_confirmation',
            customer_name=customer_name,
            order_number=order_number,
            item_count=str(item_count),
            items_text=items_text
        )

        if not message:
            short_name, phone = await get_company_short_name()
            message = f"Hello {customer_name},\n\nYour order *{order_number}* has been received!\n\n*Items:*\n{items_text}\n\nWe will process your order shortly.\n\nRegards,\n*{short_name}*"
            if phone:
                message += f"\n+{phone}"

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

        short_name, phone = await get_company_short_name()
        order_number = order_doc.get('order_number', '')
        customer_name = order_doc.get('doctor_name', order_doc.get('customer_name', 'Customer'))

        items_html = ""
        total = 0
        for item in items:
            item_dict = item if isinstance(item, dict) else item.dict()
            name = item_dict.get('item_name', 'Item')
            qty = int(item_dict.get('quantity', 1))
            rate = float(item_dict.get('rate', 0))
            amount = qty * rate
            total += amount
            items_html += f"<tr><td style='padding:8px;border:1px solid #ddd'>{name}</td><td style='padding:8px;border:1px solid #ddd;text-align:center'>{qty}</td><td style='padding:8px;border:1px solid #ddd;text-align:right'>Rs.{rate:.2f}</td><td style='padding:8px;border:1px solid #ddd;text-align:right'>Rs.{amount:.2f}</td></tr>"

        tmpl_body, tmpl_subject = await get_email_template('order_confirmation')
        if tmpl_body:
            try:
                body = tmpl_body.format(
                    customer_name=customer_name,
                    order_number=order_number,
                    items_html=items_html,
                    total=f"Rs.{total:.2f}",
                    company_short_name=short_name,
                    company_name=short_name,
                    company_phone=phone
                )
                subject = (tmpl_subject or '').format(order_number=order_number, company_short_name=short_name) or f"Order #{order_number} Confirmed - {short_name}"
            except Exception:
                body = f"<h2>Order #{order_number} Confirmed</h2><p>Dear {customer_name},</p><p>Your order has been placed successfully.</p><table style='border-collapse:collapse;width:100%'><tr><th style='padding:8px;border:1px solid #ddd'>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>{items_html}</table><p><strong>Total: Rs.{total:.2f}</strong></p><p>Regards,<br><strong>{short_name}</strong></p>"
                subject = f"Order #{order_number} Confirmed - {short_name}"
        else:
            body = f"<h2>Order #{order_number} Confirmed</h2><p>Dear {customer_name},</p><p>Your order has been placed successfully.</p><table style='border-collapse:collapse;width:100%'><tr><th style='padding:8px;border:1px solid #ddd'>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>{items_html}</table><p><strong>Total: Rs.{total:.2f}</strong></p><p>Regards,<br><strong>{short_name}</strong></p>"
            subject = f"Order #{order_number} Confirmed - {short_name}"

        await send_notification_email(customer_email, subject, body, customer_name)
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

        items_text = "\n".join([f"• {p.get('item_name', 'Item')} x{p.get('quantity', 1)}" for p in pending_items])

        message = await render_wa_template('out_of_stock',
            customer_name=customer_name,
            order_number=order_number,
            items_text=items_text
        )

        if not message:
            short_name, phone = await get_company_short_name()
            message = f"Hello {customer_name},\n\nSome items in your order *{order_number}* are currently *OUT OF STOCK*:\n\n{items_text}\n\nWe will notify you when they are available.\n\nRegards,\n*{short_name}*"
            if phone:
                message += f"\n+{phone}"

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

        # Map to correct template key
        status_template_map = {
            'confirmed': 'status_confirmed',
            'processing': 'status_processing',
            'ready_to_despatch': 'status_ready',
            'shipped': 'status_dispatched',
            'delivered': 'status_delivered',
            'cancelled': 'status_cancelled'
        }

        status_labels = {
            'confirmed': 'CONFIRMED', 'processing': 'PROCESSING',
            'ready_to_despatch': 'READY TO DISPATCH', 'shipped': 'DISPATCHED',
            'delivered': 'DELIVERED', 'cancelled': 'CANCELLED'
        }
        status_label = status_labels.get(new_status, new_status.upper())

        # Build items text for ready_to_despatch
        items_text = ''
        transport_name = ''
        tracking_number = ''
        if update_data:
            transport_name = update_data.get('transport_name', '')
            tracking_number = update_data.get('tracking_number', '')

        if new_status == 'ready_to_despatch':
            order_items = order_doc.get('items', [])
            items_lines = [f"• {i.get('item_name', 'Item')} x{i.get('quantity', 1)}" for i in order_items]
            items_text = "\n".join(items_lines) if items_lines else ''

        tmpl_key = status_template_map.get(new_status, '')
        message = ''
        if tmpl_key:
            message = await render_wa_template(tmpl_key,
                customer_name=customer_name,
                order_number=order_number,
                items_text=items_text,
                transport_name=transport_name or 'N/A'
            )

        if not message:
            short_name, phone = await get_company_short_name()
            message = f"Hello {customer_name},\n\nYour order *{order_number}* has been *{status_label}*!"
            if new_status == 'shipped' and tracking_number:
                message += f"\n\nTracking: {tracking_number}"
            if transport_name:
                message += f"\nTransport: {transport_name}"
            message += f"\n\nRegards,\n*{short_name}*"
            if phone:
                message += f"\n+{phone}"
        else:
            # Append tracking info if shipped
            if new_status == 'shipped' and tracking_number:
                message += f"\n\nTracking: {tracking_number}"
                if transport_name:
                    message += f"\nTransport: {transport_name}"

        wa_phone = customer_phone if customer_phone.startswith('91') else f"91{customer_phone[-10:]}"
        resp = await send_wa_msg(wa_phone, message, config=config)
        status_val = 'success' if resp and resp.status_code == 200 else 'failed'
        await log_whatsapp_message(wa_phone, f'order_{new_status}', message, status_val)
    except Exception as e:
        logger.error(f"send_whatsapp_status_update error: {e}")


async def send_whatsapp_ready_to_despatch(order_doc: dict, update_data: dict = None):
    """Send WhatsApp notification when order is ready to dispatch"""
    try:
        await send_whatsapp_status_update(order_doc, 'ready_to_despatch', update_data)

        # Notify transporter if available
        config = await get_whatsapp_config()
        if not config.get('api_url') or not config.get('auth_token'):
            return

        transport_phone = order_doc.get('transport_phone') or (update_data or {}).get('transport_phone', '')
        if not transport_phone:
            return

        short_name, phone = await get_company_short_name()
        transport_name = order_doc.get('transport_name') or (update_data or {}).get('transport_name', 'Transporter')
        order_number = order_doc.get('order_number', '')
        customer_name = order_doc.get('doctor_name', order_doc.get('customer_name', 'Customer'))
        customer_city = order_doc.get('doctor_city', order_doc.get('city', ''))

        message = f"Hello {transport_name},\n\nOrder *{order_number}* for *{customer_name}*"
        if customer_city:
            message += f" ({customer_city})"
        message += f" is ready for pickup/dispatch.\n\nRegards,\n*{short_name}*"
        if phone:
            message += f"\n+{phone}"

        wa_phone = transport_phone if transport_phone.startswith('91') else f"91{transport_phone[-10:]}"
        resp = await send_wa_msg(wa_phone, message, config=config)
        status = 'success' if resp and resp.status_code == 200 else 'failed'
        await log_whatsapp_message(wa_phone, 'transport_ready', message, status)
    except Exception as e:
        logger.error(f"send_whatsapp_ready_to_despatch error: {e}")


async def send_order_status_email(order_doc: dict, new_status: str, update_data: dict = None):
    """Send email notification for order status change"""
    try:
        customer_email = order_doc.get('doctor_email') or order_doc.get('email')
        if not customer_email:
            return

        short_name, phone = await get_company_short_name()
        order_number = order_doc.get('order_number', '')
        customer_name = order_doc.get('doctor_name', order_doc.get('customer_name', 'Customer'))

        status_labels = {
            'confirmed': 'Confirmed', 'processing': 'Processing',
            'ready_to_despatch': 'Ready to Dispatch', 'shipped': 'Dispatched',
            'delivered': 'Delivered', 'cancelled': 'Cancelled'
        }
        status_label = status_labels.get(new_status, new_status.title())

        body = f"<h2>Order #{order_number} - {status_label}</h2>"
        body += f"<p>Dear {customer_name},</p>"
        body += f"<p>Your order <strong>#{order_number}</strong> status has been updated to <strong>{status_label}</strong>.</p>"

        if new_status == 'shipped' and update_data:
            tracking = update_data.get('tracking_number', '')
            transport = update_data.get('transport_name', '')
            if tracking or transport:
                body += "<p><strong>Shipping Details:</strong><br>"
                if transport:
                    body += f"Transport: {transport}<br>"
                if tracking:
                    body += f"Tracking Number: {tracking}"
                body += "</p>"

        if new_status == 'delivered':
            body += "<p>Thank you for your business!</p>"

        body += f"<br><p>Regards,<br><strong>{short_name}</strong>"
        if phone:
            body += f"<br>Phone: {phone}"
        body += "</p>"

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

        message = await render_wa_template('stock_arrived',
            customer_name=doctor_name,
            item_name=item_name,
            item_code=item_code
        )

        if not message:
            short_name, phone = await get_company_short_name()
            message = f"Hello {doctor_name},\n\n*{item_name}* ({item_code}) is now back in stock!\n\nYou can place your order now.\n\nRegards,\n*{short_name}*"
            if phone:
                message += f"\n+{phone}"

        wa_phone = doctor_phone if doctor_phone.startswith('91') else f"91{doctor_phone[-10:]}"
        resp = await send_wa_msg(wa_phone, message, config=config)
        status = 'success' if resp and resp.status_code == 200 else 'failed'
        await log_whatsapp_message(wa_phone, 'stock_arrived', message, status)
        return status == 'success'
    except Exception as e:
        logger.error(f"send_whatsapp_stock_arrived error: {e}")
        return False



async def send_whatsapp_order_updated(order_doc: dict, items: list):
    """Send WhatsApp notification when order items are updated (added/removed/qty changed)"""
    try:
        config = await get_whatsapp_config()
        if not config.get('api_url') or not config.get('auth_token'):
            return

        customer_phone = order_doc.get('doctor_phone', '')
        customer_name = order_doc.get('doctor_name', order_doc.get('customer_name', 'Customer'))
        order_number = order_doc.get('order_number', '')

        items_lines = []
        for item in items:
            item_dict = item if isinstance(item, dict) else item.dict()
            name = item_dict.get('item_name', 'Item')
            qty = int(item_dict.get('quantity', 1))
            rate = float(item_dict.get('rate', 0))
            items_lines.append(f"• {name} x{qty} @ Rs.{rate:.2f}")

        items_text = "\n".join(items_lines)
        item_count = str(len(items_lines))

        message = await render_wa_template('order_updated',
            customer_name=customer_name,
            order_number=order_number,
            items_text=items_text,
            item_count=item_count
        )

        if not message:
            short_name, phone = await get_company_short_name()
            message = f"Hello {customer_name},\n\nYour order *{order_number}* has been *UPDATED*.\n\n*Current Items ({item_count}):*\n{items_text}\n\nRegards,\n*{short_name}*"
            if phone:
                message += f"\n+{phone}"

        wa_phone = customer_phone if customer_phone.startswith('91') else f"91{customer_phone[-10:]}"
        resp = await send_wa_msg(wa_phone, message, config=config)
        status = 'success' if resp and resp.status_code == 200 else 'failed'
        await log_whatsapp_message(wa_phone, 'order_updated', message, status)

        # Also send email
        customer_email = order_doc.get('doctor_email') or order_doc.get('email')
        if customer_email:
            short_name, phone = await get_company_short_name()
            items_html = "<table style='border-collapse:collapse;width:100%'><tr><th style='padding:8px;border:1px solid #ddd;text-align:left'>Item</th><th style='padding:8px;border:1px solid #ddd;text-align:center'>Qty</th><th style='padding:8px;border:1px solid #ddd;text-align:right'>Rate</th></tr>"
            for item in items:
                item_dict = item if isinstance(item, dict) else item.dict()
                name = item_dict.get('item_name', 'Item')
                qty = int(item_dict.get('quantity', 1))
                rate = float(item_dict.get('rate', 0))
                items_html += f"<tr><td style='padding:8px;border:1px solid #ddd'>{name}</td><td style='padding:8px;border:1px solid #ddd;text-align:center'>{qty}</td><td style='padding:8px;border:1px solid #ddd;text-align:right'>Rs.{rate:.2f}</td></tr>"
            items_html += "</table>"

            body = f"<h2>Order #{order_number} - Updated</h2><p>Dear {customer_name},</p><p>Your order has been updated with the following items:</p>{items_html}<p>Regards,<br><strong>{short_name}</strong></p>"
            await send_notification_email(customer_email, f"Order #{order_number} Updated - {short_name}", body, customer_name)
    except Exception as e:
        logger.error(f"send_whatsapp_order_updated error: {e}")


async def send_whatsapp_payment_reminder(customer_phone: str, customer_name: str, outstanding_amount: float):
    """Send payment reminder via WhatsApp using template"""
    try:
        config = await get_whatsapp_config()
        if not config.get('api_url') or not config.get('auth_token'):
            return False

        amount_str = f"{outstanding_amount:,.2f}"
        message = await render_wa_template('payment_reminder',
            customer_name=customer_name,
            outstanding_amount=amount_str
        )

        if not message:
            short_name, phone = await get_company_short_name()
            message = f"Hello {customer_name},\n\nThis is a friendly reminder regarding your outstanding balance of *Rs. {amount_str}*.\n\nPlease arrange the payment at your earliest convenience.\n\nRegards,\n*{short_name}*"
            if phone:
                message += f"\n+{phone}"

        wa_phone = customer_phone if customer_phone.startswith('91') else f"91{customer_phone[-10:]}"
        resp = await send_wa_msg(wa_phone, message, config=config)
        status = 'success' if resp and resp.status_code == 200 else 'failed'
        await log_whatsapp_message(wa_phone, 'payment_reminder', message, status, recipient_name=customer_name)
        return status == 'success'
    except Exception as e:
        logger.error(f"send_whatsapp_payment_reminder error: {e}")
        return False
