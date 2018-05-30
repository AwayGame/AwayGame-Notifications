const CronJob = require('cron').CronJob;
const express = require('express');
const app = express();
const http = require('http')
const server = http.createServer(app);
const config = require('./config');
const RedisHelper = require('./helpers/redis')
const TicketMasterHelper = require('./helpers/ticketmaster')
const TRIP_API_URL = (config.environment != 'production') ? 'localhost:3345' : config.tripApiUrl

// Initialize Firebase
const functions = require("firebase-functions")
const admin = require('firebase-admin');

// Initialize the app and database
admin.initializeApp({
    credential: admin.credential.cert(config.appConfig),
    databaseURL: config.databaseURL
});

const db = admin.firestore();

server.listen(config.port, function() {
    console.log("server live on port " + config.port)
});

// Set up Cron Job for TicketMaster
setUpTicketMasterNotificationCron()

/**
 * Cron Job that runs once an hour and checks games where TBA is true
 */
function setUpTicketMasterNotificationCron() {
    new CronJob('0 0 */1 * * *', function() {
        console.log("checking ticket master games at " + new Date().toLocaleString() + "...")
        checkGames()
    }, null, true, 'America/New_York');


    // RedisHelper.set('gamesToPoll', {
    //     games: [{
    //         gameId: 'Z7r9jZ1Aek_F6',
    //         userId: '9Q03sxUlvHMmgzVIyMWKrZLpUcL2',
    //         tripId: '5sJokHUsF0Z1EyOIeRJk'
    //     }, {
    //         gameId: 'Z7r9jZ1AeaMft',
    //         userId: 'asd',
    //         tripId: 'asd'
    //     }]
    // })

    checkGames()

    async function checkGames() {
        let gamesToPoll = await getGamesToPollFromRedis()
        if (gamesToPoll) {
            console.log("gamesToPoll: ", gamesToPoll)
            for (let game of gamesToPoll.games) {
                let fullGame = await TicketMasterHelper.getGameDetails(game.gameId)
                console.log("got full game")
                if (fullGame.date) {
                    // Update the Trip and send the notification
                    console.log("update the game here!! and send the notification!")
                    let updateTripWithNewGameTimeResponse = await updateTripWithNewGameTime(game)
                    if (updateTripWithNewGameTimeResponse) {
                        // Game has been updated - send notification and remove from Redis
                        let notificationResponse = await sendTicketMasterNotification(game)
                        console.log("here is the notificationResponse: ", notificationResponse)
                        //RedisHelper.removeByKey()
                    } else {
                        console.log("got an error updating the trip: ", trip)
                    }
                }
            }
        }

        function getGamesToPollFromRedis() {
            return new Promise((resolve, reject) => {
                RedisHelper.get('gamesToPoll').then(games => {
                    resolve(games)
                })
            })
        }

        function updateTripWithNewGameTime(data) {
            return new Promise((resolve, reject) => {
                if (config.environment != 'production') {
                	console.log('in development. "Update" it here...')
                	resolve({
                		status: 200
                	})
                } else {
                    axios.post(TRIP_API_URL + '/trip/addGame/' + data.tripId, {
                            gameId: data.gameId,
                            userId: data.userId
                        })
                        .then(function(response) {
                            resolve(response)
                        })
                        .catch(function(error) {
                            reject(error)
                        });
                }
            })
        }

        function sendTicketMasterNotification(data) {
            return new Promise((resolve, reject) => {
                let message = "Your Trip has been updated with your AwayGame!"
                console.log("sending this notification")
                console.log(message)
                console.log("To user with id: ", data.userId)
                resolve(200)
            })
        }
    }
}