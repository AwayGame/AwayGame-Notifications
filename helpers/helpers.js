const _ = require('underscore')
// Helper functions

module.exports = {
    checkForMissingFields: (requiredParams, data) => {
        let missingKeys = []
        requiredParams.forEach(function(key) {
            if (Object.keys(data).indexOf(key) < 0) {
                missingKeys.push(key)
            }
        })

        return missingKeys
    },
    milesToRadius: (miles) => {
        return config.milesToRadiusConversions[miles]
    },
    shuffleArray: (array) => {
        var currentIndex = array.length,
            temporaryValue, randomIndex;

        while (0 !== currentIndex) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }
        return array;
    },
    removeDuplicates: (array, key) => {
        return array.filter((item, index, self) => self.findIndex(b => b[key] === item[key]) === index)
    },
    addProvider: (array, provider) => {
        array.forEach(result => {
            result.provider = provider
        })
        return array
    },
    sortByKey: (array, key) => {
        array = array.sort(function(a, b) {
            return b[key] - a[key]
        });
        return array
    },
    removeIfNoValueByKey: (array, key) => {
        array = _.filter(array, function(obj) { 
            return obj[key] !== undefined && obj[key] !== null
        })
        return array
    }
}