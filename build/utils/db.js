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
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hhqiw.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });
const db_connection = mongoose.connection;
db_connection.on('error', console.error.bind(console, 'mongoose connection error:'));
db_connection.once('open', function () {
    // we're connected!
    console.log('mongoose connection success');
});
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        require: true
    },
    icqId: {
        type: String,
        require: true,
        unique: true
    },
    subscriptions: {
        type: [String],
        require: false,
    }
});
const orderSchema = new mongoose.Schema({
    number: {
        type: Number,
        require: true,
        unique: true
    },
    dataString: {
        type: String,
        require: true
    },
    modifiedAt: {
        type: Date,
        require: true
    }
});
const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
module.exports.createUser = (name, icqId) => __awaiter(void 0, void 0, void 0, function* () {
    const user = new User({ name, icqId });
    try {
        const result = yield user.save();
        return result ? result : false;
    }
    catch (err) {
        console.error(err);
        return false;
    }
});
module.exports.getUserByIcqId = (icqId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userObj = yield User.findOne({ 'icqId': icqId }).exec();
        return userObj ? userObj : false;
    }
    catch (e) {
        console.error("Getting user error: ", e);
        return false;
    }
});
module.exports.getDbState = () => {
    return db_connection.readyState;
};
module.exports.createOrder = (number, dataString, modifiedAt) => __awaiter(void 0, void 0, void 0, function* () {
    const order = new Order({ number, dataString, modifiedAt });
    try {
        const result = yield order.save();
        return result ? result : false;
    }
    catch (err) {
        console.error('createOrder error: ', err);
        return false;
    }
});
module.exports.getOrderByNumber = (number) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orderObj = yield Order.findOne({ number: number }).exec();
        return orderObj ? orderObj : false;
    }
    catch (e) {
        console.error("Getting order error: ", e);
        return false;
    }
});
module.exports.getOrdersListFromDb = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orders = yield Order.find({}, 'number').exec();
        return orders ? orders.map((order) => order.number) : false;
    }
    catch (e) {
        console.error("Getting OrdersListFromDb error: ", e);
        return false;
    }
});
//# sourceMappingURL=db.js.map