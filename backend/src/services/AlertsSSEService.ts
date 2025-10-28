// backend/src/services/AlertsSSEService.ts

import type { Express, Request, Response } from 'express';
import { Kafka } from 'kafkajs';
import { createClient } from '@redis/client';
import { DBClient } from '../db/DBClient.ts'; // To look up project users

// --- CONFIGURATION ---
const KAFKA_TOPIC = 'dbserver1.public.alerts';
const KAFKA_GROUP_ID = 'garuda-alerts-group';
const REDIS_URL = 'redis://localhost:6379';
const KAFKA_BROKERS = ['localhost:9092'];
// ---

// Use a specific type for the SSE client map: { userId: [res, res, ..] }
type SSEClientMap = { [userId: string]: Response[] };
let sseClients: SSEClientMap = {};

const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', (err) => console.error('Redis Client Error', err));

const kafka = new Kafka({
    clientId: 'garuda-alert-consumer',
    brokers: KAFKA_BROKERS,
    retry: {
        initialRetryTime: 1000,
        retries: 50, // Keep retrying connection
    }
});
const consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });
const db = DBClient.getInstance();

/**
 * Sends a notification object to all connected SSE clients for a specific user.
 */
function sendToSSEClient(userId: string, notification: Record<string, any>): void {
    const clients = sseClients[userId];
    const notifString = `data: ${JSON.stringify(notification)}\n\n`;

    if (clients && clients.length > 0) {
        console.log(`SSE: Sending alert to ${clients.length} clients for user ${userId}`);
        clients.forEach(client => {
            client.write(notifString);
        });
    } else {
        console.log(`SSE: User ${userId} is offline. Alert stored in Redis.`);
    }
}

/**
 * Kafka consumer logic that receives the CDC event and routes it.
 */
async function runKafkaConsumer(): Promise<void> {
    try {
        await redisClient.connect(); // Connect Redis when starting consumer

        await consumer.connect();
        await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: false });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const messageValue = message.value?.toString();
                if (!messageValue) return;

                try {
                    const data = JSON.parse(messageValue);
                    // Debezium: 'after' contains the new row data for INSERT (op='c')
                    const payload = data?.payload?.after; 
                    if (!payload || data.payload.op !== 'c') {
                        console.log(`CDC: Skipping message (op: ${data?.payload?.op})`);
                        return;
                    }
                    
                    // --- CORE LOGIC: Find all users for the changed project ---
                    const projectId = payload.project_id;
                    const usersResult = await db.query(
                        'SELECT user_id FROM users_to_project WHERE project_id = $1',
                        [projectId]
                    );

                    const recipientUserIds: string[] = usersResult.rows.map(row => row.user_id);

                    if (recipientUserIds.length === 0) {
                        console.log(`CDC: No users found for project ${projectId}. Skipping alert.`);
                        return;
                    }

                    // Build the notification object from the 'alerts' table row
                    const notification = {
                        id: payload.id, // Primary key from alerts table
                        message: payload.message,
                        projectId: projectId,
                        aoiId: payload.aoi_fk_id,
                        timestamp: payload.alert_timestamp,
                        title: `Project Alert: ${projectId}`,
                    };
                    
                    // Process for each recipient
                    for (const userId of recipientUserIds) {
                        const notifString = JSON.stringify(notification);
                        
                        // 1. Save to Redis (List structure)
                        await redisClient.lPush(`alerts:${userId}`, notifString);
                        await redisClient.lTrim(`alerts:${userId}`, 0, 49); // Keep newest 50 alerts

                        // 2. Send via SSE
                        sendToSSEClient(userId, notification);
                    }

                } catch (err) {
                    console.error('Error processing Kafka message:', err);
                }
            },
        });
        console.log('⚡️ AlertsSSEService: Kafka consumer is running.');
    } catch (error) {
        console.error('🚨 AlertsSSEService: Kafka or Redis connection failed:', error);
        // Implement retry logic if needed, but KafkaJS has built-in retries for brokers
    }
}

/**
 * Initializes the entire real-time alert system (SSE endpoints and Kafka consumer).
 */
export function initAlertsSSE(app: Express): void {
    // 1. SSE Endpoint for Client Connection
    app.get('/api/alerts/events/:userId', async (req: Request, res: Response) => {
        const { userId } = req.params;
        // In a real app, VERIFY the userId against the session/JWT here!

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Store client connection
        if (!sseClients[userId]) sseClients[userId] = [];
        sseClients[userId].push(res);

        // Send missed notifications from Redis (in reverse order: newest first)
        try {
            const notifs = await redisClient.lRange(`alerts:${userId}`, 0, -1);
            // notifs is LIFO (lPush/lRange), so send as-is for newest-first display
            notifs.forEach(msg => res.write(`data: ${msg}\n\n`)); 
        } catch (err) {
            console.error('Redis historical fetch error:', err);
        }

        // Clean up on disconnect
        req.on('close', () => {
            sseClients[userId] = sseClients[userId].filter(client => client !== res);
        });
    });

    // 2. Mark as Read API (Clears from Redis list)
    app.post('/api/alerts/mark-read', async (req: Request, res: Response) => {
        const { userId, notificationId } = req.body;
        
        try {
            // Fetch all, filter the one to remove, delete list, re-push filtered list
            const notifs = await redisClient.lRange(`alerts:${userId}`, 0, -1);
            
            // LREM would be more efficient, but filtering a list of JSON strings is safer
            let countBefore = notifs.length;
            const filtered = notifs.filter(nn => {
                try {
                    return JSON.parse(nn).id != notificationId;
                } catch {
                    return true; // Keep malformed items to be safe
                }
            });

            if (filtered.length !== countBefore) {
                await redisClient.del(`alerts:${userId}`);
                if (filtered.length > 0) {
                    await redisClient.rPush(`alerts:${userId}`, filtered); // rPush multiple items efficiently
                }
            }

            res.json({ success: true, removed: countBefore - filtered.length });
        } catch (err) {
            console.error('Error marking alert as read:', err);
            res.status(500).json({ error: 'Failed to mark as read' });
        }
    });

    // 3. Start the Kafka Consumer
    runKafkaConsumer();
}