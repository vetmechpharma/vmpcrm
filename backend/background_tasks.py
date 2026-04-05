"""Background tasks: daily reminders, greetings, monthly ledger, scheduled backups."""
import asyncio
import uuid
import random
import base64
import smtplib
import os
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from deps import db, logger
from utils.whatsapp import get_whatsapp_config, send_wa_msg, log_whatsapp_message
from utils.email_utils import send_notification_email
from utils.push import send_push_to_user
from utils.ledger import get_customer_ledger, generate_ledger_pdf_bytes


async def send_daily_reminder_summary():
    """Background task to send daily reminder summary to admin via WhatsApp"""
    while True:
        try:
            # Calculate time until next 8 AM
            now = datetime.now(timezone.utc)
            # For IST (UTC+5:30), 8 AM IST = 2:30 AM UTC
            target_hour = 2  # 2 AM UTC = ~7:30 AM IST
            target_minute = 30
            
            next_run = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
            if now >= next_run:
                # Already past today's run time, schedule for tomorrow
                next_run += timedelta(days=1)
            
            wait_seconds = (next_run - now).total_seconds()
            logger.info(f"Daily reminder task scheduled. Next run in {wait_seconds/3600:.1f} hours")
            
            await asyncio.sleep(wait_seconds)
            
            # Execute reminder summary send
            logger.info("Executing daily reminder summary...")
            
            # Get WhatsApp config
            wa_config = await db.whatsapp_config.find_one({}, {'_id': 0})
            if not wa_config:
                logger.warning("WhatsApp not configured, skipping daily reminder")
                continue
            
            # Get company settings for admin number
            company = await db.company_settings.find_one({}, {'_id': 0})
            admin_phone = company.get('phone') if company else None
            
            if not admin_phone:
                logger.warning("Admin phone not configured, skipping daily reminder")
                continue
            
            # Get today's date for reminders
            today = datetime.now(timezone.utc).date()
            today_str = today.strftime('%Y-%m-%d')
            
            # Get today's reminders count
            reminders = []
            
            # Manual reminders for today
            manual_count = await db.reminders.count_documents({
                'reminder_date': today_str,
                'is_completed': {'$ne': True}
            })
            
            # Get birthday/anniversary counts
            month_day = today.strftime('%m-%d')
            
            # Doctors with birthdays/follow-ups
            doctors = await db.doctors.find({
                'lead_status': {'$nin': ['Not Interested', 'Closed']}
            }, {'_id': 0, 'name': 1, 'dob': 1, 'follow_up_date': 1, 'last_contact_date': 1}).to_list(1000)
            
            birthday_count = 0
            followup_count = 0
            for doc in doctors:
                if doc.get('dob') and doc['dob'][5:] == month_day:
                    birthday_count += 1
                if doc.get('follow_up_date') and doc['follow_up_date'] <= today_str:
                    followup_count += 1
            
            # Medicals and Agencies birthdays/anniversaries
            medicals = await db.medicals.find({}, {'_id': 0, 'name': 1, 'birthday': 1, 'anniversary': 1, 'follow_up_date': 1}).to_list(1000)
            agencies = await db.agencies.find({}, {'_id': 0, 'name': 1, 'birthday': 1, 'anniversary': 1, 'follow_up_date': 1}).to_list(1000)
            
            anniversary_count = 0
            for entity in medicals + agencies:
                if entity.get('birthday') and entity['birthday'][5:] == month_day:
                    birthday_count += 1
                if entity.get('anniversary') and entity['anniversary'][5:] == month_day:
                    anniversary_count += 1
                if entity.get('follow_up_date') and entity['follow_up_date'] <= today_str:
                    followup_count += 1
            
            total_count = manual_count + birthday_count + anniversary_count + followup_count
            
            if total_count == 0:
                logger.info("No reminders today, skipping notification")
                continue
            
            # Collect detailed lists per type
            followup_list = []
            birthday_list = []
            anniversary_list = []

            for doc in doctors:
                if doc.get('dob') and doc['dob'][5:] == month_day:
                    birthday_list.append({'name': doc['name'], 'phone': doc.get('phone', ''), 'type': 'Doctor'})
                if doc.get('follow_up_date') and doc['follow_up_date'] <= today_str:
                    followup_list.append({'name': doc['name'], 'phone': doc.get('phone', ''), 'type': 'Doctor', 'status': doc.get('lead_status', '')})

            for entity in medicals + agencies:
                etype = 'Medical' if entity in medicals else 'Agency'
                if entity.get('birthday') and entity['birthday'][5:] == month_day:
                    birthday_list.append({'name': entity['name'], 'phone': entity.get('phone', ''), 'type': etype})
                if entity.get('anniversary') and entity['anniversary'][5:] == month_day:
                    anniversary_list.append({'name': entity['name'], 'phone': entity.get('phone', ''), 'type': etype})
                if entity.get('follow_up_date') and entity['follow_up_date'] <= today_str:
                    followup_list.append({'name': entity['name'], 'phone': entity.get('phone', ''), 'type': etype, 'status': entity.get('lead_status', '')})

            # Get manual/custom reminders
            manual_reminders = await db.reminders.find({
                'reminder_date': today_str,
                'is_completed': {'$ne': True}
            }, {'_id': 0, 'title': 1, 'entity_name': 1}).to_list(50)

            # Build message
            message_lines = [
                f"🌅 *Good Morning!*",
                f"📅 *Today's Reminders ({today_str})*",
                f"Total: {total_count} reminder(s)",
                ""
            ]

            if followup_list:
                message_lines.append(f"📞 *Follow-ups ({len(followup_list)}):*")
                for item in followup_list[:10]:
                    status_tag = f" [{item['status']}]" if item.get('status') else ''
                    message_lines.append(f"  • {item['name']} - {item['phone']}{status_tag}")
                if len(followup_list) > 10:
                    message_lines.append(f"  +{len(followup_list) - 10} more...")
                message_lines.append("")

            if birthday_list:
                message_lines.append(f"🎂 *Birthdays ({len(birthday_list)}):*")
                for item in birthday_list:
                    message_lines.append(f"  • {item['name']} - {item['phone']} ({item['type']})")
                message_lines.append("")

            if anniversary_list:
                message_lines.append(f"🎉 *Anniversaries ({len(anniversary_list)}):*")
                for item in anniversary_list:
                    message_lines.append(f"  • {item['name']} - {item['phone']} ({item['type']})")
                message_lines.append("")

            if manual_reminders:
                message_lines.append(f"📝 *Custom ({len(manual_reminders)}):*")
                for r in manual_reminders[:5]:
                    name_part = f" - {r['entity_name']}" if r.get('entity_name') else ''
                    message_lines.append(f"  • {r['title']}{name_part}")
                if len(manual_reminders) > 5:
                    message_lines.append(f"  +{len(manual_reminders) - 5} more...")
                message_lines.append("")

            message_lines.append("Login to CRM to view details.")
            
            message = "\n".join(message_lines)
            
            # Send WhatsApp
            try:
                response = await send_wa_msg(admin_phone, message, config=wa_config)
                if response and response.status_code == 200:
                    logger.info(f"Daily reminder sent to admin: {admin_phone}")
                else:
                    logger.error(f"Failed to send daily reminder: {response.text if response else 'no_response'}")
            except Exception as e:
                logger.error(f"Error sending daily reminder: {str(e)}")
            
        except asyncio.CancelledError:
            logger.info("Daily reminder task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in daily reminder task: {str(e)}")
            # Wait 1 hour before retrying on error
            await asyncio.sleep(3600)


async def send_birthday_anniversary_greetings():
    """Background task to auto-send birthday/anniversary greetings at 10 AM IST via WhatsApp & Email"""
    while True:
        try:
            now = datetime.now(timezone.utc)
            # 10 AM IST = 4:30 AM UTC
            target_hour = 4
            target_minute = 30

            next_run = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
            if now >= next_run:
                next_run += timedelta(days=1)

            wait_seconds = (next_run - now).total_seconds()
            logger.info(f"Birthday/Anniversary greeting task scheduled. Next run in {wait_seconds/3600:.1f} hours")
            await asyncio.sleep(wait_seconds)

            logger.info("Executing birthday/anniversary greetings...")

            today = datetime.now(timezone.utc).date()
            today_md = today.strftime('%m-%d')

            # Get company name
            company = await db.company_settings.find_one({}, {'_id': 0})
            company_name = company.get('name', 'Our Company') if company else 'Our Company'

            # Get configs
            wa_config = await db.whatsapp_config.find_one({}, {'_id': 0})
            smtp_config = await db.smtp_config.find_one({}, {'_id': 0})

            # Collect all birthday/anniversary people
            contacts = []

            # Doctors (use dob field)
            doctors = await db.doctors.find({'dob': {'$exists': True, '$ne': None, '$ne': ''}}, {'_id': 0}).to_list(1000)
            for doc in doctors:
                if doc.get('dob') and doc['dob'][5:] == today_md:
                    contacts.append({'name': doc['name'], 'phone': doc.get('phone', ''), 'email': doc.get('email', ''), 'type': 'birthday', 'entity_type': 'doctor', 'entity_id': doc['id']})

            # Medicals
            medicals = await db.medicals.find({}, {'_id': 0, 'name': 1, 'id': 1, 'phone': 1, 'email': 1, 'birthday': 1, 'anniversary': 1, 'proprietor_name': 1}).to_list(1000)
            for m in medicals:
                if m.get('birthday') and m['birthday'][5:] == today_md:
                    contacts.append({'name': m.get('proprietor_name') or m['name'], 'phone': m.get('phone', ''), 'email': m.get('email', ''), 'type': 'birthday', 'entity_type': 'medical', 'entity_id': m['id']})
                if m.get('anniversary') and m['anniversary'][5:] == today_md:
                    contacts.append({'name': m['name'], 'phone': m.get('phone', ''), 'email': m.get('email', ''), 'type': 'anniversary', 'entity_type': 'medical', 'entity_id': m['id']})

            # Agencies
            agencies = await db.agencies.find({}, {'_id': 0, 'name': 1, 'id': 1, 'phone': 1, 'email': 1, 'birthday': 1, 'anniversary': 1, 'proprietor_name': 1}).to_list(1000)
            for a in agencies:
                if a.get('birthday') and a['birthday'][5:] == today_md:
                    contacts.append({'name': a.get('proprietor_name') or a['name'], 'phone': a.get('phone', ''), 'email': a.get('email', ''), 'type': 'birthday', 'entity_type': 'agency', 'entity_id': a['id']})
                if a.get('anniversary') and a['anniversary'][5:] == today_md:
                    contacts.append({'name': a['name'], 'phone': a.get('phone', ''), 'email': a.get('email', ''), 'type': 'anniversary', 'entity_type': 'agency', 'entity_id': a['id']})

            if not contacts:
                logger.info("No birthdays/anniversaries today")
                continue

            logger.info(f"Found {len(contacts)} birthday/anniversary contacts today")

            for contact in contacts:
                try:
                    # Get a random active template
                    templates = await db.greeting_templates.find(
                        {'type': contact['type'], 'is_active': True}, {'_id': 0}
                    ).to_list(50)

                    if not templates:
                        logger.warning(f"No active {contact['type']} templates found")
                        continue

                    import random
                    template = random.choice(templates)
                    message = template['message'].replace('{customer_name}', contact['name']).replace('{company_name}', company_name)
                    image_url = template.get('image_url', '')

                    # Send WhatsApp
                    if wa_config and contact.get('phone'):
                        try:
                            if image_url:
                                resp = await send_wa_msg(contact['phone'], message, file_url=image_url, file_caption=message, config=wa_config)
                            else:
                                resp = await send_wa_msg(contact['phone'], message, config=wa_config)
                            logger.info(f"WhatsApp greeting sent to {contact['name']} ({contact['phone']}): {resp.status_code if resp else 'no_response'}")
                        except Exception as we:
                            logger.error(f"WhatsApp greeting failed for {contact['name']}: {we}")

                    # Send Email
                    if smtp_config and contact.get('email'):
                        try:
                            subject = f"Happy {'Birthday' if contact['type'] == 'birthday' else 'Anniversary'}! - {company_name}"
                            html_body = f"""
                            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                                {'<img src="' + image_url + '" style="width:100%;max-width:600px;border-radius:12px;margin-bottom:20px;" />' if image_url else ''}
                                <div style="white-space:pre-line;font-size:16px;line-height:1.6;color:#333;">{message}</div>
                                <hr style="margin:20px 0;border:none;border-top:1px solid #eee;" />
                                <p style="font-size:12px;color:#999;">Sent with love from {company_name}</p>
                            </div>"""
                            msg = MIMEMultipart()
                            msg['From'] = f"{smtp_config['from_name']} <{smtp_config['from_email']}>"
                            msg['To'] = f"{contact['name']} <{contact['email']}>"
                            msg['Subject'] = subject
                            msg.attach(MIMEText(html_body, 'html'))
                            with smtplib.SMTP(smtp_config['smtp_server'], smtp_config['smtp_port'], timeout=30) as server:
                                server.starttls()
                                server.login(smtp_config['smtp_username'], smtp_config['smtp_password'])
                                server.sendmail(smtp_config['from_email'], [contact['email']], msg.as_string())
                            logger.info(f"Email greeting sent to {contact['name']} ({contact['email']})")
                        except Exception as ee:
                            logger.error(f"Email greeting failed for {contact['name']}: {ee}")

                    # Log the greeting
                    await db.greeting_logs.insert_one({
                        'id': str(uuid.uuid4()),
                        'contact_name': contact['name'],
                        'contact_phone': contact.get('phone', ''),
                        'contact_email': contact.get('email', ''),
                        'entity_type': contact['entity_type'],
                        'entity_id': contact['entity_id'],
                        'greeting_type': contact['type'],
                        'template_id': template.get('id'),
                        'message': message,
                        'sent_at': datetime.now(timezone.utc).isoformat()
                    })

                    # Send push notification for birthday/anniversary
                    try:
                        greeting_label = 'Birthday' if contact['type'] == 'birthday' else 'Anniversary'
                        portal_cust = await db.portal_customers.find_one({
                            '$or': [
                                {'linked_record_id': contact.get('entity_id')},
                                {'phone': contact.get('phone')}
                            ]
                        }, {'_id': 0, 'id': 1})
                        if portal_cust:
                            await send_push_to_user(portal_cust['id'], 'customer',
                                f'Happy {greeting_label}!',
                                message[:100],
                                '/', f'greeting-{contact["type"]}')
                    except Exception as pe:
                        logger.error(f"Push greeting failed for {contact['name']}: {pe}")

                except Exception as ce:
                    logger.error(f"Error sending greeting to {contact['name']}: {ce}")

        except asyncio.CancelledError:
            logger.info("Birthday/Anniversary greeting task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in greeting task: {str(e)}")
            await asyncio.sleep(3600)


async def seed_default_greeting_templates():
    """Seed default greeting templates if none exist"""
    count = await db.greeting_templates.count_documents({})
    if count > 0:
        return

    templates = [
        # Birthday templates
        {"id": str(uuid.uuid4()), "type": "birthday", "is_active": True,
         "message": "Dear {customer_name},\n\nWishing you a very Happy Birthday! May this special day bring you endless joy and happiness.\n\nWarm regards,\n{company_name} Family",
         "image_url": ""},
        {"id": str(uuid.uuid4()), "type": "birthday", "is_active": True,
         "message": "Happy Birthday, {customer_name}!\n\nMay your birthday be filled with sunshine and smiles, laughter and love. Here's to another wonderful year!\n\nBest wishes,\n{company_name}",
         "image_url": ""},
        {"id": str(uuid.uuid4()), "type": "birthday", "is_active": True,
         "message": "Many happy returns of the day, {customer_name}!\n\nOn your special day, we wish you nothing but the best. May all your dreams come true.\n\nWith love,\nTeam {company_name}",
         "image_url": ""},
        {"id": str(uuid.uuid4()), "type": "birthday", "is_active": True,
         "message": "Dear {customer_name},\n\nHappiest birthday to you! We value our association with you and wish you good health and prosperity.\n\nCheers,\n{company_name}",
         "image_url": ""},
        {"id": str(uuid.uuid4()), "type": "birthday", "is_active": True,
         "message": "Happy Birthday {customer_name}!\n\nAnother year of success, health and happiness. Wishing you the best on your big day!\n\nRegards,\n{company_name} Team",
         "image_url": ""},
        {"id": str(uuid.uuid4()), "type": "birthday", "is_active": True,
         "message": "Dear {customer_name},\n\nBirthdays are nature's way of telling us to eat more cake! Wishing you a day filled with sweet moments.\n\nHappy Birthday!\n{company_name}",
         "image_url": ""},
        {"id": str(uuid.uuid4()), "type": "birthday", "is_active": True,
         "message": "Warmest wishes on your birthday, {customer_name}!\n\nMay this year bring new goals, new achievements and a whole lot of new inspirations.\n\nFrom all of us at {company_name}",
         "image_url": ""},
        {"id": str(uuid.uuid4()), "type": "birthday", "is_active": True,
         "message": "Dear {customer_name},\n\nWishing you a birthday that's as special as you are! Thank you for being a valued part of our family.\n\nHappy Birthday!\n{company_name}",
         "image_url": ""},
        # Anniversary templates
        {"id": str(uuid.uuid4()), "type": "anniversary", "is_active": True,
         "message": "Dear {customer_name},\n\nHappy Anniversary! Congratulations on another successful year. Wishing you continued growth and prosperity.\n\nBest regards,\n{company_name}",
         "image_url": ""},
        {"id": str(uuid.uuid4()), "type": "anniversary", "is_active": True,
         "message": "Congratulations on your anniversary, {customer_name}!\n\nAnother milestone achieved! We are proud to be associated with your journey of success.\n\nWarm wishes,\n{company_name} Team",
         "image_url": ""},
        {"id": str(uuid.uuid4()), "type": "anniversary", "is_active": True,
         "message": "Happy Anniversary {customer_name}!\n\nCelebrating your remarkable journey today. May the years ahead bring even more success and achievements.\n\nBest wishes,\n{company_name}",
         "image_url": ""},
        {"id": str(uuid.uuid4()), "type": "anniversary", "is_active": True,
         "message": "Dear {customer_name},\n\nWishing you a wonderful anniversary! Thank you for your continued trust and partnership with us.\n\nWith appreciation,\n{company_name} Family",
         "image_url": ""},
        {"id": str(uuid.uuid4()), "type": "anniversary", "is_active": True,
         "message": "Happy Anniversary {customer_name}!\n\nEvery year together is a year of growth. Here's to many more successful years ahead!\n\nCheers,\nTeam {company_name}",
         "image_url": ""},
        {"id": str(uuid.uuid4()), "type": "anniversary", "is_active": True,
         "message": "Dear {customer_name},\n\nOn this special anniversary, we celebrate the wonderful bond we share. May it grow stronger with each passing year.\n\nHeartfelt wishes,\n{company_name}",
         "image_url": ""},
        {"id": str(uuid.uuid4()), "type": "anniversary", "is_active": True,
         "message": "Congratulations {customer_name}!\n\nAnother glorious year! Your dedication inspires us. Wishing you an amazing anniversary and a bright future.\n\nRegards,\n{company_name}",
         "image_url": ""},
    ]

    for t in templates:
        t['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.greeting_templates.insert_many(templates)
    logger.info(f"Seeded {len(templates)} default greeting templates")

async def send_monthly_ledger_statements():
    """Background task to send ledger statements on the 27th of every month to all parties with outstanding balance"""
    while True:
        try:
            now = datetime.now(timezone.utc)
            # Target: 27th of current/next month at 10 AM IST (4:30 AM UTC)
            target_day = 27
            target_hour = 4
            target_minute = 30
            
            # Calculate next run
            if now.day < target_day or (now.day == target_day and now.hour < target_hour):
                next_run = now.replace(day=target_day, hour=target_hour, minute=target_minute, second=0, microsecond=0)
            else:
                # Next month
                if now.month == 12:
                    next_run = now.replace(year=now.year + 1, month=1, day=target_day, hour=target_hour, minute=target_minute, second=0, microsecond=0)
                else:
                    next_run = now.replace(month=now.month + 1, day=target_day, hour=target_hour, minute=target_minute, second=0, microsecond=0)
            
            wait_seconds = (next_run - now).total_seconds()
            logger.info(f"Monthly ledger task scheduled. Next run on {next_run.strftime('%d %b %Y')} ({wait_seconds/3600:.1f} hours)")
            await asyncio.sleep(wait_seconds)
            
            # Execute: send ledger statements to all customers with outstanding balance
            logger.info("Starting monthly ledger statement distribution...")
            company = await db.company_settings.find_one({}, {'_id': 0})
            company_name = (company or {}).get('company_name', 'VMP CRM')
            config = await get_whatsapp_config()
            app_base_url = os.environ.get('APP_BASE_URL', '').rstrip('/')
            
            sent_count = 0
            for coll_name, cust_type in [('doctors', 'doctor'), ('medicals', 'medical'), ('agencies', 'agency')]:
                customers = await db[coll_name].find({'status': 'active'}, {'_id': 0}).to_list(5000)
                for cust in customers:
                    try:
                        # Calculate outstanding balance
                        opening_bal = cust.get('opening_balance', 0) or 0
                        pipeline = [{'$match': {'customer_id': cust['id']}}, {'$group': {'_id': None, 'total': {'$sum': '$net_amount'}}}]
                        inv_result = await db.invoices.aggregate(pipeline).to_list(1)
                        total_invoiced = inv_result[0]['total'] if inv_result else 0
                        pay_pipeline = [{'$match': {'customer_id': cust['id']}}, {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}]
                        pay_result = await db.payments.aggregate(pay_pipeline).to_list(1)
                        total_paid = pay_result[0]['total'] if pay_result else 0
                        outstanding = opening_bal + total_invoiced - total_paid
                        
                        if outstanding <= 0:
                            continue  # Skip customers with no outstanding balance
                        
                        # Build ledger data
                        fake_user = {'id': 'system', 'name': 'System', 'role': 'admin'}
                        try:
                            ledger = await get_customer_ledger(cust_type, cust['id'], None, None, fake_user)
                        except Exception:
                            continue
                        
                        # Generate summary message
                        summary_msg = (
                            f"*{company_name}*\n"
                            f"*MONTHLY LEDGER STATEMENT*\n"
                            f"{'─' * 28}\n"
                            f"Customer: {cust['name']}\n"
                            f"Statement Date: {now.strftime('%d %b %Y')}\n"
                            f"{'─' * 28}\n"
                            f"*Outstanding Balance: Rs.{outstanding:,.2f}*\n"
                            f"{'─' * 28}\n"
                            f"Please find detailed PDF statement attached.\n"
                            f"Kindly arrange payment at the earliest.\n"
                        )
                        
                        # Generate PDF
                        pdf_bytes = generate_ledger_pdf_bytes(ledger, company_name)
                        
                        # Store temp PDF for WhatsApp
                        pdf_token = str(uuid.uuid4())
                        await db.temp_ledger_pdfs.insert_one({
                            'token': pdf_token,
                            'pdf_data': base64.b64encode(pdf_bytes).decode('utf-8'),
                            'customer_name': cust['name'],
                            'created_at': now.isoformat(),
                            'expires_at': (now + timedelta(hours=48)).isoformat()
                        })
                        
                        # Send WhatsApp with PDF
                        if config and cust.get('phone'):
                            wa_mobile = cust['phone'] if cust['phone'].startswith('91') else f"91{cust['phone'][-10:]}"
                            pdf_url = f"{app_base_url}/api/ledger-pdf/{pdf_token}.pdf" if app_base_url else None
                            try:
                                if pdf_url:
                                    await send_wa_msg(wa_mobile, summary_msg, file_url=pdf_url, file_caption=summary_msg, config=config)
                                else:
                                    await send_wa_msg(wa_mobile, summary_msg, config=config)
                                await log_whatsapp_message(wa_mobile, 'monthly_ledger', summary_msg[:200], 'success', recipient_name=cust['name'])
                            except Exception as we:
                                logger.error(f"Monthly ledger WhatsApp error for {cust['name']}: {we}")
                        
                        # Send email with PDF attachment
                        if cust.get('email'):
                            try:
                                email_body = f"""<p>Dear <strong>{cust['name']}</strong>,</p>
<p>Please find your monthly ledger statement attached.</p>
<div style="background:#fef3c7;padding:16px;border-radius:6px;border-left:4px solid #f59e0b;margin:16px 0;">
<p style="margin:0;font-weight:bold;color:#92400e;">Outstanding Balance: Rs.{outstanding:,.2f}</p></div>
<p>Kindly arrange payment at the earliest. For any discrepancies, please contact us.</p>"""
                                filename = f"Ledger_{cust['name'].replace(' ', '_')}_{now.strftime('%Y%m')}.pdf"
                                await send_notification_email(cust['email'], cust['name'], f"Monthly Statement - {company_name}", email_body, cust['id'], 'monthly_ledger', attachment_data=pdf_bytes, attachment_filename=filename)
                            except Exception as ee:
                                logger.error(f"Monthly ledger email error for {cust['name']}: {ee}")
                        
                        sent_count += 1
                        await asyncio.sleep(3)  # Throttle between customers
                        
                    except Exception as ce:
                        logger.error(f"Monthly ledger error for {cust.get('name', 'unknown')}: {ce}")
            
            logger.info(f"Monthly ledger distribution complete. Sent to {sent_count} customers.")
            
            # Clean up expired temp PDFs
            await db.temp_ledger_pdfs.delete_many({
                'expires_at': {'$lt': datetime.now(timezone.utc).isoformat()}
            })
            
        except asyncio.CancelledError:
            logger.info("Monthly ledger statement task cancelled")
            break
        except Exception as e:
            logger.error(f"Monthly ledger task error: {e}")
            await asyncio.sleep(3600)  # Retry in 1 hour on error



async def cleanup_temp_files():
    """Background task to clean up expired temp PDFs and backup files every 6 hours"""
    while True:
        try:
            await asyncio.sleep(6 * 3600)  # Run every 6 hours
            
            now_iso = datetime.now(timezone.utc).isoformat()
            
            # Clean expired ledger PDFs (older than 48 hours)
            result = await db.temp_ledger_pdfs.delete_many({
                'expires_at': {'$lt': now_iso}
            })
            if result.deleted_count:
                logger.info(f"Cleaned up {result.deleted_count} expired ledger PDFs")
            
            # Clean expired backup files (older than 48 hours)
            result = await db.temp_backup_files.delete_many({
                'expires_at': {'$lt': now_iso}
            })
            if result.deleted_count:
                logger.info(f"Cleaned up {result.deleted_count} expired backup files")
            
            # Also clean any really old entries without expires_at (2 days old)
            cutoff = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
            for coll_name in ['temp_ledger_pdfs', 'temp_backup_files']:
                result = await db[coll_name].delete_many({
                    'expires_at': {'$exists': False},
                    'created_at': {'$lt': cutoff}
                })
                if result.deleted_count:
                    logger.info(f"Cleaned up {result.deleted_count} old entries from {coll_name}")
                    
        except asyncio.CancelledError:
            logger.info("Temp file cleanup task cancelled")
            break
        except Exception as e:
            logger.error(f"Temp file cleanup error: {e}")
            await asyncio.sleep(3600)
