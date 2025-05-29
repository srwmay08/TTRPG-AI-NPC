# database.py
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from config import config

class Database:
    """MongoDB Database Connector."""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
            try:
                cls._instance.client = MongoClient(config.MONGO_URI)
                # Verify connection
                cls._instance.client.admin.command('ping')
                print("Successfully connected to MongoDB!")
                cls._instance.db = cls._instance.client[config.DB_NAME]
            except ConnectionFailure as e:
                print(f"Could not connect to MongoDB: {e}")
                cls._instance.client = None
                cls._instance.db = None
            except Exception as e:
                print(f"An unexpected error occurred during MongoDB connection: {e}")
                cls._instance.client = None
                cls._instance.db = None
        return cls._instance

    def get_db(self):
        """Returns the database instance."""
        if self.db is None:
            # Try to reconnect or handle error
            print("Database not initialized. Attempting to reconnect...")
            try:
                self.client = MongoClient(config.MONGO_URI)
                self.client.admin.command('ping')
                self.db = self.client[config.DB_NAME]
                print("Reconnected to MongoDB!")
            except Exception as e:
                print(f"Failed to reconnect to MongoDB: {e}")
                return None
        return self.db

# Initialize and expose the database connection instance
db_connector = Database()

# Example usage (optional, for testing connection directly)
if __name__ == '__main__':
    db = db_connector.get_db()
    if db:
        print(f"Connected to database: {db.name}")
        # You can try inserting a test document
        # try:
        #     test_collection = db.test_connection
        #     test_collection.insert_one({"status": "connected"})
        #     print("Test document inserted.")
        #     test_collection.delete_one({"status": "connected"}) # Clean up
        # except Exception as e:
        #     print(f"Error interacting with database: {e}")
    else:
        print("Failed to get database instance.")