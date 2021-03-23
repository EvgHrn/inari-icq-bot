require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hhqiw.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`, {useNewUrlParser: true, useUnifiedTopology: true});

const db_connection = mongoose.connection;
db_connection.on('error', console.error.bind(console, 'mongoose connection error:'));
db_connection.once('open', function() {
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

module.exports.getUserByName = async (name: string, icqId: string) => {

    const user = new User({ name, icqId });

    try {
        const result = await user.save();
        return result ? result : false;
    } catch (err) {
        console.error(err);
        return false;
    }
};

module.exports.getDbState = () => {
    return db_connection.readyState;
};