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
    console.info(console, 'mongoose connection success');
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
const User = mongoose.model('User', userSchema);
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
        console.log("Getting user error: ", e);
        return false;
    }
});
module.exports.getDbState = () => {
    return db_connection.readyState;
};
//# sourceMappingURL=db.js.map