import { MongoClient } from 'mongodb';

// 개발 모드에서 파일을 고칠 때마다 새 연결이 생기지 않도록 전역에 한 번만 만든다.
const globalForMongo = globalThis as unknown as { mongoClient?: Promise<MongoClient> };

export function getMongoClient(): Promise<MongoClient> | null {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  globalForMongo.mongoClient ??= new MongoClient(uri).connect();
  return globalForMongo.mongoClient;
}
