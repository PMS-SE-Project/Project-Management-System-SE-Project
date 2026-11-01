from pymongo import MongoClient, ASCENDING
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "pms_db")

client = MongoClient(MONGO_URI)
db = client[DATABASE_NAME]

users_collection = db["users"]
sessions_collection = db["sessions"]
projects_collection = db["projects"]

projects_collection.create_index(
    [("name", ASCENDING)],
    unique=True,
    collation={"locale": "en", "strength": 2},
)