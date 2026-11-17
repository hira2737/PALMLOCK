
/**
 * PALMLOCK - Database Configuration & Connection Management
 * MongoDB connection with custom DNS resolution for Atlas SRV records.
 */

const dns = require('node:dns');

// Use DNS resolvers that successfully resolved the Atlas SRV and TXT records.
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    console.log('[DB] Custom DNS resolvers configured successfully.');
} catch (err) {
    console.warn('[DB] Unable to configure custom DNS resolvers:', err.message);
}

const mongoose = require('mongoose');

let connectionState = 'uninitialized';
let connectionError = null;

async function connectDB() {
    const uri = process.env.MONGODB_URI;

    if (
        !uri ||
        uri.trim() === '' ||
        uri.includes('YOUR_MONGODB_ATLAS_CONNECTION_STRING')
    ) {
        connectionState = 'pending_credentials';
        console.warn(
            '[DB] MONGODB_URI is unconfigured or placeholder.'
        );
        return { state: connectionState };
    }

    try {
        mongoose.set('strictQuery', false);

        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
            autoIndex: process.env.NODE_ENV !== 'production'
        });

        connectionState = 'connected';
        connectionError = null;

        console.log(
            '[DB] MongoDB connected successfully to database:',
            mongoose.connection.name
        );

        mongoose.connection.on('disconnected', () => {
            connectionState = 'disconnected';
            console.warn('[DB] MongoDB disconnected.');
        });

        mongoose.connection.on('reconnected', () => {
            connectionState = 'connected';
            connectionError = null;
            console.log('[DB] MongoDB reconnected.');
        });

        mongoose.connection.on('error', (err) => {
            connectionState = 'error';
            connectionError = err.message;
            console.error('[DB] MongoDB connection error:', err.message);
        });

        return { state: connectionState };

    } catch (err) {
        connectionState = 'disconnected';
        connectionError = err.message;

        console.error(
            '[DB] Unable to connect to MongoDB:',
            err.message
        );

        console.warn(
            '[DB] Server will continue running with database: disconnected/pending.'
        );

        return {
            state: connectionState,
            error: err.message
        };
    }
}

function getConnectionState() {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
        return 'connected';
    }

    return connectionState;
}

function isDbConnected() {
    return mongoose.connection && mongoose.connection.readyState === 1;
}

module.exports = {
    connectDB,
    getConnectionState,
    isDbConnected
};
