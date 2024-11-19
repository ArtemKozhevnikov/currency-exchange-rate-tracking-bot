const db = require('./db');

const axios = require('axios');

async function addUser(telegramId) {
    await db.execute('INSERT IGNORE INTO users (telegram_id) VALUES (?)', [telegramId]);
}

async function addCurrency(telegramId, currencyCode, bot) {
    try {
        const [user] = await db.execute('SELECT id FROM users WHERE telegram_id = ?', [telegramId]);
        const userId = user[0]?.id;

        if (!userId) {
            return bot.sendMessage(telegramId, 'Ошибка: пользователь не найден.');
        }

        const [existingCurrency] = await db.execute('SELECT 1 FROM tracked_currencies WHERE user_id = ? AND currency_code = ?', [userId, currencyCode]);

        if (existingCurrency.length > 0) {
            return bot.sendMessage(telegramId, `Вы уже отслеживаете валюту ${currencyCode}.`);
        }

        const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/USD`);
        console.log('Ответ от API:', response.data);

        const availableCurrencies = response.data.rates;

        if (!availableCurrencies[currencyCode]) {
            console.log(`Валюта ${currencyCode} не доступна для отслеживания или не существует.`); 
            return bot.sendMessage(telegramId, `Валюта ${currencyCode} не доступна для отслеживания или не существует.`);
        }

        await db.execute('INSERT INTO tracked_currencies (user_id, currency_code) VALUES (?, ?)', [userId, currencyCode]);
        bot.sendMessage(telegramId, `Валюта ${currencyCode} добавлена для отслеживания.`);
    } catch (error) {
        console.error('Ошибка при добавлении валюты:', error);
        bot.sendMessage(telegramId, 'Ошибка при проверке валюты.');
    }
}

async function removeCurrency(telegramId, currencyCode) {
    const [user] = await db.execute('SELECT id FROM users WHERE telegram_id = ?', [telegramId]);
    const userId = user[0].id;
    await db.execute('DELETE FROM tracked_currencies WHERE user_id = ? AND currency_code = ?', [userId, currencyCode]);
}

async function getCurrencies(telegramId) {
    const [user] = await db.execute('SELECT id FROM users WHERE telegram_id = ?', [telegramId]);
    const userId = user[0].id;
    const [currencies] = await db.execute('SELECT currency_code FROM tracked_currencies WHERE user_id = ?', [userId]);
    return currencies.map((row) => row.currency_code);
}

async function setNotificationTime(telegramId, time) {
    const timeWithoutSeconds = time.split(':').slice(0, 2).join(':');
    await db.execute('UPDATE users SET notification_time = ? WHERE telegram_id = ?', [timeWithoutSeconds, telegramId]);
}

async function getNotificationTime() {
    const [users] = await db.execute('SELECT telegram_id, notification_time FROM users WHERE notification_time IS NOT NULL');
    return users.map(user => ({
        telegram_id: user.telegram_id,
        notification_time: user.notification_time.split(':').slice(0, 2).join(':')
    }));
}

async function isCurrencyTracked(telegramId, currencyCode) {
    const [user] = await db.execute('SELECT id FROM users WHERE telegram_id = ?', [telegramId]);
    const userId = user[0].id;
    const [result] = await db.execute('SELECT 1 FROM tracked_currencies WHERE user_id = ? AND currency_code = ?', [userId, currencyCode]);
    return result.length > 0;
}

module.exports = { addUser, addCurrency, removeCurrency, getCurrencies, setNotificationTime, getNotificationTime };