const TelegramBot = require('node-telegram-bot-api');

const mysql = require('mysql2/promise');

const axios = require('axios');

const { setIntervalAsync } = require('set-interval-async/dynamic');

const db = require('./db');

const { addUser, addCurrency, removeCurrency, getCurrencies, setNotificationTime, getNotificationTime } = require('./services');

const { scheduleNotifications } = require('./scheduler');

const token = '7484499923:AAGFDFeq2uk8L7jrYQ-f4gqnWI7tFfPUCQI';

const bot = new TelegramBot(token, { polling: true });

const API_URL = 'https://api.exchangerate-api.com/v4/latest/RUB';

// Команда старт
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await addUser(chatId);
    bot.sendMessage(chatId, 'Добро пожаловать! Используйте /help для просмотра команд.');
});

// Команда помощи
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;

    const helpMessage = `
Доступные команды:
/start - Начать работу с ботом.
/help - Показать список доступных команд.
/currencies - Показать список валют доступных для отслеживания.
/add <код валюты> - Добавить валюту для отслеживания (например, /add USD).
/remove <код валюты> - Удалить валюту из списка отслеживаемых (например, /remove USD).
/rates - Показать текущие курсы всех ваших валют.
/settime <ЧЧ:ММ> - Установить время для ежедневных уведомлений (например, /settime 09:30).
/reset_notification - Отключить ежедневные уведомления.
`;

    bot.sendMessage(chatId, helpMessage);
});

// Команда для просмотра всех доступных валют
bot.onText(/\/currencies/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const response = await axios.get(`${API_URL}USD`);
        const availableCurrencies = Object.keys(response.data.rates);

        if (availableCurrencies.length > 0) {
            const currenciesList = availableCurrencies.join('\n'); 
            bot.sendMessage(chatId, `Доступные валюты:\n${currenciesList}`);
        } else {
            bot.sendMessage(chatId, 'Не удалось получить список валют.');
        }
    } catch (error) {
        console.error('Ошибка при получении списка валют:', error);
        bot.sendMessage(chatId, 'Произошла ошибка при получении списка валют.');
    }
});

// Добавить валюту
bot.onText(/\/add (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const currency = match[1]?.toUpperCase();

    if (!currency || currency.length !== 3) {
        return bot.sendMessage(chatId, 'Укажите код валюты (например, USD).');
    }

    await addCurrency(chatId, currency, bot);
});

// Удалить валюту
bot.onText(/\/remove (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const currency = match[1]?.toUpperCase();

    if (!currency) {
        return bot.sendMessage(chatId, 'Укажите код валюты.');
    }

    await removeCurrency(chatId, currency);
    bot.sendMessage(chatId, `Валюта ${currency} удалена.`);
});

// Получить курсы валют
bot.onText(/\/rates/, async (msg) => {
    const chatId = msg.chat.id;
    const currencies = await getCurrencies(chatId);

    if (currencies.length === 0) {
        return bot.sendMessage(chatId, 'Ваш список валют пуст.');
    }

    try {
        const response = await axios.get(API_URL);
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

        bot.sendMessage(chatId, `Курсы валют относительно RUB:\n${result}`);
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, 'Ошибка получения данных о курсах валют.');
    }
});

// Установить время уведомлений
bot.onText(/\/settime (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const time = match[1];

    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
        return bot.sendMessage(chatId, 'Укажите время в формате ЧЧ:ММ (например, 09:30).');
    }

    await setNotificationTime(chatId, time);
    bot.sendMessage(chatId, `Время уведомлений установлено на ${time}.`);
});

// Команда для сброса времени уведомлений
bot.onText(/\/reset_notification/, async (msg) => {
    const chatId = msg.chat.id;

    const [user] = await db.execute('SELECT id FROM users WHERE telegram_id = ?', [chatId]);
    const userId = user[0]?.id;

    if (!userId) {
        return bot.sendMessage(chatId, 'Ошибка: пользователь не найден.');
    }

    try {
        await db.execute('UPDATE users SET notification_time = ? WHERE id = ?', [null, userId]);

        bot.sendMessage(chatId, 'Ежедневные уведомления отключены.');
    } catch (error) {
        console.error('Ошибка при отключении уведомлений:', error);
        bot.sendMessage(chatId, 'Ошибка при отключении уведомлений.');
    }
});

// Запуск планировщика уведомлений
scheduleNotifications(bot);