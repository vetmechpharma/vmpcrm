import bcrypt
from pymongo import MongoClient
import uuid, datetime

client = MongoClient('mongodb://localhost:27017')
db = client['CRM_VETMECH']

db.users.delete_many({'email': 'info@vetmech.in'})

password = 'Kongu@@44884'
hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

db.users.insert_one({
    'id': str(uuid.uuid4()),
    'email': 'info@vetmech.in',
    'password': hashed,
    'name': 'Admin VETMECH',
    'role': 'admin',
    'created_at': datetime.datetime.utcnow().isoformat(),
    'updated_at': datetime.datetime.utcnow().isoformat()
})

user = db.users.find_one({'email': 'info@vetmech.in'})
if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
    print('SUCCESS - Admin created and verified!')
    print('Email: info@vetmech.in')
    print('Password: Kongu@@44884')
else:
    print('FAILED - something went wrong')
