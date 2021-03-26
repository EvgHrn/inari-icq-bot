"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// Импортируем бота
const ICQ = require('icq-bot').default;
const qs = require('qs');
const fetch = require('node-fetch');
const db = require('./utils/db');
const orders = require('./utils/orders');
require('dotenv').config();
const dbState = db.getDbState();
console.info('Db state: ', dbState);
// Создаём фасад пакета ICQ
// const bot = new ICQ.Bot(process.env.ICQ_BOT_TOKEN);
// Создаём обработчик для новых сообщений
const handlerNewMessage = new ICQ.Handler.Message(null, (bot, event) => __awaiter(void 0, void 0, void 0, function* () {
    // Получаем номер чата из объекта event
    const chatId = event.fromChatId;
    // Выводим в консоль тип события и номер чата
    console.log(`[${new Date().toLocaleString()}] new Message event.fromChatID = ${chatId}: ${event.text}`);
    if (!process.env.USERS) {
        console.error('Env variable error');
        return;
    }
    const user = yield db.getUserByIcqId(chatId);
    if (!user) {
        console.log(`[${new Date().toLocaleString()}] no user: `, chatId);
        bot.sendText(chatId, 'Нет прав');
        return;
    }
    else {
        console.log(`[${new Date().toLocaleString()}] user is valid: `, user);
    }
    const orderNumber = strToOrderNumber(event.text.trim());
    if (orderNumber) {
        if (!process.env.ST) {
            console.error('Env variable error');
            return;
        }
        getOrderData(orderNumber, process.env.ST)
            .then((orderObj) => {
            if (orderObj) {
                const text = Object.keys(orderObj).reduce((acc, key) => {
                    acc = `${acc} ${key}: ${orderObj[key]}\n`;
                    return acc;
                }, '');
                // console.log('Text: ', text);
                bot.sendText(chatId, text);
            }
            else {
                bot.sendText(chatId, 'Ошибка');
            }
        });
    }
    else {
        bot.sendText(chatId, 'Неверный номер');
    }
}));
// Создаём обработчик для удалённых сообщений
const handlerDeleteMessage = new ICQ.Handler.DeletedMessage(null, (bot, event) => {
    // Получаем номер чата из объекта event
    const chatId = event.fromChatId;
    // Выводим в консоль тип события и номер чата
    console.log(`[${new Date().toLocaleString()}] deleted Message event.fromChatID = ${chatId}`);
    // Отправляем сообщение в чат отправителя
    bot.sendText(chatId, "Зачем!");
});
// Создаём обработчик для добавления пользователя
// const handlerCommand = new ICQ.Handler.Command("update",null, (bot, event) => {
//     let buttonOpenWeb = new ICQ.Button("Читать статьи", null, "https://fake-mm.ru")
//     // Вызов метода сервиса обработки данных и получение ID задачи
//     const id = service.addTask();
//     let buttonOk = new ICQ.Button("Отменить обработку", `{"name": "removeTask","id": ${id}}`)
//     bot.sendText(event.fromChatId, "Данные в очереди на обработку ", null,null,null,[buttonOk,buttonOpenWeb ]);
// });
// Получаем диспетчер бота и добавляем в него обработчики
// bot.getDispatcher().addHandler(handlerNewMessage);
// bot.getDispatcher().addHandler(handlerDeleteMessage);
// Запускаем пулинг для получения команд обработчикам
// bot.startPolling();
const getOrderData = (orderNumber, st) => __awaiter(void 0, void 0, void 0, function* () {
    if (!orderNumber)
        return false;
    const result = yield getRawOrderData(orderNumber, st);
    console.log(`[${new Date().toLocaleString()}] orderDataFromDb: `, result);
    let orderObj = {};
    if ("data" in result) {
        try {
            orderObj = parseOrderDataString(result.data);
        }
        catch (e) {
            return false;
        }
    }
    else {
        return false;
    }
    return orderObj;
});
const getRawOrderData = (orderNumber, st) => __awaiter(void 0, void 0, void 0, function* () {
    const queue = qs.stringify({
        "st": st,
        "orderNumber": orderNumber
    });
    const url = `${process.env.FTP_URL}?${queue}`;
    try {
        return yield fetch(url)
            .then((response) => {
            // console.log("Order data response: ", response);
            return response.text();
        })
            .then((data) => {
            // console.log("Order data response text: ", data);
            return JSON.parse(data);
        });
    }
    catch (e) {
        console.log(`[${new Date().toLocaleString()}] getOrderData error: `, e);
        return {};
    }
});
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
    return orderDataKeys.reduce((acc, key, index) => {
        acc[key] = orderDataArray[index][0] === "\"" ? orderDataArray[index].slice(1, orderDataArray[index].length - 1) : orderDataArray[index];
        return acc;
    }, {});
};
const strToOrderNumber = (str) => {
    try {
        const orderNumber = parseInt(str.replace(/ /g, ''));
        if (orderNumber) {
            console.log('Correct request. Order number: ', orderNumber);
            return orderNumber;
        }
        else {
            console.log('Incorrect request. No success.');
            return false;
        }
    }
    catch (e) {
        console.log('Incorrect request. No success.');
        return false;
    }
};
const updateOrdersData = () => __awaiter(void 0, void 0, void 0, function* () {
    // get files list
    const ordersList = yield orders.getOrdersFromFtp(10, process.env.ST);
    console.log("orders list: ", ordersList);
    for (let i = 0; i < 20; i++) {
        const obj = yield orders.getOrderDataStr(ordersList[i], process.env.ST);
        console.log("Order data string: ", obj.data);
        const dateStr = yield orders.getOrderFileModifiedAtStr(ordersList[i], process.env.ST);
        console.log(`Modified for ${ordersList[i]}: `, dateStr);
    }
    // fill db with data string if no that order
    // if there is order data in db, compare data string and if there are difference, notice subscribed users
});
setTimeout(updateOrdersData, 60000);
//# sourceMappingURL=index.js.map