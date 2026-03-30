"""Code generation utilities for customer/medical/agency/item codes."""
from deps import db


async def generate_customer_code() -> str:
    last_doctor = await db.doctors.find_one({}, {'customer_code': 1}, sort=[('customer_code', -1)])
    if last_doctor and 'customer_code' in last_doctor:
        last_num = int(last_doctor['customer_code'].replace('VMP-', ''))
        new_num = last_num + 1
    else:
        new_num = 1
    return f"VMP-{str(new_num).zfill(4)}"


async def generate_medical_code() -> str:
    last_medical = await db.medicals.find_one(
        {'customer_code': {'$regex': '^MED-'}}, {'customer_code': 1}, sort=[('customer_code', -1)])
    if last_medical and 'customer_code' in last_medical:
        try:
            last_num = int(last_medical['customer_code'].replace('MED-', ''))
            new_num = last_num + 1
        except ValueError:
            new_num = 1
    else:
        new_num = 1
    return f"MED-{str(new_num).zfill(4)}"


async def generate_agency_code() -> str:
    last_agency = await db.agencies.find_one(
        {'customer_code': {'$regex': '^AGY-'}}, {'customer_code': 1}, sort=[('customer_code', -1)])
    if last_agency and 'customer_code' in last_agency:
        try:
            last_num = int(last_agency['customer_code'].replace('AGY-', ''))
            new_num = last_num + 1
        except ValueError:
            new_num = 1
    else:
        new_num = 1
    return f"AGY-{str(new_num).zfill(4)}"


async def generate_item_code() -> str:
    last_item = await db.items.find_one({}, {'item_code': 1}, sort=[('item_code', -1)])
    if last_item and 'item_code' in last_item:
        code = last_item['item_code']
        if code.startswith('ITM-'):
            try:
                last_num = int(code.replace('ITM-', ''))
                new_num = last_num + 1
                return f"ITM-{str(new_num).zfill(4)}"
            except ValueError:
                pass
    return "ITM-0001"


async def generate_portal_customer_code(role: str) -> str:
    """Generate unique customer code for portal customers based on role."""
    prefix = "CUS"
    if role == "doctor":
        prefix = "DOC"
    elif role == "medical":
        prefix = "MED"
    elif role == "agency":
        prefix = "AGY"
    count = await db.portal_customers.count_documents({'role': role})
    return f"{prefix}-{str(count + 1).zfill(4)}"


async def generate_ticket_number() -> str:
    """Generate unique ticket number."""
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime('%Y%m%d')
    count = await db.support_tickets.count_documents({
        'created_at': {'$regex': f'^{today[:4]}-{today[4:6]}-{today[6:8]}'}
    })
    return f"TKT-{today}-{str(count + 1).zfill(4)}"
