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
            qty_raw = item_dict.get('quantity', 1)
            rate_raw = item_dict.get('rate', 0)
            try:
                qty = int(qty_raw)
            except (ValueError, TypeError):
                qty = str(qty_raw)
            try:
                rate = float(rate_raw)
            except (ValueError, TypeError):
                rate = 0
            amount = (qty if isinstance(qty, int) else 1) * rate
            total += amount
            items_lines.append(f"• {name} x{qty}")

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
            qty_raw = item_dict.get('quantity', 1)
            rate_raw = item_dict.get('rate', 0)
            try:
                qty = int(qty_raw)
            except (ValueError, TypeError):
                qty = str(qty_raw)
            try:
                rate = float(rate_raw)
            except (ValueError, TypeError):
                rate = 0
            amount = (qty if isinstance(qty, int) else 1) * rate
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
        delivery_station = ''
        package_details = ''
        payment_info = ''
        invoice_number = ''
        invoice_date = ''
        invoice_value = ''

        # Get data from update_data (fresh status change) or order_doc (already stored)
        ud = update_data or {}
        transport_name = ud.get('transport_name') or order_doc.get('transport_name', '')
        tracking_number = ud.get('tracking_number') or order_doc.get('tracking_number', '')
        delivery_station = ud.get('delivery_station') or order_doc.get('delivery_station', '')
        invoice_number = ud.get('invoice_number') or order_doc.get('invoice_number', '')
        invoice_date = ud.get('invoice_date') or order_doc.get('invoice_date', '')
        invoice_value = ud.get('invoice_value') or order_doc.get('invoice_value', '')

        # Build package details
        boxes = ud.get('boxes_count') or order_doc.get('boxes_count', 0)
        cans = ud.get('cans_count') or order_doc.get('cans_count', 0)
        bags = ud.get('bags_count') or order_doc.get('bags_count', 0)
        pkg_lines = []
        if boxes: pkg_lines.append(f"Boxes: {boxes}")
        if cans: pkg_lines.append(f"Cans: {cans}")
        if bags: pkg_lines.append(f"Bags: {bags}")
        package_details = "\n".join(pkg_lines) if pkg_lines else "N/A"

        # Build payment info (only show if to_pay)
        payment_mode = ud.get('payment_mode') or order_doc.get('payment_mode', '')
        payment_amount = ud.get('payment_amount') or order_doc.get('payment_amount', 0)
        if payment_mode == 'to_pay' and payment_amount:
            payment_info = f"\n*Payment:* To Pay - Rs. {payment_amount}\n"
        else:
            payment_info = ''

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
                transport_name=transport_name or 'N/A',
                tracking_number=tracking_number or 'N/A',
                delivery_station=delivery_station or 'N/A',
                package_details=package_details,
                payment_info=payment_info,
                invoice_number=invoice_number or 'N/A',
                invoice_date=invoice_date or 'N/A',
                invoice_value=str(invoice_value) if invoice_value else 'N/A'
            )

        if not message:
            short_name, phone = await get_company_short_name()
            message = f"Hello {customer_name},\n\nYour order *{order_number}* has been *{status_label}*!"
            if new_status == 'shipped':
                if transport_name: message += f"\n\n*Transport:* {transport_name}"
                if tracking_number: message += f"\n*Tracking:* {tracking_number}"
                if delivery_station: message += f"\n*Delivery Station:* {delivery_station}"
                if pkg_lines: message += f"\n\n*Package:*\n{package_details}"
                if payment_info: message += payment_info
            elif new_status == 'delivered':
                if invoice_number: message += f"\n\n*Invoice No:* {invoice_number}"
                if invoice_date: message += f"\n*Invoice Date:* {invoice_date}"
                if invoice_value: message += f"\n*Invoice Value:* Rs. {invoice_value}"
            message += f"\n\nRegards,\n*{short_name}*"
            if phone:
                message += f"\n+{phone}"

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

        # Look up transport phone from transports collection
        ud = update_data or {}
        transport_id = ud.get('transport_id') or order_doc.get('transport_id')
        transport_phone = ''
        transport_contact_name = ''
        
        if transport_id:
            transport = await db.transports.find_one({'id': transport_id}, {'_id': 0})
            if transport:
                transport_phone = transport.get('contact_number', '')
                transport_contact_name = transport.get('name', '')
        
        if not transport_phone:
            return

        short_name, phone = await get_company_short_name()
        transport_name = ud.get('transport_name') or order_doc.get('transport_name') or transport_contact_name or 'Transporter'
        order_number = order_doc.get('order_number', '')
        customer_name = order_doc.get('doctor_name', order_doc.get('customer_name', 'Customer'))
        customer_city = order_doc.get('doctor_city', order_doc.get('city', ''))
        delivery_station = ud.get('delivery_station') or order_doc.get('delivery_station', '')

        # Build package details
        boxes = ud.get('boxes_count') or order_doc.get('boxes_count', 0)
        cans = ud.get('cans_count') or order_doc.get('cans_count', 0)
        bags = ud.get('bags_count') or order_doc.get('bags_count', 0)
        pkg_lines = []
        if boxes: pkg_lines.append(f"Boxes: {boxes}")
        if cans: pkg_lines.append(f"Cans: {cans}")
        if bags: pkg_lines.append(f"Bags: {bags}")

        # Invoice & payment details
        invoice_number = ud.get('invoice_number') or order_doc.get('invoice_number', '')
        invoice_date = ud.get('invoice_date') or order_doc.get('invoice_date', '')
        invoice_value = ud.get('invoice_value') or order_doc.get('invoice_value', '')
        payment_mode = ud.get('payment_mode') or order_doc.get('payment_mode', '')
        payment_amount = ud.get('payment_amount') or order_doc.get('payment_amount', 0)

        message = f"Hello {transport_name},\n\nOrder *{order_number}* for *{customer_name}*"
        if customer_city:
            message += f" ({customer_city})"
        message += f" is ready for pickup/dispatch."
        if delivery_station:
            message += f"\n\n*Delivery Station:* {delivery_station}"
        if invoice_number:
            message += f"\n\n*Invoice No:* {invoice_number}"
            if invoice_date:
                message += f"\n*Invoice Date:* {invoice_date}"
            if invoice_value:
                message += f"\n*Invoice Value:* Rs. {invoice_value}"
        if payment_mode:
            mode_label = 'Paid' if payment_mode == 'paid' else 'To Pay'
            message += f"\n*Payment:* {mode_label}"
            if payment_mode == 'to_pay' and payment_amount:
                message += f" - Rs. {payment_amount}"
        if pkg_lines:
            message += f"\n\n*Package:*\n" + "\n".join(pkg_lines)
        message += f"\n\nRegards,\n*{short_name}*"
        if phone:
            message += f"\n+{phone}"

        clean_tp = ''.join(filter(str.isdigit, transport_phone))
        wa_phone = f"91{clean_tp[-10:]}" if len(clean_tp) >= 10 else transport_phone
        resp = await send_wa_msg(wa_phone, message, config=config)
        status = 'success' if resp and resp.status_code == 200 else 'failed'
        await log_whatsapp_message(wa_phone, 'transport_ready', message, status, recipient_name=transport_name)
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
            qty = str(item_dict.get('quantity', '1'))
            rate = item_dict.get('rate', 0)
            try:
                rate = float(rate)
                items_lines.append(f"• {name} x{qty} @ Rs.{rate:.2f}")
            except (ValueError, TypeError):
                items_lines.append(f"• {name} x{qty}")

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
                qty = str(item_dict.get('quantity', '1'))
                rate = item_dict.get('rate', 0)
                try:
                    rate_str = f"Rs.{float(rate):.2f}"
                except (ValueError, TypeError):
                    rate_str = str(rate)
                items_html += f"<tr><td style='padding:8px;border:1px solid #ddd'>{name}</td><td style='padding:8px;border:1px solid #ddd;text-align:center'>{qty}</td><td style='padding:8px;border:1px solid #ddd;text-align:right'>{rate_str}</td></tr>"
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
