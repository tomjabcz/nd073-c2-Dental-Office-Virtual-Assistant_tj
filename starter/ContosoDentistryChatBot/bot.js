// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require('./intentrecognizer');
const axios = require('axios');

// Funkce pro dotazování Language Studio (Question Answering)
async function queryLanguageStudio(question) {
    try {
        const response = await axios.post(
            `${process.env.LANGUAGE_QNA_ENDPOINT}/language/:query-knowledgebases?projectName=${process.env.LANGUAGE_QNA_PROJECT}&deploymentName=${process.env.LANGUAGE_QNA_DEPLOYMENT}&api-version=2021-10-01`,
            {
                question: question,
                top: 3,
                includeUnstructuredSources: true,
            },
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': process.env.LANGUAGE_QNA_KEY,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data.answers;
    } catch (error) {
        console.error("Chyba při dotazu na Language Studio:", error.message);
        return [];
    }
}

class DentaBot extends ActivityHandler {
    constructor(configuration) {
        super();

        if (!configuration) throw new Error('[DentaBot]: Missing parameter: configuration is required');

        this.recognizer = new IntentRecognizer(
            configuration.LUIS_APP_ID,
            configuration.LUIS_API_KEY,
            configuration.LUIS_API_HOST_NAME
        );

        this.scheduler = new DentistScheduler(configuration.SCHEDULER_API_URL);

        this.onMessage(async (context, next) => {
            const userInput = context.activity.text;

            const luisResult = await this.recognizer.recognize(context);
            const topIntent = luisResult.intent;
            const topScore = luisResult.score;

            if (topIntent === 'ScheduleAppointment' && topScore > 0.5) {
                const result = await this.scheduler.scheduleAppointment(context);
                await context.sendActivity(result);
                await next();
                return;
            }

            if (topIntent === 'GetAvailability' && topScore > 0.5) {
                const result = await this.scheduler.getAvailability();
                await context.sendActivity(result);
                await next();
                return;
            }

            const answers = await queryLanguageStudio(userInput);

            if (answers.length > 0 && answers[0].confidenceScore > 0.5) {
                await context.sendActivity(answers[0].answer);
            } else {
                await context.sendActivity("Omlouvám se, nerozumím dotazu. Můžete to prosím říct jinak?");
            }

            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            const welcomeText =
                'Vítejte! Jsem virtuální asistent zubní ordinace Contoso. Můžete se mě ptát na běžné otázky nebo si domluvit termín.';

            for (let member of membersAdded) {
                if (member.id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
                }
            }

            await next();
        });
    }
}

module.exports.DentaBot = DentaBot;
