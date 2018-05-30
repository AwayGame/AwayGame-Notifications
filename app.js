const CronJob = require('cron').CronJob;
const express = require('express');
const app = express();
const http = require('http')
const server = http.createServer(app);
const axios = require('axios');
const config = require('./config');

// Initialize Firebase
const functions = require("firebase-functions")
const admin = require('firebase-admin');

// Initialize the app and database
admin.initializeApp({
    credential: admin.credential.cert(config.appConfig),
    databaseURL: config.databaseURL
});

const db = admin.firestore();

init()

server.listen(config.port, function() {
    console.log("server live on port " + config.port)
});

function init() {
	console.log("watching now")
}