"""Push notification utilities."""
import json
from datetime import datetime, timezone
from pywebpush import webpush, WebPushException
from deps import db, logger, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT


async def send_push_notification(subscription_info: dict, title: str, body: str, url: str = '/', icon: str = '/icons/icon-192x192.png', tag: str = None):
    """Send a push notification to a single subscription."""
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        logger.warning("VAPID keys not configured, skipping push notification")
        return False
    
    payload = json.dumps({
        'title': title,
        'body': body,
        'url': url,
        'icon': icon,
        'tag': tag or 'notification',
        'timestamp': datetime.now(timezone.utc).isoformat()
    })
    
    try:
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT}
        )
        return True
    except WebPushException as e:
        logger.error(f"Push notification failed: {e}")
        if e.response and e.response.status_code in (404, 410):
            await db.push_subscriptions.delete_one({'endpoint': subscription_info.get('endpoint')})
            logger.info(f"Removed invalid push subscription: {subscription_info.get('endpoint', '')[:50]}")
        return False
    except Exception as e:
        logger.error(f"Push notification error: {e}")
        return False


async def send_push_to_user(user_id: str, user_type: str, title: str, body: str, url: str = '/', tag: str = None):
    """Send push notification to all subscriptions of a user."""
    subs = await db.push_subscriptions.find({'user_id': user_id, 'user_type': user_type}, {'_id': 0}).to_list(10)
    sent = 0
    for sub in subs:
        sub_info = sub.get('subscription')
        if sub_info:
            ok = await send_push_notification(sub_info, title, body, url, tag=tag)
            if ok:
                sent += 1
    return sent


async def send_push_to_role(role: str, title: str, body: str, url: str = '/', tag: str = None):
    """Send push notification to all users of a role."""
    subs = await db.push_subscriptions.find({'user_type': role}, {'_id': 0}).to_list(500)
    sent = 0
    for sub in subs:
        sub_info = sub.get('subscription')
        if sub_info:
            ok = await send_push_notification(sub_info, title, body, url, tag=tag)
            if ok:
                sent += 1
    return sent


async def send_push_to_all_customers(title: str, body: str, url: str = '/', tag: str = None):
    return await send_push_to_role('customer', title, body, url, tag)


async def send_push_to_admins(title: str, body: str, url: str = '/admin', tag: str = None):
    return await send_push_to_role('admin', title, body, url, tag)
