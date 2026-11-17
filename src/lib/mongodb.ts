import { MongoClient, type Db } from "mongodb";

declare global {
  var __hulksarMongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getMongoDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MongoDB is not configured. Add MONGODB_URI in your environment.");
  if (!globalThis.__hulksarMongoClientPromise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 10, minPoolSize: 0 });
    globalThis.__hulksarMongoClientPromise = client.connect();
  }
  const client = await globalThis.__hulksarMongoClientPromise;
  return client.db(process.env.MONGODB_DB_NAME?.trim() || "hulksar");
}
