const helpers = require('../helpers/helpers')
const GoogleHelper = require('../helpers/google')
const YelpHelper = require('../helpers/yelp')
const TicketMasterHelper = require('../helpers/ticketmaster')
const moment = require('moment')
const _ = require('underscore')

const TIMES = {
    'breakfast': 500,
    'morningActivity': 1000,
    'lunch': 1200,
    'afternoonActivity': 1400,
    'dinner': 1800,
    'eveningActivity': 2100
}

const DAILY_PREFERENCE_COUNT = {
    'food': 3,
    'day': 2,
    'night': 1
}

const ACTIVITIES = [{
        subactivity: 'breakfast',
        activity: 'food'
    }, {
        subactivity: 'morningActivity',
        activity: 'day'
    }, {
        subactivity: 'lunch',
        activity: 'food'
    }, {
        subactivity: 'afternoonActivity',
        activity: 'day'
    },
    {
        subactivity: 'dinner',
        activity: 'food'
    }, {
        subactivity: 'eveningActivity',
        activity: 'night'
    }
]

module.exports = {
    /**
     * Creates the user's trip by reaching out to our partners
     * and finding activities, travel options, bookings, etc
     * @param  {Object} The data passed up from the client
     * @return {Object} The user's trip
     */
    createTrip: (data) => {
        return new Promise((resolve, reject) => {

            console.log("fetching game data...")
            getGameData(data.gameId).then(gameData => {
                console.log("got the game data...")
                if (!data.radius) data.radius = "3.0"
                let arrivalDate = moment(data.arrivalTime);
                let departureDate = moment(data.departureTime);
                let tripLengthInHours = departureDate.diff(arrivalDate, 'hours')
                let totalDays = departureDate.diff(arrivalDate, 'days')
                let remainingHours = tripLengthInHours - (24 * totalDays)
                let formattedTripDates = []
                console.log("trip length is " + totalDays + " day(s) and " + remainingHours + " hour(s)")

                while (arrivalDate.isBefore(departureDate)) {
                    formattedTripDates.push(new moment(arrivalDate.format()))
                    arrivalDate.add(1, 'days');
                }

                let categories = []
                // Get a list of businesses that we can filter and sort
                // through before getting more details
                getListOfBusinessesFromProviders(data).then(businessData => {
                    let initialListOfBusinesses = []

                    for (var i = 0; i < businessData.length; i++) {
                        initialListOfBusinesses.push(...businessData[i])
                    }

                    // Remove duplicates
                    initialListOfBusinesses = helpers.removeDuplicates(initialListOfBusinesses, 'id')
                    initialListOfBusinesses = helpers.removeDuplicates(initialListOfBusinesses, 'name')
                    // Sort by user preferences
                    initialListOfBusinesses = sortByUserPreferenceAndRemoveBusinessesWithoutRequiredParameters(initialListOfBusinesses, data.preferences)
                    getListOfFinalBusinessesForUser(formattedTripDates.length, initialListOfBusinesses).then(finalChoices => {
                        getMoreDetails(finalChoices).then(finalBusinessData => {
                            let finalBusinesses = []
                            for (var i = 0; i < finalBusinessData.length; i++) {
                                finalBusinesses.push(...finalBusinessData[i])
                            }

                            formatTripFromBusinesses(formattedTripDates, finalBusinesses, gameData).then(trip => {
                                return resolve(trip)
                            })
                        })
                    })
                })
            })
        })

        /**
         * This function creates the trip response object for the front end
         * @param  {Array}          tripLengthInDays        THe days the user is going on their trip
         * @param  {Array}          businesses              The businesses and activities to use
         * @param  {Object}         gameData                The game that the user is going to
         * @return {Object}         trip                    The user's trip
         */
        function formatTripFromBusinesses(tripLengthInDays, businesses, gameData) {
            return new Promise((resolve, reject) => {
                let trip = {}

                console.log("Creating trip...")

                //Figure out when the user is going to their game. If the game
                //time is not set, then set a boolean on the trip
                if (gameData.dates.start.timeTBA) {
                    trip.needToCheckForGameTime = true
                } else {

                }

                for (var i = 0; i < tripLengthInDays.length; i++) {
                    let tripDataForTheDay = getActivitiesAndBackupsForTheDay(businesses, tripLengthInDays[i], gameData)
                    trip[tripLengthInDays[i].format()] = tripDataForTheDay[0]
                    businesses = tripDataForTheDay[1]
                }

                console.log("done!")
                console.log("returning the trip")

                return resolve(trip)

                function getActivitiesAndBackupsForTheDay(businesses, date, gameData) {
                    let day = {}
                    let activityForGame = getActivityForGame(gameData.dates.start, date)

                    for (var i = 0; i < ACTIVITIES.length; i++) {
                        // Check to see if this is when we add the game

                        let activity = ACTIVITIES[i]
                        if (activityForGame && activityForGame === activity.subactivity) {
                            // This is where the game should be
                            day['game'] = {
                                'title': gameData.name,
                                'time': moment(gameData.dates.start.dateTime)
                            }
                        } else {
                            let data = getBusinessAndBackupOpenAtAvailableTime(activity.activity, businesses, date.day(), activity.subactivity)
                            if (data) {
                                day[activity.subactivity] = data.activity
                                businesses = _(businesses).filter(function(b) {
                                    return !data.foundBusinesses.includes(b)
                                });
                            }
                        }
                    }

                    return [day, businesses]


                    /**
                     * Determines if a business is open and in an available time for the user
                     * @param  {Object}     The business we are comparing
                     * @param  {Int}        The day (0 - 6) that we need the business to be open on
                     * @param  {Int}        The time as an int that the business has to be open at
                     * @return {Boolean}    True/False if it is open
                     */
                    function getBusinessAndBackupOpenAtAvailableTime(category, businesses, day, time) {
                        let foundBusinesses = []

                        for (var i = 0; i < businesses.length; i++) {
                            let business = businesses[i]
                            for (var j = 0; j < business.hours.individualDaysData.length; j++) {
                                let businessDay = business.hours.individualDaysData[j]
                                if (validBusiness(foundBusinesses, business, category, businesses, businessDay, day, time)) {
                                    foundBusinesses.push(business)
                                    if (foundBusinesses.length >= 3) {

                                        let activityToReturn = foundBusinesses[0]
                                        activityToReturn.backups = [foundBusinesses[1], foundBusinesses[2]]

                                        return {
                                            activity: activityToReturn,
                                            foundBusinesses: foundBusinesses
                                        }
                                    }
                                }
                            }
                        }

                        function validBusiness(foundBusinesses, business, category, businesses, businessDay, day, time) {
                            return (_.findWhere(foundBusinesses, business) == null && business.category === category && businessDay.open.day === day && businessIsOpenOnTime(businessDay, TIMES[time]))
                        }

                        function businessIsOpenOnTime(businessDay, time) {
                            try {
                                // If it's open, return true
                                if (parseInt(businessDay.open.time) <= time) return true
                                if (parseInt(businessDay.close.time) > time) return true
                                // If the business closes on a different day, this means it is open past midnight, which
                                // is before our cap
                                if (businessDay.close.day != businessDay.open.day) return true
                                return false
                            } catch (e) {
                                console.log("we got a big fat error on this business: ", businessDay)
                                console.log("here was the error: ", e)
                                return false
                            }
                        }
                    }
                }
            })
        }

        /**
         * This function takes the results that we initially got and sorts/filters them
         * for the user. The sorting can be by price, distance to the user, rating, etc.
         *
         * Once we have sorted and chosen the businesses and their backups for the user, we will
         * return this array and get more details for these businesses
         *
         * @param  {Int}        numberOfDaysInTrip         The number of days in the user's trip
         * @param  {Array}      businesses                 The businesses that we are looking through
         * @return {Array}      finalChoices               The final set of activities, food, etc for the user
         */
        function getListOfFinalBusinessesForUser(numberOfDaysInTrip, businesses) {
            return new Promise((resolve, reject) => {
                // Create an object with each category and subcategory, so that
                // we can get the best options for the user
                let data = {}

                for (var i = 0; i < businesses.length; i++) {
                    let business = businesses[i]
                    if (!data[business.category]) {
                        data[business.category] = {}
                    }

                    if (!data[business.category][business.subcategory]) {
                        data[business.category][business.subcategory] = []
                    }

                    data[business.category][business.subcategory].push(business)
                }

                // For each day, get three options - one main, and two backups
                let finalBusinesses = []

                // for each category
                for (var i = 0; i < Object.keys(data).length; i++) {
                    let category = Object.keys(data)[i]
                    // for each subcategory
                    for (var j = 0; j < Object.keys(data[category]).length; j++) {
                        let subcategory = Object.keys(data[category])[j]
                        let start = 0
                        let end = (numberOfDaysInTrip * DAILY_PREFERENCE_COUNT[category] * 4)

                        if (data[category][subcategory].length <= end) {
                            finalBusinesses = finalBusinesses.concat(data[category][subcategory])
                        } else {
                            finalBusinesses = finalBusinesses.concat(data[category][subcategory].slice(start, end))
                        }
                    }
                }

                resolve(finalBusinesses)
            })
        }
    }
}


/**
 * Finds businesses from our providers - this function is 
 * a stub that call all of our helpers
 */
function getListOfBusinessesFromProviders(data) {
    return new Promise((resolve, reject) => {
        Promise.all([
            GoogleHelper.findBusinesses(data),
            YelpHelper.findBusinesses(data)
        ]).then(businesses => {
            return resolve(businesses)
        })
    })
}

function getMoreDetails(businesses) {
    return new Promise((resolve, reject) => {

        let data = {}
        for (var i = 0; i < businesses.length; i++) {
            if (!data[businesses[i].provider]) {
                data[businesses[i].provider] = []
            }
            data[businesses[i].provider].push(businesses[i])
        }

        Promise.all([
            GoogleHelper.getMoreDetails(data['google']),
            YelpHelper.getMoreDetails(data['yelp'])
        ]).then(businesses => {
            return resolve(businesses)
        })
    })
}

/**
 * Sorts by the user's preferences
 * @param  {Array}  businesses          The businesses to sort
 * @param  {Object} preferences         The user's preferences that they entered in the app
 * @return {Array}                      The sorted businesses
 */
function sortByUserPreferenceAndRemoveBusinessesWithoutRequiredParameters(businesses, preferences) {
    // For now, just sort by rating...
    businesses = businesses.sort(function(a, b) {
        return b.rating - a.rating
    });
    return businesses
}

function getGameData(id) {
    return new Promise((resolve, reject) => {
        TicketMasterHelper.getGameDetails(id).then(details => {
                return resolve(details)
            })
            .catch(e => {
                reject(e)
            })
    })
}

/**
 * Gets the correct time slot for the game
 * @param  {Object} gameData The game data
 * @return {Object}          The time slot for the game
 */
function getActivityForGame(gameDateTimes, currentDay) {
    let date = parseInt(moment(gameDateTimes.dateTime).format('HHmm'))
    let keysOfTimes = Object.keys(TIMES)
    for (var i = 0; i < keysOfTimes.length; i++) {
        let activity = keysOfTimes[i]
        if (i > 0 && date > TIMES[activity] && date <= TIMES[keysOfTimes[i + 1]] && moment(gameDateTimes.dateTime).isSame(moment(currentDay), 'day')) {
            return activity
        }
    }
}