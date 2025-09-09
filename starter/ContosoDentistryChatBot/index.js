// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const restify = require('restify');
const { BotFrameworkAdapter } = require('botbuilder');
const { DentaBot } = require('./bot');

// Vytvoření HTTP serveru
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log(`\n${server.name} listening to ${server.url}`);
    console.log('\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator');
    console.log('\nTo talk to your bot, open the emulator select "Open Bot"');
});

// Vytvoření adapteru
const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Obecný error handler
adapter.onTurnError = async (context, error) => {
    console.error(`\n[onTurnError] unhandled error: ${error}`);
    await context.sendActivity('Došlo k chybě, prosím zkuste to později.');
};

// Konfigurace služeb z .env
const configuration = {
    LUIS_APP_ID: process.env.LUIS_APP_ID,
    LUIS_API_KEY: process.env.LUIS_API_KEY,
    LUIS_API_HOST_NAME: process.env.LUIS_API_HOST_NAME,
    SCHEDULER_API_URL: process.env.SCHEDULER_API_URL
};

// Inicializace bota
const myBot = new DentaBot(configuration);

// Správný async handler pro REST endpoint
server.post('/api/messages', async (req, res) => {
    await adapter.processActivity(req, res, async (context) => {
        await myBot.run(context);
    });
});

// WebSocket endpoint (volitelné, lze vynechat pokud se nepoužívá streaming)
server.on('upgrade', (req, socket, head) => {
    const streamingAdapter = new BotFrameworkAdapter({
        appId: process.env.MicrosoftAppId,
        appPassword: process.env.MicrosoftAppPassword
    });
    streamingAdapter.onTurnError = adapter.onTurnError;
    streamingAdapter.useWebSocket(req, socket, head, async (context) => {
        await myBot.run(context);
    });
});
