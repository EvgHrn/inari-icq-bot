import { isEqual } from "date-fns";
import {OrderType} from "./utils/db";
import {UserType} from "./types/UserType";
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
        getParsedOrderData(orderNumber, process.env.ST)
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
    bot.startPolling();
}, 3600000);

const getParsedOrderData = async (orderNumber: number, st: string) => {
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

    const url = `${process.env.ORDERSWORKER_ADDR}?${queue}`;

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

// let onPriorOrdersFilesScanning = false;
// let onOtherOrdersFilesScanning = false;
//
// const updateOrders = async(ordersArr: FileInfo[]) => {
//
//     const nowDateStr = new Date().toLocaleString();
//
//     console.log(`${nowDateStr} orders count: `, ordersArr.length);
//
//     const ordersNumbersArr = ordersArr.map((order: FileInfo) => parseInt(order.name));
//
//     const ordersListFromDb: number[] | boolean = await db.getOrdersListFromDb();
//     console.log(`${nowDateStr} Orders from db: `, ordersListFromDb);
//
//     if(!Array.isArray(ordersListFromDb)) {
//         return false;
//     }
//
//     for(let i = 0; i < ordersNumbersArr.length; i++) {
//
//         const orderFileInfoObjFromFtp: FileInfo | undefined = ordersArr.find((order: FileInfo) => order.name === (ordersNumbersArr[i].toString()));
//         if(!orderFileInfoObjFromFtp) {
//             console.error(`${nowDateStr} No order info for: `, ordersNumbersArr[i]);
//             continue;
//         }
//
//         if(!ordersListFromDb.includes(ordersNumbersArr[i])) {
//             // new order
//             console.log(`${nowDateStr} We have new order: `, ordersNumbersArr[i]);
//             const obj = await orders.getOrderDataStr(ordersNumbersArr[i], process.env.ST);
//             console.log(`${nowDateStr} Order data string: `, obj.data);
//             const dateStr = orderFileInfoObjFromFtp.rawModifiedAt;
//             const date = parse(dateStr, 'MMM dd HH:mm', new Date());
//             console.log(`${nowDateStr} ModifiedAt for ${ordersNumbersArr[i]}: `, date.toLocaleString());
//             console.log(`${nowDateStr} Gonna create order on db`);
//             const newOrder = await db.createOrder(ordersNumbersArr[i], obj.data, date);
//             console.log(`${nowDateStr} Created order in db: `, newOrder);
//         } else {
//             // Existing order
//             // compare modifiedAt dates
//             const orderFromDb: OrderType = await db.getOrderByNumber(ordersNumbersArr[i]);
//             if(!orderFromDb) {
//                 continue;
//             }
//             const orderModifiedAtFromDbDate = orderFromDb.modifiedAt;
//             const dateStr = orderFileInfoObjFromFtp.rawModifiedAt;
//             const orderModifiedAtStrOnFtpDate: Date = parse(dateStr, 'MMM dd HH:mm', new Date());
//             if(!orderModifiedAtStrOnFtpDate) {
//                 console.error(`${nowDateStr} Date parsing error for: `, dateStr);
//                 continue;
//             }
//             // console.log('Compare modifiedAt dates: ', orderModifiedAtFromDbDate.toLocaleString(), orderModifiedAtStrOnFtpDate.toLocaleString());
//             if(!isEqual(orderModifiedAtFromDbDate, orderModifiedAtStrOnFtpDate)) {
//                 // Order file was updated
//                 console.log(`${nowDateStr} Dates NOT equal for ${ordersNumbersArr[i]}`);
//
//
//                 // @ts-ignore
//                 // const orderDataStrFromFtp = await getRawOrderData(ordersNumbersArr[i], process.env.ST);
//
//                 // const diff = orders.extractUpdatedInfo(orderFromDb.dataString, orderDataStrFromFtp.data);
//                 // console.log(`${nowDateStr} Difference: `, diff);
//                 // if(diff.updatedPartOfInfoAfter.trim() === diff.updatedPartOfInfoBefore.trim()) {
//                 //     console.log(`${nowDateStr} No difference actually, so do nothing`);
//                 //     continue;
//                 // }
//
//                 // parse order data strings
//                 const orderDataObjFromFtp = orders.parseOrderDataString(orderDataStrFromFtp.data);
//                 const orderDataObjFromDb = orders.parseOrderDataString(orderFromDb.dataString);
//
//                 let productStr = '';
//                 if(orderDataObjFromFtp && ('Название' in orderDataObjFromFtp)) {
//                     productStr = orderDataObjFromFtp['Название'];
//                 }
//
//                 let diffMessageStr = ``;
//
//                 const keysArray: string[] = [...Object.keys(orderDataObjFromDb), ...Object.keys(orderDataObjFromFtp)].reduce((acc: string[], key: string) => {
//                     if(!acc.includes(key)) {
//                         acc.push(key);
//                     }
//                     return acc;
//                 }, []);
//
//                 keysArray.map((key: string) => {
//                     if((key in orderDataObjFromFtp) && (key in orderDataObjFromDb)) {
//                         //if no diff
//                         if(orderDataObjFromFtp[key].trim() === orderDataObjFromDb[key].trim()) {
//                             return;
//                         //if diff
//                         } else {
//                             if(key !== 'Заказчик') { // we dont want to see that diffs
//                                 diffMessageStr = `${diffMessageStr}Было:\n${key}: ${orderDataObjFromDb[key]}\nСтало:\n${key}: ${orderDataObjFromFtp[key]}\n\n`;
//                             } else {
//                                 return;
//                             }
//                         }
//                     }
//                     //if new key
//                     if(Object.keys(orderDataObjFromFtp).includes(key) && !Object.keys(orderDataObjFromDb).includes(key)) {
//                         diffMessageStr = `${diffMessageStr}\nНовая информация:\n${key}: ${orderDataObjFromFtp[key]}`;
//                         return;
//                     }
//                     if(!Object.keys(orderDataObjFromFtp).includes(key) && Object.keys(orderDataObjFromDb).includes(key)) {
//                         diffMessageStr = `${diffMessageStr}\nУдалена информация:\n${key}: ${orderDataObjFromDb[key]}`;
//                         return;
//                     }
//                 });
//
//                 if(!diffMessageStr.length) {
//                     continue;
//                 }
//
//                 const usersArr: UserType[] = await db.getUsers();
//                 if(!usersArr) continue;
//                 const usersWithOrdersUpdatesSubscription = usersArr.filter((user: UserType) => user.subscriptions && (user.subscriptions.includes('ordersUpdates')));
//                 usersWithOrdersUpdatesSubscription.forEach((user: UserType) => {
//                     if(('subscriptions' in user) && user.subscriptions && user.subscriptions.includes('ordersUpdates') && user.subscriptions['ordersUpdates'].includes(orderDataObjFromFtp['Тип-1']))
//                     bot.sendText(user.icqId, `Изменение в заказе ${ordersNumbersArr[i]} ${productStr}:\n\n${diffMessageStr}`);
//                 });
//                 console.log(`${nowDateStr} Gonna update order on db`);
//                 const updatedOrder = await db.updateOrder(ordersNumbersArr[i], orderDataStrFromFtp.data, orderModifiedAtStrOnFtpDate);
//                 console.log(`${nowDateStr} Updated order: `, updatedOrder);
//             } else {
//                 // console.log(`${nowDateStr} Dates equal, so do nothing`);
//             }
//         }
//     }
//     // fill db with data string if no that order
//     // if there is order data in db, compare data string and if there are difference, notice subscribed users
//
// };

// setInterval(async() => {
//     if(onPriorOrdersFilesScanning) {
//         console.log(`[${new Date().toLocaleString()}] onPriorOrdersFilesScanning is true, so omit interval`);
//         return;
//     }
//     onPriorOrdersFilesScanning = true;
//     // get files list
//     const ordersInfoArr = await orders.getOrdersInfoFromFtp(60, process.env.ST);
//     if(!ordersInfoArr) {
//         return;
//     }
//     ordersInfoArr.sort((a: FileInfo, b: FileInfo) => {
//         if(a.name < b.name) {
//             return -1;
//         }
//         if(a.name > b.name) {
//             return 1
//         }
//         console.error(`[${new Date().toLocaleString()}] Duplicate file name: `, a.name);
//         return 0;
//     });
//
//     const ordersArrToUpdate: FileInfo[] = (ordersInfoArr.length > 1000) ? ordersInfoArr.slice(ordersInfoArr.length - 1000) : ordersInfoArr;
//     console.log(`[${new Date().toLocaleString()}] On top of priority orders: `, ordersArrToUpdate.map((order) => parseInt(order.name)));
//     await updateOrders(ordersArrToUpdate);
//     onPriorOrdersFilesScanning = false;
// }, 1800000);
//
// setInterval(async() => {
//     if(onOtherOrdersFilesScanning) {
//         console.log(`[${new Date().toLocaleString()}] onOtherOrdersFilesScanning is true, so omit interval`);
//         return;
//     }
//     onOtherOrdersFilesScanning = true;
//     // get files list
//     const ordersInfoArr = await orders.getOrdersInfoFromFtp(60, process.env.ST);
//     console.log(`[${new Date().toLocaleString()}] ordersInfoArr length: `, ordersInfoArr.length);
//     if(!ordersInfoArr) {
//         return;
//     }
//     ordersInfoArr.sort((a: FileInfo, b: FileInfo) => {
//         if(a.name < b.name) {
//             return -1;
//         }
//         if(a.name > b.name) {
//             return 1
//         }
//         console.error(`[${new Date().toLocaleString()}] Duplicate file name: `, a.name);
//         return 0;
//     });
//     const ordersArrToUpdate: FileInfo[] = ordersInfoArr.slice(0, ordersInfoArr.length - 999);
//     console.log(`[${new Date().toLocaleString()}] Other orders: `, ordersArrToUpdate.map((order) => parseInt(order.name)));
//     await updateOrders(ordersArrToUpdate);
//     onOtherOrdersFilesScanning = false;
// }, 4500000);

//     const ordersListToUpdate = ordersList.slice(0, ordersList.length - 999);