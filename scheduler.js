const { setIntervalAsync } = require('set-interval-async/fixed');
const { getNotificationTime, getCurrencies } = require('./services');
const axios = require('axios');
const API_URL = 'https://api.exchangerate-api.com/v4/latest/';

async function scheduleNotifications(bot) {
    setIntervalAsync(async () => {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const users = await getNotificationTime();

        for (const user of users) {
            if (user.notification_time === currentTime) {
                const currencies = await getCurrencies(user.telegram_id);
                if (currencies.length > 0) {
                    try {
                        const response = await axios.get(`${API_URL}RUB`);
                        const rates = response.data.rates;

                        const result = currencies.map((cur) => {
                            if (cur === 'RUB') {
                                return `${cur}: 1 (базовая валюта)`; 
                            }
                            if (rates[cur]) {
                                const rateToRub = 1 / rates[cur];
                                return `${cur}: ${rateToRub.toFixed(2)}`;
                            }
                            return `${cur}: нет данных`;
                        }).join('\n');

                        bot.sendMessage(user.telegram_id, `Ежедневный отчёт:\n${result}`);
                    } catch (error) {
                        console.error('Ошибка при получении курсов валют:', error);
                        bot.sendMessage(user.telegram_id, 'Ошибка получения данных о курсах валют.');
                    }
                }
            }
        }
    }, 60000);
}


module.exports = { scheduleNotifications };