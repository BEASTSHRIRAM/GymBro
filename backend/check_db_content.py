import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    
    # 0. List all DBs
    dbs = await client.list_database_names()
    print(f"Databases on server: {dbs}")
    
    db = client['gymbro']
    # 1. List collections in gymbro
    collections = await db.list_collection_names()
    print(f"Collections in 'gymbro': {collections}")
    
    # ... rest remains ...
    user_id = "69a87139035c6825c6c862a4"
    doc = await db['gymbro_context'].find_one({'user_id': user_id})
    print(f"Doc for {user_id}: {'Found' if doc else 'Not Found'}")
    if doc:
        print(f"Keys in doc: {list(doc.keys())}")
        print(f"Training History Count: {len(doc.get('training_history', []))}")
        print(f"Profile: {doc.get('profile')}")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(check())
