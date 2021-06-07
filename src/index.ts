import { isEqual } from "date-fns";
import {OrderType, UserType} from "./utils/db";
import {FileInfo} from "./utils/orders";
import {User} from "icq-bot/dist/interfaces/Entities/User";

export {};
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
const handlerNewMessage = new ICQ.Handler.Message(null, async(bot: any, event: any) => {
    // Получаем номер чата из объекта event
    const chatId = event.fromChatId;

    // Выводим в консоль тип события и номер чата
    console.log(`[${new Date().toLocaleString()}] new Message event.fromChatID = ${chatId}: ${event.text}`);

    if(!process.env.USERS) {
        console.error('Env variable error');
        return;
    }

    const user = await db.getUserByIcqId(chatId);

    if(!user) {
        console.log(`[${new Date().toLocaleString()}] no user: `, chatId);
        bot.sendText(chatId, 'Нет прав');
        return;
    } else {
        console.log(`[${new Date().toLocaleString()}] user is valid: `, user);
    }
    const orderNumber = strToOrderNumber(event.text.trim());
    if(orderNumber) {
        if(!process.env.ST) {
            console.error('Env variable error');
            return;
        }
        getOrderData(orderNumber, process.env.ST)
            .then((orderObj: any) => {
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
const handlerDeleteMessage = new ICQ.Handler.DeletedMessage(null, (bot: any, event: any) => {
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

const getOrderData = async (orderNumber: number, st: string) => {
    if(!orderNumber) return false;
    const result = await getRawOrderData(orderNumber, st);
    console.log(`[${new Date().toLocaleString()}] orderDataFromDb: `, result);
    let orderObj = {};
    if(("data" in result) && result.data) {
        try {
            orderObj = orders.parseOrderDataString(result.data);
        } catch (e) {
            return false;
        }
    } else {
        return false;
    }
    return orderObj;
};

const getRawOrderData = async(orderNumber: number, st: string) => {

    const queue = qs.stringify({
        "st": st,
        "orderNumber": orderNumber
    });

    const url = `${process.env.FTP_URL}?${queue}`;

    try {
        return await fetch(url)
            .then((response: any) => {
                // console.log("Order data response: ", response);
                return response.text();
            })
            .then((data: string) => {
                // console.log("Order data response text: ", data);
                return JSON.parse(data);
            });
    } catch (e) {
        console.log(`[${new Date().toLocaleString()}] getOrderData error: `, e);
        return {};
    }

};

const strToOrderNumber = (str: string) => {
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

let onPriorOrdersFilesScanning = false;
let onOtherOrdersFilesScanning = false;

const updateOrders = async(ordersArr: FileInfo[]) => {

    const nowDateStr = new Date().toLocaleString();

    console.log(`${nowDateStr} orders count: `, ordersArr.length);

    const ordersNumbersArr = ordersArr.map((order: FileInfo) => parseInt(order.name));

    const ordersListFromDb: number[] | boolean = await db.getOrdersListFromDb();
    console.log(`${nowDateStr} Orders from db: `, ordersListFromDb);

    if(!Array.isArray(ordersListFromDb)) {
        return false;
    }

    for(let i = 0; i < ordersNumbersArr.length; i++) {

        const orderObjFromFtp: FileInfo | undefined = ordersArr.find((order: FileInfo) => order.name === (ordersNumbersArr[i].toString()));
        if(!orderObjFromFtp) {
            console.error(`${nowDateStr} No order info for: `, ordersNumbersArr[i]);
            continue;
        }

        // new order
        if(!ordersListFromDb.includes(ordersNumbersArr[i])) {
            console.log(`${nowDateStr} We have new order: `, ordersNumbersArr[i]);
            const obj = await orders.getOrderDataStr(ordersNumbersArr[i], process.env.ST);
            console.log(`${nowDateStr} Order data string: `, obj.data);
            const dateStr = orderObjFromFtp.rawModifiedAt;
            const date = parse(dateStr, 'MM-dd-yy hh:mmaa', new Date());
            console.log(`${nowDateStr} ModifiedAt for ${ordersNumbersArr[i]}: `, date.toLocaleString());
            console.log(`${nowDateStr} Gonna create order on db`);
            const newOrder = await db.createOrder(ordersNumbersArr[i], obj.data, date);
            console.log(`${nowDateStr} Created order in db: `, newOrder);
        } else {
            // Existing order
            // console.log(`${nowDateStr} Existing order: `, ordersNumbersArr[i]);
            // compare modifiedAt dates
            const orderFromDb: OrderType = await db.getOrderByNumber(ordersNumbersArr[i]);
            if(!orderFromDb) {
                continue;
            }
            const orderModifiedAtFromDbDate = orderFromDb.modifiedAt;
            const dateStr = orderObjFromFtp.rawModifiedAt;
            const orderModifiedAtStrOnFtpDate: Date = parse(dateStr, 'MM-dd-yy hh:mmaa', new Date());
            if(!orderModifiedAtStrOnFtpDate) {
                console.error(`${nowDateStr} Date parsing error for: `, dateStr);
                continue;
            }
            // console.log('Compare modifiedAt dates: ', orderModifiedAtFromDbDate.toLocaleString(), orderModifiedAtStrOnFtpDate.toLocaleString());
            if(!isEqual(orderModifiedAtFromDbDate, orderModifiedAtStrOnFtpDate)) {
                console.log(`${nowDateStr} Dates NOT equal for ${ordersNumbersArr[i]}`);
                // @ts-ignore
                const orderDataStrFromFtp = await getRawOrderData(ordersNumbersArr[i], process.env.ST);
                const diff = orders.extractUpdatedInfo(orderFromDb.dataString, orderDataStrFromFtp.data);
                console.log(`${nowDateStr} Difference: `, diff);
                if(diff.updatedPartOfInfoAfter.trim() === diff.updatedPartOfInfoBefore.trim()) {
                    console.log(`${nowDateStr} No difference actually, so do nothing`);
                    continue;
                }
                const orderDataObj = orders.parseOrderDataString(orderDataStrFromFtp.data);
                let productStr = '';
                if(orderDataObj && ('Название' in orderDataObj)) {
                    productStr = orderDataObj['Название'];
                }
                const usersArr: UserType[] = await db.getUsers();
                if(!usersArr) continue;
                const usersWithOrdersUpdatesSubscription = usersArr.filter((user: UserType) => user.subscriptions && (user.subscriptions.includes('ordersUpdates')));
                usersWithOrdersUpdatesSubscription.forEach((user: UserType) => {
                    bot.sendText(user.icqId, `Изменение в заказе ${ordersNumbersArr[i]} ${productStr}:\n\nБыло:\n ${diff.updatedPartOfInfoBefore}\nСтало:\n ${diff.updatedPartOfInfoAfter}`);
                });
                console.log(`${nowDateStr} Gonna update order on db`);
                const updatedOrder = await db.updateOrder(ordersNumbersArr[i], orderDataStrFromFtp.data, orderModifiedAtStrOnFtpDate);
                console.log(`${nowDateStr} Updated order: `, updatedOrder);
            } else {
                // console.log(`${nowDateStr} Dates equal, so do nothing`);
            }
        }
    }
    // fill db with data string if no that order
    // if there is order data in db, compare data string and if there are difference, notice subscribed users

};

setInterval(async() => {
    if(onPriorOrdersFilesScanning) {
        console.log(`[${new Date().toLocaleString()}] onPriorOrdersFilesScanning is true, so omit interval`);
        return;
    }
    onPriorOrdersFilesScanning = true;
    // get files list
    const ordersInfoArr = await orders.getOrdersInfoFromFtp(60, process.env.ST);
    if(!ordersInfoArr) {
        return;
    }
    ordersInfoArr.sort((a: FileInfo, b: FileInfo) => {
        if(a.name < b.name) {
            return -1;
        }
        if(a.name > b.name) {
            return 1
        }
        console.error(`[${new Date().toLocaleString()}] Duplicate file name: `, a.name);
        return 0;
    });
    const ordersArrToUpdate: FileInfo[] = ordersInfoArr.slice(ordersInfoArr.length - 1000);
    console.log(`[${new Date().toLocaleString()}] On top of priority orders: `, ordersArrToUpdate.map((order) => parseInt(order.name)));
    await updateOrders(ordersArrToUpdate);
    onPriorOrdersFilesScanning = false;
}, 1800000);

setInterval(async() => {
    if(onOtherOrdersFilesScanning) {
        console.log(`[${new Date().toLocaleString()}] onOtherOrdersFilesScanning is true, so omit interval`);
        return;
    }
    onOtherOrdersFilesScanning = true;
    // get files list
    const ordersInfoArr = await orders.getOrdersInfoFromFtp(60, process.env.ST);
    if(!ordersInfoArr) {
        return;
    }
    ordersInfoArr.sort((a: FileInfo, b: FileInfo) => {
        if(a.name < b.name) {
            return -1;
        }
        if(a.name > b.name) {
            return 1
        }
        console.error(`[${new Date().toLocaleString()}] Duplicate file name: `, a.name);
        return 0;
    });
    const ordersArrToUpdate: FileInfo[] = ordersInfoArr.slice(0, ordersInfoArr.length - 999);
    console.log(`[${new Date().toLocaleString()}] Other orders: `, ordersArrToUpdate.map((order) => parseInt(order.name)));
    await updateOrders(ordersArrToUpdate);
    onOtherOrdersFilesScanning = false;
}, 4500000);

//     const ordersListToUpdate = ordersList.slice(0, ordersList.length - 999);