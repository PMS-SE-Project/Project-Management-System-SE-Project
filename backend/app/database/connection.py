from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
from dotenv import load_dotenv
import logging
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "pms_db")

client = MongoClient(MONGO_URI)
db = client[DATABASE_NAME]

users_collection = db["users"]
sessions_collection = db["sessions"]
projects_collection = db["projects"]
tasks_collection = db["tasks"]
task_comments_collection = db["task_comments"]

projects_collection.create_index(
    [("name", ASCENDING)],
    unique=True,
    collation={"locale": "en", "strength": 2},
)


try:
    tasks_collection.create_index(
        [("project_id", ASCENDING), ("title", ASCENDING)],
        unique=True,
        name="project_id_1_title_1",
    )
except DuplicateKeyError:
    logging.getLogger(__name__).warning(
        "Cannot create unique task index because duplicate (project_id, title) "
        "records already exist. Resolve the duplicates manually to enable "
        "database-level uniqueness."
    )