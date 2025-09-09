// intentrecognizer.js
let LuisRecognizer;
try {
  ({ LuisRecognizer } = require('botbuilder-ai'));
} catch (_) {
  // bot pojede v QnA-only režimu i bez balíčku botbuilder-ai
}

class IntentRecognizer {
  /**
   * @param {string} appId
   * @param {string} apiKey
   * @param {string} hostName - např. "https://westeurope.api.cognitive.microsoft.com" (bez koncové '/')
   */
  constructor(appId, apiKey, hostName) {
    this.enabled = Boolean(appId && apiKey && hostName && LuisRecognizer);
    if (this.enabled) {
      this.luis = new LuisRecognizer(
        {
          applicationId: appId,
          endpointKey: apiKey,
          endpoint: String(hostName).replace(/\/+$/, '')
        },
        { apiVersion: 'v3' }
      );
    } else {
      this.luis = undefined; // QnA-only režim
    }
  }

  get isConfigured() {
    return this.enabled;
  }

  /**
   * Jednotné rozhraní pro bot.js
   * - bez LUIS → fallback "None"
   * - s LUIS → vrací { intent, score, entities }
   */
  async recognize(context) {
    if (!this.luis) {
      return { intent: 'None', score: 0, entities: {} };
    }

    const result = await this.luis.recognize(context);

    // v3 tvar
    const pred = result?.prediction;
    if (pred?.topIntent) {
      const intent = pred.topIntent;
      const score = pred.intents?.[intent]?.score ?? 0;
      const entities = pred.entities ?? {};
      return { intent, score, entities };
    }

    // fallback pro netypický tvar
    const intents = result?.intents || {};
    const [intent = 'None', data = { score: 0 }] =
      Object.entries(intents).sort((a, b) => (b[1]?.score ?? 0) - (a[1]?.score ?? 0))[0] || [];
    return { intent, score: data.score ?? 0, entities: result?.entities ?? {} };
  }

  // Zachováno pro případ starého volání
  async executeLuisQuery(context) {
    if (!this.luis) return { intent: 'None', score: 0, entities: {} };
    return this.luis.recognize(context);
  }

  getTimeEntity(result = {}) {
    const pred = result?.prediction;
    const entities = pred?.entities || result?.entities || {};
    const dt = entities.datetimeV2 || entities.datetime;
    if (!dt || !dt[0]) return undefined;
    const timex = dt[0].timex || (dt[0].values?.map(v => v?.timex));
    return Array.isArray(timex) ? timex[0] : timex;
  }
}

module.exports = IntentRecognizer;
