// Импортируем бота
const ICQ = require('icq-bot').default;
const qs = require('qs');
const fetch = require('node-fetch');

require('dotenv').config();

// Создаём фасад пакета ICQ
const bot = new ICQ.Bot(process.env.ICQ_BOT_TOKEN);

const validUsers = process.env.USERS.split(',');

// Создаём обработчик для новых сообщений
const handlerNewMessage = new ICQ.Handler.Message(null, (bot, event) => {
    // Получаем номер чата из объекта event
    const chatId = event.fromChatId;

    // Выводим в консоль тип события и номер чата
    console.log(`[${new Date().toLocaleString()}] new Message event.fromChatID = ${chatId}: ${event.text}`);

    if(!validUsers.some((id) => id === chatId)) {
        console.log(`[${new Date().toLocaleString()}] no user: `, chatId);
        bot.sendText(chatId, 'Нет прав');
        return;
    }
    const orderNumber = strToOrderNumber(event.text.trim());
    if(orderNumber) {
        getOrderData(orderNumber, process.env.ST)
            .then((orderObj) => {
                if(orderObj) {
                    const text = Object.keys(orderObj).reduce((acc, key) => {
                        acc = `${acc} ${key}: ${orderObj[key]}\n`;
                        return acc;
                    }, '');
                    // console.log('Text: ', text);
                    bot.sendText(chatId, text);
                } else {
                    bot.sendText(chatId, 'Ошибка');
                }
            })
    } else {
        bot.sendText(chatId, 'Неверный номер');
    }

});

// Создаём обработчик для удалённых сообщений
const handlerDeleteMessage = new ICQ.Handler.DeletedMessage(null, (bot, event) => {
    // Получаем номер чата из объекта event
    const chatId = event.fromChatId;
    // Выводим в консоль тип события и номер чата
    console.log(`[${new Date().toLocaleString()}] deleted Message event.fromChatID = ${chatId}`);
    // Отправляем сообщение в чат отправителя
    bot.sendText(chatId, "Зачем!");
});

// Получаем диспетчер бота и добавляем в него обработчики
bot.getDispatcher().addHandler(handlerNewMessage);
bot.getDispatcher().addHandler(handlerDeleteMessage);

// Запускаем пулинг для получения команд обработчикам
bot.startPolling();

const getOrderData = async (orderNumber, st) => {
    if(!orderNumber) return false;
    const result = await getRawOrderData(orderNumber, st);
    console.log(`[${new Date().toLocaleString()}] orderDataFromDb: `, result);
    let orderObj = {};
    if("data" in result) {
        try {
            orderObj = parseOrderDataString(result.data);
        } catch (e) {
            return false;
        }
    } else {
        return false;
    }
    return orderObj;
};

const getRawOrderData = async(orderNumber, st) => {

    const queue = qs.stringify({
        "st": st,
        "orderNumber": orderNumber
    });

    const url = `${process.env.FTP_URL}?${queue}`;

    try {
        return await fetch(url)
            .then((response) => {
                // console.log("Order data response: ", response);
                return response.text();
            })
            .then((data) => {
                // console.log("Order data response text: ", data);
                return JSON.parse(data);
            });
    } catch (e) {
        console.log(`[${new Date().toLocaleString()}] getOrderData error: `, e);
        return {};
    }

};

const parseOrderDataString = (str) => {
    const orderDataArray = str.split(';');
    // console.log('orderDataArray: ', orderDataArray);
    // let orderDataKeys = [
    //   'order',
    //   'createDate',
    //   'releaseDate',
    //   'product',
    //   'workType',
    //   'count',
    //   'material',
    //   'description',
    //   'additionalInfo',
    //   'manager',
    //   'office',
    //   'client',
    //   'approveDate'
    // ];
    const orderDataKeys = [
        'Номер заказа',
        'Заведён',
        'Отгрузка',
        'Название',
        'Вид работ',
        'Тираж',
        'Материал',
        'Описание',
        'Доп. инфо',
        'Менеджер',
        'Филиал',
        'Заказчик',
        'Дата согласования'
    ];
    const orderDataObj = orderDataKeys.reduce((acc, key, index) => {
        acc[key] = orderDataArray[index][0] === "\"" ? orderDataArray[index].slice(1, orderDataArray[index].length - 1) : orderDataArray[index];
        return acc;
    }, {});
    // console.log('Order data obj: ', orderDataObj);
    return orderDataObj;
};

const strToOrderNumber = (str) => {
    try {
        const orderNumber = parseInt(str.replace(/ /g, ''));
        if(orderNumber) {
            console.log('Correct request. Order number: ', orderNumber);
            return orderNumber;
        } else {
            console.log('Incorrect request. No success.');
            return false;
        }
    } catch(e) {
        console.log('Incorrect request. No success.');
        return false;
    }
}