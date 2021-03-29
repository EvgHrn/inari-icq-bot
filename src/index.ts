import { isEqual } from "date-fns";
import {OrderType} from "./utils/db";
import {FileInfo} from "./utils/orders";

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
// const bot = new ICQ.Bot(process.env.ICQ_BOT_TOKEN);

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

const getOrderData = async (orderNumber: number, st: string) => {
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

const parseOrderDataString = (str: string) => {
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
    return orderDataKeys.reduce((acc: any, key, index) => {
        acc[key] = orderDataArray[index][0] === "\"" ? orderDataArray[index].slice(1, orderDataArray[index].length - 1) : orderDataArray[index];
        return acc;
    }, {});
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

    console.log("orders count: ", ordersArr.length);

    const ordersNumbersArr = ordersArr.map((order: FileInfo) => parseInt(order.name));

    const ordersListFromDb: number[] | boolean = await db.getOrdersListFromDb();
    console.log('Orders from db: ', ordersListFromDb);

    if(!Array.isArray(ordersListFromDb)) {
        return false;
    }

    for(let i = 0; i < ordersNumbersArr.length; i++) {

        const orderObjFromFtp: FileInfo | undefined = ordersArr.find((order: FileInfo) => order.name === (ordersNumbersArr[i].toString()));
        if(!orderObjFromFtp) {
            console.error("No order info for: ", ordersNumbersArr[i]);
            continue;
        }

        // new order
        if(!ordersListFromDb.includes(ordersNumbersArr[i])) {
            console.log('We have new order: ', ordersNumbersArr[i]);
            const obj = await orders.getOrderDataStr(ordersNumbersArr[i], process.env.ST);
            console.log("Order data string: ", obj.data);
            const dateStr = orderObjFromFtp.rawModifiedAt;
            const date = parse(dateStr, 'MM-dd-yy hh:mmaa', new Date());
            console.log(`ModifiedAt for ${ordersNumbersArr[i]}: `, date.toLocaleString());
            console.log('Gonna create order on db: ', ordersNumbersArr[i], obj.data, date);
            const newOrder = await db.createOrder(ordersNumbersArr[i], obj.data, date);
            console.log('Created order in db: ', newOrder);
        } else {
            console.log('Existing order: ', ordersNumbersArr[i]);
            // compare modifiedAt dates
            const orderFromDb: OrderType = await db.getOrderByNumber(ordersNumbersArr[i]);
            if(!orderFromDb) {
                continue;
            }
            const orderModifiedAtFromDbDate = orderFromDb.modifiedAt;
            const dateStr = orderObjFromFtp.rawModifiedAt;
            const orderModifiedAtStrOnFtpDate = parse(dateStr, 'MM-dd-yy hh:mmaa', new Date());
            if(!orderModifiedAtStrOnFtpDate) {
                console.error('Date parsing error for: ', dateStr);
                continue;
            }
            console.log('Compare modifiedAt dates: ', orderModifiedAtFromDbDate.toLocaleString(), orderModifiedAtStrOnFtpDate.toLocaleString());
            if(!isEqual(orderModifiedAtFromDbDate, orderModifiedAtStrOnFtpDate)) {
                console.log('Dates NOT equal, so update');

            } else {
                console.log('Dates equal, so do nothing');
            }
        }
    }
    // fill db with data string if no that order
    // if there is order data in db, compare data string and if there are difference, notice subscribed users

};

setTimeout(async() => {
    if(onPriorOrdersFilesScanning) return;
    onPriorOrdersFilesScanning = true;
    // get files list
    const ordersInfoArr = await orders.getOrdersInfoFromFtp(60, process.env.ST);
    if(!ordersInfoArr) {
        return;
    }
    // const ordersList = ordersInfoArr.map((orderInfo: FileInfo) => parseInt(orderInfo.name));
    ordersInfoArr.sort((a: FileInfo, b: FileInfo) => {
        if(a.name < b.name) {
            return -1;
        }
        if(a.name > b.name) {
            return 1
        }
        console.error('Duplicate file name: ', a.name);
        return 0;
    });
    const ordersArrToUpdate: FileInfo[] = ordersInfoArr.slice(ordersInfoArr.length - 1000);
    console.log("On top of priority orders: ", ordersArrToUpdate.map((order) => parseInt(order.name)));
    await updateOrders(ordersArrToUpdate);
    onPriorOrdersFilesScanning = false;
}, 5000);

// setTimeout(async() => {
//     if(onOtherOrdersFilesScanning) return;
//     onOtherOrdersFilesScanning = true;
//     // get files list
//     const ordersList = await orders.getOrdersFromFtp(60, process.env.ST);
//     const ordersListToUpdate = ordersList.slice(0, ordersList.length - 999);
//     console.log("Other orders: ", ordersListToUpdate);
//     await updateOrders(ordersListToUpdate);
//     onOtherOrdersFilesScanning = false;
// }, 5000);