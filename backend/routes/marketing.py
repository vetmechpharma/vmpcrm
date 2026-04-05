from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from pydantic import BaseModel
from utils.image import process_image_to_webp
from PIL import Image
from io import BytesIO
from models.schemas import (MarketingTemplateCreate, MarketingTemplateResponse,
    MarketingCampaignCreate, MarketingCampaignResponse, CampaignLogResponse,
    OrderItem, OTPRequest, OrderResponse, OTPVerify)
from utils.whatsapp import get_whatsapp_config, send_wa_msg, log_whatsapp_message, send_whatsapp_otp
from utils.email_utils import send_notification_email
from utils.push import send_push_to_all_customers
import random
import string
import base64
import asyncio
import httpx

router = APIRouter(prefix="/api")

# ============== MARKETING MODULE ==============

def generate_reference_number():
    """Generate random 7-digit reference number for anti-ban"""
    return str(random.randint(1000000, 9999999))

@router.get("/marketing/templates")
async def get_marketing_templates(current_user: dict = Depends(get_current_user)):
    """Get all marketing templates"""
    templates = await db.marketing_templates.find({}, {'_id': 0}).sort('created_at', -1).to_list(100)
    return templates

@router.post("/marketing/templates")
async def create_marketing_template(template: MarketingTemplateCreate, current_user: dict = Depends(get_current_user)):
    """Create a new marketing template"""
    template_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    template_doc = {
        'id': template_id,
        'name': template.name,
        'category': template.category,
        'message': template.message,
        'is_active': template.is_active,
        'created_at': now.isoformat(),
        'created_by': current_user['name']
    }
    
    await db.marketing_templates.insert_one(template_doc)
    # Return without _id
    del template_doc['_id']
    return template_doc

@router.put("/marketing/templates/{template_id}")
async def update_marketing_template(template_id: str, template: MarketingTemplateCreate, current_user: dict = Depends(get_current_user)):
    """Update a marketing template"""
    result = await db.marketing_templates.update_one(
        {'id': template_id},
        {'$set': {
            'name': template.name,
            'category': template.category,
            'message': template.message,
            'is_active': template.is_active,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template updated successfully"}

@router.delete("/marketing/templates/{template_id}")
async def delete_marketing_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a marketing template"""
    result = await db.marketing_templates.delete_one({'id': template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted successfully"}

@router.get("/marketing/recipients")
async def get_marketing_recipients(
    entity_type: str = "all",
    status: str = "all",
    current_user: dict = Depends(get_current_user)
):
    """Get potential recipients for marketing based on filters"""
    recipients = []
    
    # Build status filter
    status_filter = {}
    if status != "all":
        status_map = {
            "pipeline": "Pipeline",
            "customer": "Customer",
            "contacted": "Contacted",
            "not_interested": "Not Interested",
            "closed": "Closed"
        }
        if status in status_map:
            status_filter['lead_status'] = status_map[status]
    
    async def fetch_from_collection(collection_name, recipient_type):
        query = {**status_filter}
        docs = await db[collection_name].find(query, {'_id': 0}).to_list(1000)
        for doc in docs:
            if doc.get('phone'):
                recipients.append({
                    'id': doc.get('id'),
                    'name': doc.get('name'),
                    'phone': doc.get('phone'),
                    'email': doc.get('email'),
                    'type': recipient_type,
                    'lead_status': doc.get('lead_status', 'Pipeline'),
                    'customer_code': doc.get('customer_code', ''),
                    'state': doc.get('state', ''),
                    'district': doc.get('district', ''),
                    'city': doc.get('city', '')
                })
    
    if entity_type in ['all', 'doctors']:
        await fetch_from_collection('doctors', 'doctor')
    if entity_type in ['all', 'medicals']:
        await fetch_from_collection('medicals', 'medical')
    if entity_type in ['all', 'agencies']:
        await fetch_from_collection('agencies', 'agency')
    
    return recipients

@router.get("/marketing/campaigns")
async def get_marketing_campaigns(
    status: str = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all marketing campaigns"""
    query = {}
    if status:
        query['status'] = status
    
    # Exclude image_webp binary data from list
    campaigns = await db.marketing_campaigns.find(query, {'_id': 0, 'image_webp': 0, 'pdf_data': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    
    # Add image_url and pdf_url for campaigns with attachments
    for campaign in campaigns:
        if campaign.get('has_image'):
            campaign['image_url'] = f"/api/marketing/campaigns/{campaign['id']}/image"
        if campaign.get('has_pdf'):
            campaign['pdf_url'] = f"/api/marketing/campaigns/{campaign['id']}/attachment.pdf"
    
    total = await db.marketing_campaigns.count_documents(query)
    
    return {"campaigns": campaigns, "total": total}

@router.get("/marketing/campaigns/{campaign_id}")
async def get_marketing_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Get campaign details with logs"""
    campaign = await db.marketing_campaigns.find_one({'id': campaign_id}, {'_id': 0, 'image_webp': 0, 'pdf_data': 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Add image_url if campaign has image
    if campaign.get('has_image'):
        campaign['image_url'] = f"/api/marketing/campaigns/{campaign_id}/image"
    if campaign.get('has_pdf'):
        campaign['pdf_url'] = f"/api/marketing/campaigns/{campaign_id}/attachment.pdf"
    
    # Get campaign logs
    logs = await db.campaign_logs.find({'campaign_id': campaign_id}, {'_id': 0}).sort('sent_at', -1).to_list(1000)
    
    return {"campaign": campaign, "logs": logs}

@router.get("/marketing/campaigns/{campaign_id}/image")
async def get_campaign_image(campaign_id: str, fmt: Optional[str] = None):
    """Get campaign image. Use ?fmt=jpg for JPEG format (better compatibility with external services)"""
    campaign = await db.marketing_campaigns.find_one({'id': campaign_id}, {'image_webp': 1})
    if not campaign or not campaign.get('image_webp'):
        raise HTTPException(status_code=404, detail="Image not found")
    
    image_data = base64.b64decode(campaign['image_webp'])
    
    if fmt == 'jpg' or fmt == 'jpeg':
        img = Image.open(BytesIO(image_data))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        jpg_buffer = BytesIO()
        img.save(jpg_buffer, format='JPEG', quality=85)
        jpg_buffer.seek(0)
        return Response(content=jpg_buffer.read(), media_type="image/jpeg")
    
    return Response(content=image_data, media_type="image/webp")


@router.get("/marketing/campaigns/{campaign_id}/image.jpg")
async def get_campaign_image_jpg(campaign_id: str):
    """Get campaign image as JPEG with proper .jpg extension for WhatsApp compatibility"""
    return await get_campaign_image(campaign_id, fmt='jpg')


@router.get("/marketing/campaigns/{campaign_id}/attachment.pdf")
async def get_campaign_pdf(campaign_id: str):
    """Get campaign PDF attachment"""
    campaign = await db.marketing_campaigns.find_one({'id': campaign_id}, {'pdf_data': 1})
    if not campaign or not campaign.get('pdf_data'):
        raise HTTPException(status_code=404, detail="PDF not found")
    pdf_bytes = base64.b64decode(campaign['pdf_data'])
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename=campaign_{campaign_id}.pdf"})



@router.post("/marketing/campaigns")
async def create_marketing_campaign(campaign: MarketingCampaignCreate, current_user: dict = Depends(get_current_user)):
    """Create a new marketing campaign"""
    campaign_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Get company settings for message footer
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('company_name', 'VETMECH PHARMA') if company else 'VETMECH PHARMA'
    
    # Build message with item details if product promo
    final_message = campaign.message
    item_details = []
    
    if campaign.campaign_type == 'product_promo' and campaign.item_ids:
        # Fetch items without image_webp binary for storage, but check if they have images
        items = await db.items.find({'id': {'$in': campaign.item_ids}}, {'_id': 0, 'image_webp': 0}).to_list(len(campaign.item_ids))
        
        # Add has_image flag to each item
        for item in items:
            has_img = await db.items.find_one({'id': item['id'], 'image_webp': {'$ne': None}}, {'_id': 1})
            item['has_image'] = has_img is not None
        
        item_details = items
    
    # Handle image upload - store in MongoDB as webp
    processed_image = None
    if campaign.image_base64:
        try:
            image_data = campaign.image_base64.split(',')[1] if ',' in campaign.image_base64 else campaign.image_base64
            image_bytes = base64.b64decode(image_data)
            processed_image = process_image_to_webp(image_bytes, max_size_kb=200, target_size=(800, 800))
        except Exception as e:
            logger.error(f"Failed to process campaign image: {e}")

    # Handle PDF upload - store raw base64 in MongoDB
    pdf_data = None
    if campaign.pdf_base64:
        try:
            pdf_raw = campaign.pdf_base64.split(',')[1] if ',' in campaign.pdf_base64 else campaign.pdf_base64
            base64.b64decode(pdf_raw)  # validate
            pdf_data = pdf_raw
        except Exception as e:
            logger.error(f"Failed to process campaign PDF: {e}")
    
    # Determine initial status
    status = 'scheduled' if campaign.scheduled_at else 'draft'
    
    campaign_doc = {
        'id': campaign_id,
        'name': campaign.name,
        'campaign_type': campaign.campaign_type,
        'target_entity': campaign.target_entity,
        'target_status': campaign.target_status,
        'recipient_ids': campaign.recipient_ids,
        'total_recipients': len(campaign.recipient_ids),
        'sent_count': 0,
        'failed_count': 0,
        'pending_count': len(campaign.recipient_ids),
        'message': campaign.message,
        'message_preview': campaign.message[:100] + '...' if len(campaign.message) > 100 else campaign.message,
        'item_ids': campaign.item_ids or [],
        'item_details': item_details,
        'image_webp': processed_image,
        'has_image': processed_image is not None,
        'pdf_data': pdf_data,
        'has_pdf': pdf_data is not None,
        'batch_size': campaign.batch_size,
        'batch_delay_seconds': campaign.batch_delay_seconds,
        'status': status,
        'scheduled_at': campaign.scheduled_at,
        'started_at': None,
        'completed_at': None,
        'created_at': now.isoformat(),
        'created_by': current_user['name'],
        'company_name': company_name,
        'send_push': campaign.send_push or False
    }
    
    await db.marketing_campaigns.insert_one(campaign_doc)
    
    # Create pending logs for each recipient
    for recipient_id in campaign.recipient_ids:
        log_doc = {
            'id': str(uuid.uuid4()),
            'campaign_id': campaign_id,
            'recipient_id': recipient_id,
            'reference_number': generate_reference_number(),
            'status': 'pending',
            'error_message': None,
            'sent_at': None
        }
        await db.campaign_logs.insert_one(log_doc)
    
    # Return without _id
    del campaign_doc['_id']
    return campaign_doc

@router.post("/marketing/campaigns/{campaign_id}/send")
async def send_marketing_campaign(campaign_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Start sending a marketing campaign"""
    campaign = await db.marketing_campaigns.find_one({'id': campaign_id}, {'_id': 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign['status'] in ['sending', 'completed']:
        raise HTTPException(status_code=400, detail=f"Campaign is already {campaign['status']}")
    
    # Update status to sending
    await db.marketing_campaigns.update_one(
        {'id': campaign_id},
        {'$set': {
            'status': 'sending',
            'started_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Start background task to send messages
    background_tasks.add_task(process_marketing_campaign, campaign_id)
    
    return {"message": "Campaign sending started", "status": "sending"}

async def process_marketing_campaign(campaign_id: str):
    """Background task to process and send marketing messages in batches"""
    try:
        campaign = await db.marketing_campaigns.find_one({'id': campaign_id}, {'_id': 0})
        if not campaign:
            return
        
        config = await get_whatsapp_config()
        if not config.get('api_url') or not config.get('auth_token'):
            logger.error("WhatsApp not configured for marketing campaign")
            await db.marketing_campaigns.update_one(
                {'id': campaign_id},
                {'$set': {'status': 'failed', 'error': 'WhatsApp not configured'}}
            )
            return
        
        batch_size = campaign.get('batch_size', 10)
        batch_delay = campaign.get('batch_delay_seconds', 60)
        company_name = campaign.get('company_name', 'VETMECH PHARMA')
        
        # Get pending logs
        pending_logs = await db.campaign_logs.find({
            'campaign_id': campaign_id,
            'status': 'pending'
        }, {'_id': 0}).to_list(1000)
        
        # Process in batches
        for i in range(0, len(pending_logs), batch_size):
            batch = pending_logs[i:i + batch_size]
            
            for log in batch:
                try:
                    # Get recipient details
                    recipient = None
                    for collection in ['doctors', 'medicals', 'agencies']:
                        recipient = await db[collection].find_one({'id': log['recipient_id']}, {'_id': 0})
                        if recipient:
                            recipient['type'] = collection[:-1] if collection != 'agencies' else 'agency'
                            break
                    
                    if not recipient or not recipient.get('phone'):
                        await db.campaign_logs.update_one(
                            {'id': log['id']},
                            {'$set': {'status': 'failed', 'error_message': 'Recipient not found or no phone'}}
                        )
                        await db.marketing_campaigns.update_one(
                            {'id': campaign_id},
                            {'$inc': {'failed_count': 1, 'pending_count': -1}}
                        )
                        continue
                    
                    # Build personalized message
                    message = campaign['message']
                    
                    # Replace placeholders
                    message = message.replace('{name}', recipient.get('name', 'Customer'))
                    message = message.replace('{customer_code}', recipient.get('customer_code', ''))
                    
                    # Add item details for product promos
                    if campaign['campaign_type'] == 'product_promo' and campaign.get('item_details'):
                        items_text = "\n\n*Product Details:*\n"
                        for item in campaign['item_details']:
                            # Get role-specific pricing
                            recipient_type = recipient.get('type', 'doctor')
                            rate_field = f"rate_{recipient_type}s" if recipient_type != 'agency' else 'rate_agencies'
                            offer_field = f"offer_{recipient_type}s" if recipient_type != 'agency' else 'offer_agencies'
                            special_offer_field = f"special_offer_{recipient_type}s" if recipient_type != 'agency' else 'special_offer_agencies'
                            
                            # Use role-specific rate, fallback to default rate
                            rate = item.get(rate_field) or item.get('rate', 0)
                            offer = item.get(offer_field) or item.get('offer', '')
                            special_offer = item.get(special_offer_field) or item.get('special_offer', '')
                            mrp = item.get('mrp', 0)
                            item_name = item.get('name') or item.get('item_code', 'Product')
                            
                            items_text += f"\n*{item_name}*"
                            items_text += f"\nMRP: Rs.{mrp}"
                            items_text += f"\nYour Rate: Rs.{rate}"
                            if offer:
                                items_text += f"\nOffer: {offer}"
                            if special_offer:
                                items_text += f"\nSpecial: {special_offer}"
                            items_text += "\n"
                        
                        message += items_text
                    
                    # Add footer with reference number
                    ref_number = log['reference_number']
                    message += f"\n\nRegards,\n*{company_name}*\n(#Server Ref: {ref_number})"
                    
                    # Send WhatsApp message
                    phone = recipient['phone']
                    wa_mobile = phone if phone.startswith('91') else f"91{phone[-10:]}"
                    
                    # Determine file URL to use for attachment
                    file_url_to_send = None
                    app_base_url = os.environ.get('APP_BASE_URL', '').rstrip('/')
                    
                    # Check if campaign has PDF attachment
                    if campaign.get('has_pdf', False) and app_base_url:
                        file_url_to_send = f"{app_base_url}/api/marketing/campaigns/{campaign_id}/attachment.pdf"
                    # Check if campaign has uploaded image
                    elif campaign.get('has_image', False) and app_base_url:
                        file_url_to_send = f"{app_base_url}/api/marketing/campaigns/{campaign_id}/image.jpg"
                    # For product promotions, use first item's image as default
                    elif campaign['campaign_type'] == 'product_promo' and campaign.get('item_details') and app_base_url:
                        for item in campaign['item_details']:
                            if item.get('has_image'):
                                file_url_to_send = f"{app_base_url}/api/items/{item['id']}/image.jpg"
                                break
                    
                    # If both PDF and image exist, send image first then PDF separately
                    if campaign.get('has_pdf', False) and campaign.get('has_image', False) and app_base_url:
                        img_url = f"{app_base_url}/api/marketing/campaigns/{campaign_id}/image.jpg"
                        pdf_url = f"{app_base_url}/api/marketing/campaigns/{campaign_id}/attachment.pdf"
                        response = await send_wa_msg(wa_mobile, message, file_url=img_url, file_caption=message, config=config)
                        await asyncio.sleep(1)
                        await send_wa_msg(wa_mobile, '', file_url=pdf_url, file_caption='', config=config)
                    elif file_url_to_send:
                        response = await send_wa_msg(wa_mobile, message, file_url=file_url_to_send, file_caption=message, config=config)
                    else:
                        response = await send_wa_msg(wa_mobile, message, config=config)
                    
                    if response and response.status_code == 200:
                        # Verify the API actually succeeded by checking body
                        body = response.text.strip()
                        is_success = ('"success":true' in body or '"success": true' in body or '"status":"success"' in body or '"status": "success"' in body) and ('Page not found' not in body)
                        if is_success:
                            await db.campaign_logs.update_one(
                                {'id': log['id']},
                                {'$set': {
                                    'status': 'sent',
                                    'sent_at': datetime.now(timezone.utc).isoformat(),
                                    'recipient_name': recipient.get('name'),
                                    'recipient_phone': wa_mobile,
                                    'recipient_type': recipient.get('type')
                                }}
                            )
                            await db.marketing_campaigns.update_one(
                                {'id': campaign_id},
                                {'$inc': {'sent_count': 1, 'pending_count': -1}}
                            )
                            
                            # Log to WhatsApp logs
                            await log_whatsapp_message(
                                wa_mobile, 'marketing', message[:200], 'success',
                                recipient_name=recipient.get('name')
                            )
                        else:
                            error_msg = f"API returned 200 but body indicates failure: {body[:200]}"
                            logger.warning(f"Campaign {campaign_id} - message to {wa_mobile}: {error_msg}")
                            await db.campaign_logs.update_one(
                                {'id': log['id']},
                                {'$set': {
                                    'status': 'failed',
                                    'error_message': error_msg,
                                    'recipient_name': recipient.get('name'),
                                    'recipient_phone': wa_mobile,
                                    'recipient_type': recipient.get('type')
                                }}
                            )
                            await db.marketing_campaigns.update_one(
                                {'id': campaign_id},
                                {'$inc': {'failed_count': 1, 'pending_count': -1}}
                            )
                    else:
                        error_msg = f"Status {response.status_code if response else 'no_response'}"
                        await db.campaign_logs.update_one(
                            {'id': log['id']},
                            {'$set': {
                                'status': 'failed',
                                'error_message': error_msg,
                                'recipient_name': recipient.get('name'),
                                'recipient_phone': wa_mobile,
                                'recipient_type': recipient.get('type')
                            }}
                        )
                        await db.marketing_campaigns.update_one(
                            {'id': campaign_id},
                            {'$inc': {'failed_count': 1, 'pending_count': -1}}
                        )
                    
                    # Small delay between messages in same batch
                    await asyncio.sleep(2)
                    
                    # Also send email if recipient has email
                    if recipient.get('email'):
                        try:
                            email_msg = message.replace('*', '<strong>').replace('\n', '<br/>')
                            email_body = f'<div style="white-space:pre-line;line-height:1.6;">{email_msg}</div>'
                            await send_notification_email(recipient['email'], recipient.get('name', ''), f"{campaign.get('name', 'Announcement')}", email_body, recipient.get('id'), 'marketing_campaign')
                        except Exception as email_err:
                            logger.error(f"Campaign email error for {recipient.get('email')}: {email_err}")
                    
                except Exception as e:
                    logger.error(f"Error sending to recipient {log['recipient_id']}: {e}")
                    await db.campaign_logs.update_one(
                        {'id': log['id']},
                        {'$set': {'status': 'failed', 'error_message': str(e)}}
                    )
                    await db.marketing_campaigns.update_one(
                        {'id': campaign_id},
                        {'$inc': {'failed_count': 1, 'pending_count': -1}}
                    )
            
            # Delay between batches to avoid ban
            if i + batch_size < len(pending_logs):
                logger.info(f"Campaign {campaign_id}: Batch complete, waiting {batch_delay}s before next batch")
                await asyncio.sleep(batch_delay)
        
        # Mark campaign as completed
        await db.marketing_campaigns.update_one(
            {'id': campaign_id},
            {'$set': {
                'status': 'completed',
                'completed_at': datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"Marketing campaign {campaign_id} completed")
        
        # Send push notifications if enabled
        campaign_doc = await db.marketing_campaigns.find_one({'id': campaign_id}, {'_id': 0})
        if campaign_doc and campaign_doc.get('send_push'):
            try:
                push_title = campaign_doc.get('name', 'New Announcement')
                push_body = campaign_doc.get('message', '')[:150]
                push_sent = await send_push_to_all_customers(push_title, push_body, '/', 'campaign')
                logger.info(f"Push notifications sent for campaign {campaign_id}: {push_sent} devices")
            except Exception as pe:
                logger.error(f"Push notification error for campaign {campaign_id}: {pe}")
        
    except Exception as e:
        logger.error(f"Marketing campaign {campaign_id} failed: {e}")
        await db.marketing_campaigns.update_one(
            {'id': campaign_id},
            {'$set': {'status': 'failed', 'error': str(e)}}
        )

@router.post("/marketing/campaigns/{campaign_id}/cancel")
async def cancel_marketing_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a marketing campaign"""
    campaign = await db.marketing_campaigns.find_one({'id': campaign_id}, {'_id': 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign['status'] == 'completed':
        raise HTTPException(status_code=400, detail="Cannot cancel completed campaign")
    
    await db.marketing_campaigns.update_one(
        {'id': campaign_id},
        {'$set': {'status': 'cancelled'}}
    )
    
    return {"message": "Campaign cancelled"}

@router.get("/marketing/stats")
async def get_marketing_stats(current_user: dict = Depends(get_current_user)):
    """Get marketing statistics"""
    total_campaigns = await db.marketing_campaigns.count_documents({})
    completed_campaigns = await db.marketing_campaigns.count_documents({'status': 'completed'})
    
    # Get total messages sent this month
    start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    sent_this_month = await db.campaign_logs.count_documents({
        'status': 'sent',
        'sent_at': {'$gte': start_of_month.isoformat()}
    })
    
    return {
        'total_campaigns': total_campaigns,
        'completed_campaigns': completed_campaigns,
        'messages_sent_this_month': sent_this_month
    }


async def send_whatsapp_order(mobile: str, items: List[OrderItem], order_number: str, doctor_name: str = None, ip_address: str = None, location: str = None):
    """Send order confirmation via WhatsApp with full details"""
    config = await get_whatsapp_config()
    
    # Get company settings
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'
    company_phone = config.get('sender_id', '')
    
    clean_mobile = ''.join(filter(str.isdigit, mobile))
    if not clean_mobile.startswith('91'):
        clean_mobile = f"91{clean_mobile[-10:]}"
    
    # Build personalized order message
    greeting = f"Dear Dr. {doctor_name}" if doctor_name else "Dear Customer"
    
    # Build items list
    items_text = "\n".join([f"• {item.item_name} - Qty: {item.quantity}" for item in items if item.quantity])
    
    # Location info
    location_text = ""
    if ip_address:
        location_text += f"\n📍 IP: {ip_address}"
    if location:
        location_text += f"\n📍 Location: {location}"
    
    message = f"""{greeting},

We have received your order. Kindly check it once again, we will start processing your order.

📋 *Order No:* {order_number}

*Order Details:*
{items_text}
{location_text}

Thank you for your order!

Regards,
*{company_name}*
📞 +{company_phone}"""
    
    try:
        response = await send_wa_msg(clean_mobile, message, config=config)
        if response:
            logger.info(f"Order confirmation sent to {clean_mobile}")
            status = 'success' if response.status_code == 200 else 'failed'
            await log_whatsapp_message(clean_mobile, 'order_confirmation', message, status, recipient_name=doctor_name)
    except Exception as e:
        logger.error(f"WhatsApp order message error: {str(e)}")
        await log_whatsapp_message(clean_mobile, 'order_confirmation', message, 'failed', recipient_name=doctor_name, error_message=str(e))

async def send_order_confirmation_email(order_doc: dict, items: list):
    """Send order confirmation email to customer"""
    try:
        # Check if customer has email
        customer_email = order_doc.get('doctor_email')
        if not customer_email:
            logger.info(f"No email address for order {order_doc.get('order_number')}, skipping email")
            return
        
        # Get SMTP config
        smtp_config = await db.smtp_config.find_one({}, {'_id': 0})
        if not smtp_config:
            logger.warning("SMTP not configured, skipping order confirmation email")
            return
        
        # Get company settings
        company = await db.company_settings.find_one({}, {'_id': 0})
        company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'
        company_address = company.get('address', '') if company else ''
        company_phone = company.get('phone', '') if company else ''
        company_email = company.get('email', '') if company else ''
        
        customer_name = order_doc.get('doctor_name', 'Customer')
        customer_phone = order_doc.get('doctor_phone', '')
        customer_address = order_doc.get('doctor_address', '')
        order_number = order_doc.get('order_number', '')
        order_date = datetime.now(timezone.utc).strftime('%d %b %Y, %I:%M %p')
        
        # Build items table rows
        items_rows = ""
        total_amount = 0
        for idx, item in enumerate(items, 1):
            item_name = item.get('item_name', '') if isinstance(item, dict) else getattr(item, 'item_name', '')
            item_code = item.get('item_code', '') if isinstance(item, dict) else getattr(item, 'item_code', '')
            quantity = item.get('quantity', '1') if isinstance(item, dict) else getattr(item, 'quantity', '1')
            rate = item.get('rate', 0) if isinstance(item, dict) else getattr(item, 'rate', 0)
            mrp = item.get('mrp', 0) if isinstance(item, dict) else getattr(item, 'mrp', 0)
            
            # Calculate amount (handle scheme quantities like "10+5")
            try:
                if '+' in str(quantity):
                    qty_parts = str(quantity).split('+')
                    total_qty = sum(int(q.strip()) for q in qty_parts)
                else:
                    total_qty = int(quantity)
                amount = float(rate or 0) * total_qty
                total_amount += amount
            except:
                amount = 0
            
            items_rows += f"""
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">{idx}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">{item_code}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">{item_name}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">{quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">₹{rate:.2f}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">₹{amount:.2f}</td>
            </tr>"""
        
        # Build HTML email
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">{company_name}</h1>
            <p style="color: #b8d4e8; margin: 10px 0 0 0; font-size: 14px;">Order Confirmation</p>
        </div>
        
        <!-- Order Status Banner -->
        <div style="background-color: #10b981; padding: 15px; text-align: center;">
            <span style="color: #ffffff; font-size: 16px; font-weight: bold;">✓ Order Received Successfully!</span>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
            <!-- Greeting -->
            <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
                Dear <strong>{customer_name}</strong>,
            </p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
                Thank you for your order! We have received your order and will start processing it shortly.
            </p>
            
            <!-- Order Info Box -->
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0;">
                            <strong style="color: #64748b;">Order Number:</strong>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                            <strong style="color: #1e3a5f;">{order_number}</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;">
                            <strong style="color: #64748b;">Order Date:</strong>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                            <span style="color: #333;">{order_date}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;">
                            <strong style="color: #64748b;">Phone:</strong>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                            <span style="color: #333;">{customer_phone}</span>
                        </td>
                    </tr>
                    {f'''<tr>
                        <td style="padding: 8px 0;">
                            <strong style="color: #64748b;">Address:</strong>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                            <span style="color: #333;">{customer_address}</span>
                        </td>
                    </tr>''' if customer_address else ''}
                </table>
            </div>
            
            <!-- Items Table -->
            <h3 style="color: #1e3a5f; margin: 25px 0 15px 0; font-size: 16px;">Order Items</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background-color: #1e3a5f; color: #ffffff;">
                        <th style="padding: 12px; text-align: left;">#</th>
                        <th style="padding: 12px; text-align: left;">Code</th>
                        <th style="padding: 12px; text-align: left;">Item Name</th>
                        <th style="padding: 12px; text-align: center;">Qty</th>
                        <th style="padding: 12px; text-align: right;">Rate</th>
                        <th style="padding: 12px; text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {items_rows}
                </tbody>
                <tfoot>
                    <tr style="background-color: #f8fafc;">
                        <td colspan="5" style="padding: 15px; text-align: right; font-weight: bold; color: #1e3a5f;">
                            Total Amount:
                        </td>
                        <td style="padding: 15px; text-align: right; font-weight: bold; color: #10b981; font-size: 16px;">
                            ₹{total_amount:.2f}
                        </td>
                    </tr>
                </tfoot>
            </table>
            
            <!-- Note -->
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #92400e; font-size: 13px;">
                    <strong>Note:</strong> This is an order confirmation. The final invoice will be shared once your order is shipped.
                </p>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #1e3a5f; padding: 25px; text-align: center;">
            <p style="color: #ffffff; margin: 0 0 5px 0; font-weight: bold;">{company_name}</p>
            <p style="color: #b8d4e8; margin: 0; font-size: 12px;">{company_address}</p>
            {f'<p style="color: #b8d4e8; margin: 5px 0 0 0; font-size: 12px;">📞 {company_phone}</p>' if company_phone else ''}
            {f'<p style="color: #b8d4e8; margin: 5px 0 0 0; font-size: 12px;">✉️ {company_email}</p>' if company_email else ''}
        </div>
    </div>
</body>
</html>
"""
        
        # Create email message
        msg = MIMEMultipart()
        msg['From'] = f"{smtp_config['from_name']} <{smtp_config['from_email']}>"
        msg['To'] = f"{customer_name} <{customer_email}>"
        msg['Subject'] = f"Order Confirmation - {order_number} | {company_name}"
        msg.attach(MIMEText(html_body, 'html'))
        
        # Log entry for tracking
        log_id = str(uuid.uuid4())
        email_log = {
            'id': log_id,
            'doctor_id': order_doc.get('doctor_id'),
            'doctor_name': customer_name,
            'doctor_email': customer_email,
            'subject': f"Order Confirmation - {order_number}",
            'body': f"Order confirmation email for {order_number}",
            'status': 'pending',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'sent_by': 'system'
        }
        await db.email_logs.insert_one(email_log)
        
        # Send email
        try:
            with smtplib.SMTP(smtp_config['smtp_server'], smtp_config['smtp_port'], timeout=30) as server:
                server.starttls()
                server.login(smtp_config['smtp_username'], smtp_config['smtp_password'])
                server.sendmail(smtp_config['from_email'], [customer_email], msg.as_string())
            
            logger.info(f"Order confirmation email sent to {customer_email} for order {order_number}")
            
            # Update log as sent
            await db.email_logs.update_one(
                {'id': log_id},
                {'$set': {'status': 'sent', 'sent_at': datetime.now(timezone.utc).isoformat()}}
            )
        except Exception as smtp_error:
            logger.error(f"SMTP error sending order confirmation email: {str(smtp_error)}")
            await db.email_logs.update_one(
                {'id': log_id},
                {'$set': {'status': 'failed', 'error_message': str(smtp_error)}}
            )
        
    except Exception as e:
        logger.error(f"Failed to send order confirmation email: {str(e)}")

async def send_whatsapp_status_update(order: dict, new_status: str, update_data: dict = None):
    """Send WhatsApp notification for order status changes"""
    config = await get_whatsapp_config()
    if not config:
        logger.warning("WhatsApp config not found, skipping notification")
        return
    
    # Get company settings
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'
    company_phone = config.get('sender_id', '')
    
    mobile = order.get('doctor_phone', '')
    clean_mobile = ''.join(filter(str.isdigit, mobile))
    if not clean_mobile.startswith('91'):
        clean_mobile = f"91{clean_mobile[-10:]}"
    
    doctor_name = order.get('doctor_name')
    greeting = f"Dear Dr. {doctor_name}" if doctor_name else "Dear Customer"
    order_number = order.get('order_number', '')
    
    # Build items list
    items = order.get('items', [])
    items_text = "\n".join([f"• {item.get('item_name', '')} - Qty: {item.get('quantity', '')}" for item in items])
    
    message = ""
    
    if new_status == 'confirmed':
        message = f"""{greeting},

✅ Your order has been *CONFIRMED*!

📋 *Order No:* {order_number}

*Order Details:*
{items_text}

We are processing your order and will ship it soon.

Regards,
*{company_name}*
📞 +{company_phone}"""

    elif new_status == 'shipped':
        # Get tracking number from update_data (new) or order (existing)
        tracking_number = update_data.get('tracking_number') if update_data else None
        if not tracking_number:
            tracking_number = order.get('tracking_number', 'N/A')
        
        # Get transport info from order (set during ready_to_despatch) or update_data
        transport_name = order.get('transport_name') or (update_data.get('transport_name') if update_data else None) or 'N/A'
        delivery_station = order.get('delivery_station') or (update_data.get('delivery_station') if update_data else None) or 'N/A'
        payment_mode = order.get('payment_mode') or (update_data.get('payment_mode') if update_data else None) or ''
        payment_text = "To Pay" if payment_mode == 'to_pay' else "Paid" if payment_mode == 'paid' else 'N/A'
        
        # Get package details from order (set during ready_to_despatch)
        boxes = order.get('boxes_count', 0) or 0
        cans = order.get('cans_count', 0) or 0
        bags = order.get('bags_count', 0) or 0
        
        package_parts = []
        if boxes: package_parts.append(f"{boxes} Box(es)")
        if cans: package_parts.append(f"{cans} Can(s)")
        if bags: package_parts.append(f"{bags} Bag(s)")
        package_text = ", ".join(package_parts) if package_parts else "N/A"
        
        # Get invoice details from order (set during ready_to_despatch)
        invoice_number = order.get('invoice_number', 'N/A') or 'N/A'
        invoice_date = order.get('invoice_date', 'N/A') or 'N/A'
        invoice_value = order.get('invoice_value', 0) or 0
        invoice_value_text = f"₹{invoice_value:,.2f}" if invoice_value else 'N/A'
        
        message = f"""{greeting},

🚚 Your order has been *SHIPPED*!

📋 *Order No:* {order_number}

*Order Details:*
{items_text}

*Shipping Information:*
🚛 Transport: {transport_name}
📦 Tracking No: {tracking_number}
📍 Delivery Station: {delivery_station}
💰 Payment: {payment_text}

*Package Details:*
📦 {package_text}

*Invoice Details:*
🧾 Invoice No: {invoice_number}
📅 Invoice Date: {invoice_date}
💵 Invoice Value: {invoice_value_text}

Your order is on its way! Thank you for your order.

Regards,
*{company_name}*
📞 +{company_phone}"""

    elif new_status == 'delivered':
        message = f"""{greeting},

🎉 Your order has been *DELIVERED*!

📋 *Order No:* {order_number}

*Order Details:*
{items_text}

Thank you for choosing us! We hope you are satisfied with your order.

For any queries, please contact us.

Regards,
*{company_name}*
📞 +{company_phone}"""

    elif new_status == 'cancelled':
        cancellation_reason = update_data.get('cancellation_reason', 'Not specified') if update_data else 'Not specified'
        
        message = f"""{greeting},

❌ Your order has been *CANCELLED*

📋 *Order No:* {order_number}

*Order Details:*
{items_text}

*Reason for Cancellation:*
{cancellation_reason}

If you have any questions, please contact us.

Regards,
*{company_name}*
📞 +{company_phone}"""
    
    if not message:
        return
    
    try:
        response = await send_wa_msg(clean_mobile, message, config=config)
        if response:
            logger.info(f"Order status update ({new_status}) sent to {clean_mobile}")
            status = 'success' if response.status_code == 200 else 'failed'
            await log_whatsapp_message(clean_mobile, f'status_{new_status}', message, status, recipient_name=doctor_name)
    except Exception as e:
        logger.error(f"WhatsApp status update error: {str(e)}")
        await log_whatsapp_message(clean_mobile, f'status_{new_status}', message, 'failed', recipient_name=doctor_name, error_message=str(e))

async def send_order_status_email(order: dict, new_status: str, update_data: dict = None):
    """Send email notification for order status changes"""
    try:
        customer_email = order.get('doctor_email')
        if not customer_email:
            return
        customer_name = order.get('doctor_name', 'Customer')
        order_number = order.get('order_number', '')
        items = order.get('items', [])
        items_html = "".join([f"<li>{item.get('item_name', '')} - Qty: {item.get('quantity', '')}</li>" for item in items])

        status_config = {
            'confirmed': ('Order Confirmed', '#10b981', 'Your order has been confirmed and is being processed.'),
            'shipped': ('Order Shipped', '#3b82f6', 'Your order has been shipped and is on its way!'),
            'ready_to_despatch': ('Ready to Dispatch', '#f59e0b', 'Your order is packed and ready for dispatch.'),
            'delivered': ('Order Delivered', '#10b981', 'Your order has been delivered. Thank you!'),
            'cancelled': ('Order Cancelled', '#ef4444', f"Your order has been cancelled. Reason: {(update_data or {}).get('cancellation_reason', 'Not specified')}"),
        }
        title, color, desc = status_config.get(new_status, (f'Order {new_status.title()}', '#6b7280', f'Your order status has been updated to: {new_status}'))

        tracking_html = ""
        if new_status == 'shipped':
            tracking = order.get('tracking_number') or (update_data or {}).get('tracking_number', '')
            transport = order.get('transport_name') or (update_data or {}).get('transport_name', '')
            if tracking or transport:
                tracking_html = f'<p style="margin:10px 0;"><strong>Transport:</strong> {transport}<br/><strong>Tracking:</strong> {tracking}</p>'

        body = f"""<div style="background-color:{color};padding:12px;text-align:center;border-radius:6px;margin-bottom:16px;">
<span style="color:#fff;font-weight:bold;font-size:16px;">{title}</span></div>
<p>Dear <strong>{customer_name}</strong>,</p>
<p>{desc}</p>
<div style="background:#f8fafc;padding:16px;border-radius:6px;margin:16px 0;">
<strong>Order No:</strong> {order_number}<br/>
<strong>Items:</strong><ul>{items_html}</ul>{tracking_html}</div>"""

        await send_notification_email(customer_email, customer_name, f"{title} - {order_number}", body, order.get('doctor_id'), f'order_{new_status}')
    except Exception as e:
        logger.error(f"Order status email error: {e}")

async def send_whatsapp_ready_to_despatch(order: dict, update_data: dict):
    """Send WhatsApp notification for Ready to Despatch status - to both transporter and customer"""
    config = await get_whatsapp_config()
    if not config:
        logger.warning("WhatsApp config not found, skipping notification")
        return
    
    # Get company settings
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'
    company_phone = config.get('sender_id', '')
    
    order_number = order.get('order_number', '')
    doctor_name = order.get('doctor_name', 'Customer')
    doctor_phone = order.get('doctor_phone', '')
    doctor_address = order.get('doctor_address', 'N/A')
    
    # Get transport details
    transport_name = update_data.get('transport_name', 'N/A')
    delivery_station = update_data.get('delivery_station', 'N/A')
    payment_mode = update_data.get('payment_mode', '')
    payment_text = "To Pay" if payment_mode == 'to_pay' else "Paid" if payment_mode == 'paid' else 'N/A'
    
    # Package details
    boxes = update_data.get('boxes_count', 0) or 0
    cans = update_data.get('cans_count', 0) or 0
    bags = update_data.get('bags_count', 0) or 0
    
    package_parts = []
    if boxes: package_parts.append(f"{boxes} Box(es)")
    if cans: package_parts.append(f"{cans} Can(s)")
    if bags: package_parts.append(f"{bags} Bag(s)")
    package_text = ", ".join(package_parts) if package_parts else "N/A"
    
    # Invoice details
    invoice_number = update_data.get('invoice_number', 'N/A') or 'N/A'
    invoice_date = update_data.get('invoice_date', 'N/A') or 'N/A'
    invoice_value = update_data.get('invoice_value', 0) or 0
    invoice_value_text = f"₹{invoice_value:,.2f}" if invoice_value else 'N/A'
    
    # Build items list
    items = order.get('items', [])
    items_text = "\n".join([f"• {item.get('item_name', '')} - Qty: {item.get('quantity', '')}" for item in items])
    
    # 1. Send message to TRANSPORTER
    transport_id = update_data.get('transport_id')
    if transport_id:
        transport = await db.transports.find_one({'id': transport_id}, {'_id': 0})
        if transport and transport.get('contact_number'):
            transporter_mobile = transport.get('contact_number', '')
            clean_transporter_mobile = ''.join(filter(str.isdigit, transporter_mobile))
            if not clean_transporter_mobile.startswith('91'):
                clean_transporter_mobile = f"91{clean_transporter_mobile[-10:]}"
            
            transporter_message = f"""📦 *NEW SHIPMENT READY*

*Delivery Details:*
👤 {doctor_name}
📍 {delivery_station}

*Invoice Details:*
🧾 {invoice_number}
📅 {invoice_date}
💵 {invoice_value_text}

*Package Details:*
📦 {package_text}

*Payment:* {payment_text}"""
            
            try:
                response = await send_wa_msg(clean_transporter_mobile, transporter_message, config=config)
                if response:
                    logger.info(f"Ready to despatch notification sent to transporter {clean_transporter_mobile}")
                    status = 'success' if response.status_code == 200 else 'failed'
                    await log_whatsapp_message(clean_transporter_mobile, 'ready_to_despatch_transporter', transporter_message, status, recipient_name=transport_name)
            except Exception as e:
                logger.error(f"WhatsApp transporter notification error: {str(e)}")
                await log_whatsapp_message(clean_transporter_mobile, 'ready_to_despatch_transporter', transporter_message, 'failed', recipient_name=transport_name, error_message=str(e))

async def send_whatsapp_out_of_stock(order: dict, out_of_stock_items: list):
    """Send WhatsApp notification for out of stock items"""
    if not out_of_stock_items:
        return
    
    config = await get_whatsapp_config()
    if not config:
        logger.warning("WhatsApp config not found, skipping out of stock notification")
        return
    
    # Get company settings
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'
    company_phone = config.get('sender_id', '')
    
    mobile = order.get('doctor_phone', '')
    clean_mobile = ''.join(filter(str.isdigit, mobile))
    if not clean_mobile.startswith('91'):
        clean_mobile = f"91{clean_mobile[-10:]}"
    
    doctor_name = order.get('doctor_name')
    greeting = f"Dear Dr. {doctor_name}" if doctor_name else "Dear Customer"
    order_number = order.get('order_number', '')
    
    # Build out of stock items list
    items_text = "\n".join([f"• {item.get('item_name', '')} - Qty: {item.get('quantity', '')}" for item in out_of_stock_items])
    
    message = f"""{greeting},

⚠️ *STOCK UPDATE* for Order *{order_number}*

We regret to inform you that the following item(s) are currently *OUT OF STOCK*:

{items_text}

We have noted your requirement and will update you as soon as these items are available.

We sincerely apologize for the inconvenience and thank you for your patience and cooperation. 🙏

Your remaining order items are being processed.

For any queries, please contact us.

Regards,
*{company_name}*
📞 +{company_phone}"""
    
    try:
        response = await send_wa_msg(clean_mobile, message, config=config)
        if response:
            logger.info(f"Out of stock notification sent to {clean_mobile} for order {order_number}")
            status = 'success' if response.status_code == 200 else 'failed'
            await log_whatsapp_message(clean_mobile, 'out_of_stock', message, status, recipient_name=doctor_name)
    except Exception as e:
        logger.error(f"WhatsApp out of stock notification error: {str(e)}")
        await log_whatsapp_message(clean_mobile, 'out_of_stock', message, 'failed', recipient_name=doctor_name, error_message=str(e))

async def send_whatsapp_stock_arrived(doctor_phone: str, doctor_name: str, item_name: str, item_code: str, quantity: str):
    """Send WhatsApp notification when stock arrives for a pending item"""
    config = await get_whatsapp_config()
    if not config:
        logger.warning("WhatsApp config not found, skipping stock arrived notification")
        return False
    
    # Get company settings
    company = await db.company_settings.find_one({}, {'_id': 0})
    company_name = company.get('company_name', 'VMP CRM') if company else 'VMP CRM'
    company_phone = config.get('sender_id', '')
    
    clean_mobile = ''.join(filter(str.isdigit, doctor_phone))
    if not clean_mobile.startswith('91'):
        clean_mobile = f"91{clean_mobile[-10:]}"
    
    greeting = f"Dear Dr. {doctor_name}" if doctor_name else "Dear Customer"
    
    message = f"""{greeting},

🎉 *GOOD NEWS - STOCK ARRIVED!*

We are pleased to inform you that the following item you requested is now *BACK IN STOCK*:

📦 *{item_name}* ({item_code})
   Quantity requested: {quantity}

You can now place your order or contact us to complete your previous pending order.

Thank you for your patience! 🙏

Regards,
*{company_name}*
📞 +{company_phone}"""
    
    try:
        response = await send_wa_msg(clean_mobile, message, config=config)
        if response:
            logger.info(f"Stock arrived notification sent to {clean_mobile} for item {item_code}")
            status = 'success' if response.status_code == 200 else 'failed'
            await log_whatsapp_message(clean_mobile, 'stock_arrived', message, status, recipient_name=doctor_name)
            return response.status_code == 200
        return False
    except Exception as e:
        logger.error(f"WhatsApp stock arrived notification error: {str(e)}")
        await log_whatsapp_message(clean_mobile, 'stock_arrived', message, 'failed', recipient_name=doctor_name, error_message=str(e))
        return False

@router.post("/public/send-otp")
async def send_otp(request: OTPRequest):
    """Send OTP to mobile number via WhatsApp"""
    clean_mobile = ''.join(filter(str.isdigit, request.mobile))
    if len(clean_mobile) < 10:
        raise HTTPException(status_code=400, detail="Invalid mobile number")
    
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    
    # Store OTP with expiry (5 minutes)
    otp_doc = {
        'mobile': clean_mobile[-10:],
        'otp': otp,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'expires_at': (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        'verified': False
    }
    
    # Delete old OTPs for this mobile
    await db.otps.delete_many({'mobile': clean_mobile[-10:]})
    await db.otps.insert_one(otp_doc)
    
    # Send OTP via WhatsApp
    sent = await send_whatsapp_otp(request.mobile, otp)
    
    # For development/testing, also log the OTP
    logger.info(f"OTP for {clean_mobile}: {otp}")
    
    return {"message": "OTP sent successfully", "sent": sent}

@router.post("/public/verify-otp", response_model=OrderResponse)
async def verify_otp_and_submit_order(request: OTPVerify):
    """Verify OTP and submit order"""
    clean_mobile = ''.join(filter(str.isdigit, request.mobile))[-10:]
    
    # Find OTP
    otp_doc = await db.otps.find_one({
        'mobile': clean_mobile,
        'otp': request.otp,
        'verified': False
    }, {'_id': 0})
    
    if not otp_doc:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Check expiry
    expires_at = datetime.fromisoformat(otp_doc['expires_at'].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP expired")
    
    # Mark OTP as verified
    await db.otps.update_one({'mobile': clean_mobile}, {'$set': {'verified': True}})
    
    # Get doctor details if exists
    doctor = await db.doctors.find_one(
        {'$or': [
            {'phone': {'$regex': clean_mobile, '$options': 'i'}},
            {'phone': f"+91{clean_mobile}"},
            {'phone': f"91{clean_mobile}"}
        ]},
        {'_id': 0}
    )
    
    # Generate order number
    order_count = await db.orders.count_documents({})
    order_number = f"ORD-{str(order_count + 1).zfill(6)}"
    
    order_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Filter items with quantity
    valid_items = [item for item in request.items if item.quantity and item.quantity.strip()]
    
    order_doc = {
        'id': order_id,
        'order_number': order_number,
        'doctor_id': doctor['id'] if doctor else None,
        'doctor_name': doctor['name'] if doctor else None,
        'doctor_phone': request.mobile,
        'doctor_email': doctor['email'] if doctor else None,
        'doctor_address': doctor['address'] if doctor else None,
        'doctor_customer_code': doctor['customer_code'] if doctor else None,
        'items': [item.model_dump() for item in valid_items],
        'status': 'pending',
        'ip_address': request.ip_address,
        'location': request.location,
        'device_info': request.device_info,
        'created_at': now.isoformat()
    }
    
    await db.orders.insert_one(order_doc)
    
    # Send order confirmation via WhatsApp with full details
    await send_whatsapp_order(
        mobile=request.mobile, 
        items=valid_items, 
        order_number=order_number,
        doctor_name=doctor['name'] if doctor else None,
        ip_address=request.ip_address,
        location=request.location
    )
    
    # Send Email confirmation to customer (if email available)
    await send_order_confirmation_email(
        order_doc,
        [item.model_dump() for item in valid_items]
    )
    
    return OrderResponse(
        id=order_id,
        order_number=order_number,
        doctor_id=doctor['id'] if doctor else None,
        doctor_name=doctor['name'] if doctor else None,
        doctor_phone=request.mobile,
        doctor_email=doctor['email'] if doctor else None,
        doctor_address=doctor['address'] if doctor else None,
        items=valid_items,
        status='pending',
        ip_address=request.ip_address,
        location=request.location,
        device_info=request.device_info,
        created_at=now
    )


