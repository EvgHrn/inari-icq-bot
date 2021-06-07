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
const date_fns_1 = require("date-fns");
// Импортируем бота
const ICQ = require('icq-bot').default;
const qs = require('qs');
const fetch = require('node-fetch');
const db = require('./utils/db');
const orders = require('./utils/orders');
const parse = require('date-fns/parse');
require('dotenv').config();
const dbState = db.getDbState();
console.info('Db state: ', dbState);
// Создаём фасад пакета ICQ
const bot = new ICQ.Bot(process.env.ICQ_BOT_TOKEN);
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
// Получаем диспетчер бота и добавляем в него обработчики
bot.getDispatcher().addHandler(handlerNewMessage);
bot.getDispatcher().addHandler(handlerDeleteMessage);
// Запускаем пулинг для получения команд обработчикам
bot.startPolling();
setInterval(() => {
    console.log('Restart polling');
    bot.stop();
    bot.startPolling();
}, 3600000);
const getOrderData = (orderNumber, st) => __awaiter(void 0, void 0, void 0, function* () {
    if (!orderNumber)
        return false;
    const result = yield getRawOrderData(orderNumber, st);
    console.log(`[${new Date().toLocaleString()}] orderDataFromDb: `, result);
    let orderObj = {};
    if (("data" in result) && result.data) {
        try {
            orderObj = orders.parseOrderDataString(result.data);
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
let onPriorOrdersFilesScanning = false;
let onOtherOrdersFilesScanning = false;
const updateOrders = (ordersArr) => __awaiter(void 0, void 0, void 0, function* () {
    const nowDateStr = new Date().toLocaleString();
    console.log(`${nowDateStr} orders count: `, ordersArr.length);
    const ordersNumbersArr = ordersArr.map((order) => parseInt(order.name));
    const ordersListFromDb = yield db.getOrdersListFromDb();
    console.log(`${nowDateStr} Orders from db: `, ordersListFromDb);
    if (!Array.isArray(ordersListFromDb)) {
        return false;
    }
    for (let i = 0; i < ordersNumbersArr.length; i++) {
        const orderObjFromFtp = ordersArr.find((order) => order.name === (ordersNumbersArr[i].toString()));
        if (!orderObjFromFtp) {
            console.error(`${nowDateStr} No order info for: `, ordersNumbersArr[i]);
            continue;
        }
        // new order
        if (!ordersListFromDb.includes(ordersNumbersArr[i])) {
            console.log(`${nowDateStr} We have new order: `, ordersNumbersArr[i]);
            const obj = yield orders.getOrderDataStr(ordersNumbersArr[i], process.env.ST);
            console.log(`${nowDateStr} Order data string: `, obj.data);
            const dateStr = orderObjFromFtp.rawModifiedAt;
            const date = parse(dateStr, 'MM-dd-yy hh:mmaa', new Date());
            console.log(`${nowDateStr} ModifiedAt for ${ordersNumbersArr[i]}: `, date.toLocaleString());
            console.log(`${nowDateStr} Gonna create order on db`);
            const newOrder = yield db.createOrder(ordersNumbersArr[i], obj.data, date);
            console.log(`${nowDateStr} Created order in db: `, newOrder);
        }
        else {
            // Existing order
            console.log(`${nowDateStr} Existing order: `, ordersNumbersArr[i]);
            // compare modifiedAt dates
            const orderFromDb = yield db.getOrderByNumber(ordersNumbersArr[i]);
            if (!orderFromDb) {
                continue;
            }
            const orderModifiedAtFromDbDate = orderFromDb.modifiedAt;
            const dateStr = orderObjFromFtp.rawModifiedAt;
            const orderModifiedAtStrOnFtpDate = parse(dateStr, 'MM-dd-yy hh:mmaa', new Date());
            if (!orderModifiedAtStrOnFtpDate) {
                console.error(`${nowDateStr} Date parsing error for: `, dateStr);
                continue;
            }
            // console.log('Compare modifiedAt dates: ', orderModifiedAtFromDbDate.toLocaleString(), orderModifiedAtStrOnFtpDate.toLocaleString());
            if (!date_fns_1.isEqual(orderModifiedAtFromDbDate, orderModifiedAtStrOnFtpDate)) {
                console.log(`${nowDateStr} Dates NOT equal for ${ordersNumbersArr[i]}`);
                // @ts-ignore
                const orderDataStrFromFtp = yield getRawOrderData(ordersNumbersArr[i], process.env.ST);
                const diff = orders.extractUpdatedInfo(orderFromDb.dataString, orderDataStrFromFtp.data);
                console.log(`${nowDateStr} Difference: `, diff);
                if (diff.updatedPartOfInfoAfter.trim() === diff.updatedPartOfInfoBefore.trim()) {
                    console.log(`${nowDateStr} No difference actually, so do nothing`);
                    continue;
                }
                const orderDataObj = orders.parseOrderDataString(orderDataStrFromFtp.data);
                let productStr = '';
                if (orderDataObj && ('Название' in orderDataObj)) {
                    productStr = orderDataObj['Название'];
                }
                const usersArr = yield db.getUsers();
                if (!usersArr)
                    continue;
                const usersWithOrdersUpdatesSubscription = usersArr.filter((user) => user.subscriptions && (user.subscriptions.includes('ordersUpdates')));
                usersWithOrdersUpdatesSubscription.forEach((user) => {
                    bot.sendText(user.icqId, `Изменение в заказе ${ordersNumbersArr[i]} ${productStr}:\n\nБыло:\n ${diff.updatedPartOfInfoBefore}\nСтало:\n ${diff.updatedPartOfInfoAfter}`);
                });
                console.log(`${nowDateStr} Gonna update order on db`);
                const updatedOrder = yield db.updateOrder(ordersNumbersArr[i], orderDataStrFromFtp.data, orderModifiedAtStrOnFtpDate);
                console.log(`${nowDateStr} Updated order: `, updatedOrder);
            }
            else {
                console.log(`${nowDateStr} Dates equal, so do nothing`);
            }
        }
    }
    // fill db with data string if no that order
    // if there is order data in db, compare data string and if there are difference, notice subscribed users
});
setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
    if (onPriorOrdersFilesScanning) {
        console.log(`[${new Date().toLocaleString()}] onPriorOrdersFilesScanning is true, so omit interval`);
        return;
    }
    onPriorOrdersFilesScanning = true;
    // get files list
    const ordersInfoArr = yield orders.getOrdersInfoFromFtp(60, process.env.ST);
    if (!ordersInfoArr) {
        return;
    }
    ordersInfoArr.sort((a, b) => {
        if (a.name < b.name) {
            return -1;
        }
        if (a.name > b.name) {
            return 1;
        }
        console.error(`[${new Date().toLocaleString()}] Duplicate file name: `, a.name);
        return 0;
    });
    const ordersArrToUpdate = ordersInfoArr.slice(ordersInfoArr.length - 1000);
    console.log(`[${new Date().toLocaleString()}] On top of priority orders: `, ordersArrToUpdate.map((order) => parseInt(order.name)));
    yield updateOrders(ordersArrToUpdate);
    onPriorOrdersFilesScanning = false;
}), 1800000);
setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
    if (onOtherOrdersFilesScanning) {
        console.log(`[${new Date().toLocaleString()}] onOtherOrdersFilesScanning is true, so omit interval`);
        return;
    }
    onOtherOrdersFilesScanning = true;
    // get files list
    const ordersInfoArr = yield orders.getOrdersInfoFromFtp(60, process.env.ST);
    if (!ordersInfoArr) {
        return;
    }
    ordersInfoArr.sort((a, b) => {
        if (a.name < b.name) {
            return -1;
        }
        if (a.name > b.name) {
            return 1;
        }
        console.error(`[${new Date().toLocaleString()}] Duplicate file name: `, a.name);
        return 0;
    });
    const ordersArrToUpdate = ordersInfoArr.slice(0, ordersInfoArr.length - 999);
    console.log(`[${new Date().toLocaleString()}] Other orders: `, ordersArrToUpdate.map((order) => parseInt(order.name)));
    yield updateOrders(ordersArrToUpdate);
    onOtherOrdersFilesScanning = false;
}), 4500000);
//     const ordersListToUpdate = ordersList.slice(0, ordersList.length - 999);
//# sourceMappingURL=index.js.map