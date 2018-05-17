const { MongoClient } = require('mongodb')

const dbExists = url => async dbName => {
  let client
  try {
    client = await MongoClient.connect(url)
  } catch (err) {
    return false
  }

  try {
    const { databases } = await client.db().admin().listDatabases()

    const dbList = databases.map(({ name }) => name)
    return dbList.includes(dbName)
  } catch (err) {
    console.log(err)
    return false
  } finally {
    client.close()
  }
}

module.exports = {
  dbExists
}
