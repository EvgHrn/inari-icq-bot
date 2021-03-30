import {FileInfo} from "./orders";

require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hhqiw.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`, {useNewUrlParser: true, useUnifiedTopology: true});

const db_connection = mongoose.connection;
db_connection.on('error', console.error.bind(console, 'mongoose connection error:'));
db_connection.once('open', function() {
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

module.exports.createUser = async (name: string, icqId: string) => {

    const user = new User({ name, icqId });

    try {
        const result = await user.save();
        return result ? result : false;
    } catch (err) {
        console.error(err);
        return false;
    }
};

module.exports.getUserByIcqId = async (icqId: string): Promise<boolean | UserType> => {
    try {
        const userObj = await User.findOne({ 'icqId': icqId }).exec();
        return userObj ? userObj : false;
    } catch (e) {
        console.error("Getting user error: ", e);
        return false;
    }
};

module.exports.getUsers = async (): Promise<boolean | UserType[]> => {
    try {
        const users = await User.find({}).exec();
        return users ? users : false;
    } catch (e) {
        console.error("Getting users error: ", e);
        return false;
    }
};

module.exports.getDbState = () => {
    return db_connection.readyState;
};

module.exports.createOrder = async (number: number, dataString: string, modifiedAt: Date) => {

    const order = new Order({ number, dataString, modifiedAt });

    try {
        const result = await order.save();
        return result ? result : false;
    } catch (err) {
        console.error('createOrder error: ', err);
        return false;
    }
};

module.exports.updateOrder = async (number: number, dataString: string, modifiedAt: Date) => {

    // const order = new Order({ number, dataString, modifiedAt });

    try {
        const result = await Order.updateOne({ number: number }, { dataString: dataString, modifiedAt: modifiedAt });
        return result ? result : false;
    } catch (err) {
        console.error('updateOrder error: ', err);
        return false;
    }
};

module.exports.getOrderByNumber = async (number: number) => {
    try {
        const orderObj = await Order.findOne({ number: number }).exec();
        return orderObj ? orderObj : false;
    } catch (e) {
        console.error("Getting order error: ", e);
        return false;
    }
};

module.exports.getOrdersListFromDb = async(): Promise<number[] | boolean> => {

    try {
        const orders = await Order.find({}, 'number').exec();
        return orders ? orders.map((order: any ) => order.number) : false;
    } catch (e) {
        console.error("Getting OrdersListFromDb error: ", e);
        return false;
    }

};

export interface UserType {
    name: string,
    icqId: string,
    subscriptions?: Subscription[]
}

export interface OrderType {
    number: number,
    dataString: string,
    modifiedAt: Date
}

export type Subscription = 'ordersUpdates';