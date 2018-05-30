module.exports = {
    getGameDetails: (id) => {
        return new Promise((resolve, reject) => {
            let url = config.ticketMasterApi.eventDetailsId + id + '?apikey=' + config.ticketMasterApi.clientId
            axios.get(url).then(result => {
                if(result.status === 200) {
                    return resolve(result.data)
                } else {
                    reject(result)
                }
            })
        })
    }
}