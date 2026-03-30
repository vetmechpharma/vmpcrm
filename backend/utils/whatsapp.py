"""WhatsApp utility functions - sending, logging, OTP."""
import httpx
from deps import db, logger
from utils.templates import get_wa_template, get_company_short_name


async def get_whatsapp_config():
    """Get active WhatsApp config from database with field mapping defaults"""
    config = await db.whatsapp_config.find_one({'is_active': True}, {'_id': 0})
    if not config:
        config = await db.whatsapp_config.find_one({}, {'_id': 0})
    if not config:
        return {
            'api_url': 'https://api.botmastersender.com/api/v1/',
            'auth_token': '1d97fa5b-b9f8-4b1c-9479-cae962594d5f',
            'sender_id': '919944472488',
            'http_method': 'GET',
            'field_action': 'action',
            'field_sender_id': 'senderId',
            'field_auth_token': 'authToken',
            'field_message': 'messageText',
            'field_receiver': 'receiverId',
            'field_file_url': 'fileUrl',
            'field_file_caption': 'fileCaption',
            'action_send': 'send',
            'action_send_file': 'sendFile',
        }
    defaults = {
        'http_method': 'GET',
        'field_action': 'action',
        'field_sender_id': 'senderId',
        'field_auth_token': 'authToken',
        'field_message': 'messageText',
        'field_receiver': 'receiverId',
        'field_file_url': 'fileUrl',
        'field_file_caption': 'fileCaption',
        'action_send': 'send',
        'action_send_file': 'sendFile',
    }
    for k, v in defaults.items():
        if k not in config or not config[k]:
            config[k] = v
    return config


def build_wa_params(config, message=None, receiver=None, file_url=None, file_caption=None):
    """Build WhatsApp API params dynamically from config field mappings"""
    params = {}
    fa = config.get('field_action', 'action')
    if fa:
        if file_url:
            params[fa] = config.get('action_send_file', 'sendFile')
        else:
            params[fa] = config.get('action_send', 'send')
    fsi = config.get('field_sender_id', 'senderId')
    if fsi:
        params[fsi] = config.get('sender_id', '')
    fat = config.get('field_auth_token', 'authToken')
    if fat:
        params[fat] = config.get('auth_token', '')
    fr = config.get('field_receiver', 'receiverId')
    if fr:
        params[fr] = receiver
    if file_url:
        ffu = config.get('field_file_url', 'fileUrl')
        if ffu:
            params[ffu] = file_url
        ffc = config.get('field_file_caption', 'fileCaption')
        if ffc:
            params[ffc] = file_caption or message
    else:
        fm = config.get('field_message', 'messageText')
        if fm:
            params[fm] = message
    return params


async def execute_wa_request(config, params, headers=None):
    """Execute WhatsApp API request using config method (GET or POST)"""
    method = config.get('http_method', 'GET').upper()
    async with httpx.AsyncClient(timeout=30.0) as client:
        if method == 'POST':
            response = await client.post(config['api_url'], json=params, headers=headers)
        else:
            response = await client.get(config['api_url'], params=params, headers=headers)
        return response


async def execute_rest_api_wa(config, receiver, message=None, file_url=None, file_caption=None):
    """Execute WhatsApp send via REST API type (AKNexus style)"""
    base_url = config['api_url'].rstrip('/')
    access_token = config.get('auth_token', '')
    instance_id = config.get('instance_id', '')
    async with httpx.AsyncClient(timeout=30.0) as client:
        if file_url:
            is_pdf = file_url.lower().endswith('.pdf')
            payload = {
                'number': receiver,
                'type': 'media',
                'message': file_caption or message or '',
                'media_url': file_url,
                'instance_id': instance_id,
                'access_token': access_token,
            }
            if is_pdf:
                payload['filename'] = 'Ledger_Statement.pdf'
        else:
            payload = {
                'number': receiver,
                'type': 'text',
                'message': message or '',
                'instance_id': instance_id,
                'access_token': access_token,
            }
        endpoint = f"{base_url}/send"
        logger.info(f"REST API WA send: {endpoint} -> {receiver} (type={payload['type']})")
        response = await client.post(endpoint, json=payload)
        return response


async def send_wa_msg(receiver: str, message: str, file_url: str = None, file_caption: str = None, config=None):
    """Universal WhatsApp message sender."""
    if not config:
        config = await get_whatsapp_config()
    if not config or not config.get('api_url'):
        return None
    clean_receiver = ''.join(filter(str.isdigit, str(receiver)))
    if not clean_receiver.startswith('91'):
        clean_receiver = f"91{clean_receiver[-10:]}"

    api_type = config.get('api_type', 'query_param')

    try:
        if api_type == 'rest_api':
            response = await execute_rest_api_wa(config, clean_receiver, message, file_url, file_caption)
            if response:
                body = response.text.strip()
                is_success = response.status_code == 200 and ('Page not found' not in body)
                if is_success:
                    logger.info(f"REST API WA success: {'media' if file_url else 'text'} to {clean_receiver}, body={body[:200]}")
                else:
                    logger.warning(f"REST API WA failed: status={response.status_code}, body={body[:300]}")
            return response
        else:
            params = build_wa_params(config, message=message, receiver=clean_receiver, file_url=file_url, file_caption=file_caption)
            response = await execute_wa_request(config, params)
            if response and response.status_code == 200 and file_url:
                body = response.text.strip()
                is_success = '"success":true' in body or '"success": true' in body
                if not is_success:
                    logger.warning(f"WhatsApp file send failed (body={body[:200]}). Falling back to text-only.")
                    text_params = build_wa_params(config, message=file_caption or message, receiver=clean_receiver)
                    response = await execute_wa_request(config, text_params)
                    if response:
                        logger.info(f"WhatsApp text fallback: status={response.status_code}, body={response.text[:200]}")
                else:
                    logger.info(f"WhatsApp file send success: file_url={file_url[:100]}")
            elif response and response.status_code != 200:
                logger.error(f"WhatsApp API error: status={response.status_code}, body={response.text[:500]}")
            return response
    except Exception as e:
        logger.error(f"WhatsApp send error: {e}")
        return None


import uuid
from datetime import datetime, timezone

async def log_whatsapp_message(
    recipient_phone: str,
    message_type: str,
    message_preview: str,
    status: str,
    recipient_name: str = None,
    error_message: str = None
):
    """Log WhatsApp message to database"""
    try:
        log_doc = {
            'id': str(uuid.uuid4()),
            'recipient_phone': recipient_phone,
            'recipient_name': recipient_name,
            'message_type': message_type,
            'message_preview': message_preview[:500] if message_preview else '',
            'status': status,
            'error_message': error_message,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.whatsapp_logs.insert_one(log_doc)
    except Exception as e:
        logger.error(f"Failed to log WhatsApp message: {str(e)}")


async def send_whatsapp_otp(mobile: str, otp: str):
    """Send OTP via WhatsApp API"""
    config = await get_whatsapp_config()
    
    if not config:
        logger.warning("WhatsApp config not found, OTP not sent via WhatsApp")
        await log_whatsapp_message(mobile, 'otp', f"OTP: {otp}", 'failed', error_message='WhatsApp not configured')
        return True
    
    clean_mobile = ''.join(filter(str.isdigit, mobile))
    if not clean_mobile.startswith('91'):
        clean_mobile = f"91{clean_mobile[-10:]}"
    
    message = f"Your VMP CRM verification code is: {otp}. Valid for 5 minutes."
    tmpl = await get_wa_template('otp')
    if tmpl:
        short_name, _ = await get_company_short_name()
        try:
            message = tmpl.format(otp=otp, company_short_name=short_name)
        except Exception:
            pass
    
    try:
        response = await send_wa_msg(clean_mobile, message, config=config)
        if response and response.status_code == 200:
            logger.info(f"WhatsApp OTP sent to {clean_mobile}: {response.status_code}")
            await log_whatsapp_message(clean_mobile, 'otp', message, 'success')
            return True
        else:
            status_code = response.status_code if response else 'no_response'
            logger.error(f"WhatsApp OTP failed: {status_code}")
            await log_whatsapp_message(clean_mobile, 'otp', message, 'failed', error_message=f"Status {status_code}")
            return True
    except Exception as e:
        logger.error(f"WhatsApp OTP error: {str(e)}")
        await log_whatsapp_message(clean_mobile, 'otp', message, 'failed', error_message=str(e))
        return True
