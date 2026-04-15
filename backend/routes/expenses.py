from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import json
import os

from deps import db, logger, get_current_user, hash_password, verify_password, create_token, security
from models.schemas import ExpenseCreate, ExpenseUpdate, ExpenseResponse, ExpenseCategoryCreate, ExpenseCategoryResponse

router = APIRouter(prefix="/api")

# ============== EXPENSE ROUTES ==============

# Default expense categories
DEFAULT_EXPENSE_CATEGORIES = [
    {"name": "Transport/Shipping", "description": "Shipping and transport costs"},
    {"name": "Office Supplies", "description": "Office materials and supplies"},
    {"name": "Salaries", "description": "Employee salaries and wages"},
    {"name": "Utilities", "description": "Electricity, water, internet bills"},
    {"name": "Marketing", "description": "Advertising and marketing expenses"},
    {"name": "Miscellaneous", "description": "Other miscellaneous expenses"},
]

async def ensure_default_categories():
    """Create default expense categories if they don't exist"""
    existing = await db.expense_categories.count_documents({})
    if existing == 0:
        now = datetime.now(timezone.utc)
        for cat in DEFAULT_EXPENSE_CATEGORIES:
            await db.expense_categories.insert_one({
                'id': str(uuid.uuid4()),
                'name': cat['name'],
                'description': cat['description'],
                'is_default': True,
                'created_at': now.isoformat()
            })

@router.get("/expense-categories", response_model=List[ExpenseCategoryResponse])
async def get_expense_categories(current_user: dict = Depends(get_current_user)):
    """Get all expense categories"""
    await ensure_default_categories()
    categories = await db.expense_categories.find({}, {'_id': 0}).sort('name', 1).to_list(100)
    
    result = []
    for cat in categories:
        created_at = cat.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        result.append(ExpenseCategoryResponse(
            id=cat['id'],
            name=cat['name'],
            description=cat.get('description'),
            is_default=cat.get('is_default', False),
            created_at=created_at
        ))
    
    return result

@router.post("/expense-categories", response_model=ExpenseCategoryResponse)
async def create_expense_category(category: ExpenseCategoryCreate, current_user: dict = Depends(get_current_user)):
    """Create a new expense category"""
    cat_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    cat_doc = {
        'id': cat_id,
        'name': category.name,
        'description': category.description,
        'is_default': False,
        'created_at': now.isoformat()
    }
    
    await db.expense_categories.insert_one(cat_doc)
    
    return ExpenseCategoryResponse(
        id=cat_id,
        name=category.name,
        description=category.description,
        is_default=False,
        created_at=now
    )

@router.delete("/expense-categories/{category_id}")
async def delete_expense_category(category_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an expense category (only non-default)"""
    category = await db.expense_categories.find_one({'id': category_id}, {'_id': 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    if category.get('is_default', False):
        raise HTTPException(status_code=400, detail="Cannot delete default categories")
    
    expense_count = await db.expenses.count_documents({'category_id': category_id})
    if expense_count > 0:
        raise HTTPException(status_code=400, detail=f"Category is used by {expense_count} expenses")
    
    await db.expense_categories.delete_one({'id': category_id})
    return {"message": "Category deleted successfully"}

@router.post("/expenses", response_model=ExpenseResponse)
async def create_expense(expense: ExpenseCreate, current_user: dict = Depends(get_current_user)):
    """Create a new expense"""
    category = await db.expense_categories.find_one({'id': expense.category_id}, {'_id': 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    expense_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    expense_doc = {
        'id': expense_id,
        'category_id': expense.category_id,
        'category_name': category['name'],
        'date': expense.date,
        'amount': expense.amount,
        'payment_type': expense.payment_type,
        'payment_account': expense.payment_account,
        'paid_by': expense.paid_by,
        'reason': expense.reason,
        'transport_id': expense.transport_id,
        'transport_name': expense.transport_name,
        'transport_location': expense.transport_location,
        'order_id': expense.order_id,
        'order_number': expense.order_number,
        'is_auto_generated': False,
        'created_at': now.isoformat(),
        'updated_at': now.isoformat(),
        'created_by': current_user['id']
    }
    
    await db.expenses.insert_one(expense_doc)
    
    return ExpenseResponse(
        id=expense_id,
        category_id=expense.category_id,
        category_name=category['name'],
        date=expense.date,
        amount=expense.amount,
        payment_type=expense.payment_type,
        payment_account=expense.payment_account,
        paid_by=expense.paid_by,
        reason=expense.reason,
        transport_id=expense.transport_id,
        transport_name=expense.transport_name,
        transport_location=expense.transport_location,
        order_id=expense.order_id,
        order_number=expense.order_number,
        is_auto_generated=False,
        created_at=now,
        updated_at=now
    )

@router.get("/expenses", response_model=List[ExpenseResponse])
async def get_expenses(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[str] = None,
    payment_type: Optional[str] = None,
    payment_account: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all expenses with optional filters"""
    query = {}
    
    if start_date and end_date:
        query['date'] = {'$gte': start_date, '$lte': end_date}
    elif start_date:
        query['date'] = {'$gte': start_date}
    elif end_date:
        query['date'] = {'$lte': end_date}
    
    if category_id:
        query['category_id'] = category_id
    if payment_type:
        query['payment_type'] = payment_type
    if payment_account:
        # Normalize: admin_user and admin_account are the same
        if payment_account in ('admin_user', 'admin_account'):
            query['payment_account'] = {'$in': ['admin_user', 'admin_account']}
        else:
            query['payment_account'] = payment_account
    
    expenses = await db.expenses.find(query, {'_id': 0}).sort('date', -1).to_list(1000)
    
    result = []
    for exp in expenses:
        created_at = exp.get('created_at')
        updated_at = exp.get('updated_at') or exp.get('created_at')
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        
        result.append(ExpenseResponse(
            id=exp['id'],
            category_id=exp['category_id'],
            category_name=exp.get('category_name'),
            date=exp['date'],
            amount=exp['amount'],
            payment_type=exp['payment_type'],
            payment_account=exp['payment_account'],
            paid_by=exp.get('paid_by'),
            reason=exp['reason'],
            transport_id=exp.get('transport_id'),
            transport_name=exp.get('transport_name'),
            transport_location=exp.get('transport_location'),
            order_id=exp.get('order_id'),
            order_number=exp.get('order_number'),
            is_auto_generated=exp.get('is_auto_generated', False),
            created_at=created_at,
            updated_at=updated_at
        ))
    
    return result

@router.put("/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(expense_id: str, expense_data: ExpenseUpdate, current_user: dict = Depends(get_current_user)):
    """Update an expense"""
    expense = await db.expenses.find_one({'id': expense_id}, {'_id': 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    update_data = {k: v for k, v in expense_data.model_dump().items() if v is not None}
    
    if 'category_id' in update_data:
        category = await db.expense_categories.find_one({'id': update_data['category_id']}, {'_id': 0})
        if category:
            update_data['category_name'] = category['name']
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.expenses.update_one({'id': expense_id}, {'$set': update_data})
    
    updated = await db.expenses.find_one({'id': expense_id}, {'_id': 0})
    created_at = updated.get('created_at')
    updated_at = updated.get('updated_at')
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
    
    return ExpenseResponse(
        id=updated['id'],
        category_id=updated['category_id'],
        category_name=updated.get('category_name'),
        date=updated['date'],
        amount=updated['amount'],
        payment_type=updated['payment_type'],
        payment_account=updated['payment_account'],
        paid_by=updated.get('paid_by'),
        reason=updated['reason'],
        transport_id=updated.get('transport_id'),
        transport_name=updated.get('transport_name'),
        transport_location=updated.get('transport_location'),
        order_id=updated.get('order_id'),
        order_number=updated.get('order_number'),
        is_auto_generated=updated.get('is_auto_generated', False),
        created_at=created_at,
        updated_at=updated_at
    )

@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an expense"""
    result = await db.expenses.delete_one({'id': expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted successfully"}

@router.get("/expenses/stats/monthly")
async def get_monthly_expense_stats(current_user: dict = Depends(get_current_user)):
    """Get monthly expense statistics"""
    import calendar
    now = datetime.now(timezone.utc)
    current_month_start = now.replace(day=1).strftime('%Y-%m-%d')
    current_month_end = now.strftime('%Y-%m-%d')
    
    if now.month == 1:
        prev_month_start = now.replace(year=now.year-1, month=12, day=1).strftime('%Y-%m-%d')
        prev_month_end = now.replace(year=now.year-1, month=12, day=31).strftime('%Y-%m-%d')
    else:
        prev_month_start = now.replace(month=now.month-1, day=1).strftime('%Y-%m-%d')
        last_day = calendar.monthrange(now.year, now.month-1)[1]
        prev_month_end = now.replace(month=now.month-1, day=last_day).strftime('%Y-%m-%d')
    
    current_expenses = await db.expenses.find({
        'date': {'$gte': current_month_start, '$lte': current_month_end}
    }, {'_id': 0}).to_list(1000)
    current_total = sum(exp['amount'] for exp in current_expenses)
    
    prev_expenses = await db.expenses.find({
        'date': {'$gte': prev_month_start, '$lte': prev_month_end}
    }, {'_id': 0, 'amount': 1}).to_list(1000)
    prev_total = sum(exp['amount'] for exp in prev_expenses)
    
    by_category = {}
    by_payment_type = {}
    for exp in current_expenses:
        cat_name = exp.get('category_name', 'Uncategorized')
        by_category[cat_name] = by_category.get(cat_name, 0) + exp['amount']
        pt = exp.get('payment_type', 'other')
        by_payment_type[pt] = by_payment_type.get(pt, 0) + exp['amount']
    
    return {
        'current_month_total': current_total,
        'previous_month_total': prev_total,
        'change_percent': round(((current_total - prev_total) / prev_total * 100) if prev_total > 0 else 0, 1),
        'by_category': by_category,
        'by_payment_type': by_payment_type,
        'expense_count': len(current_expenses)
    }


