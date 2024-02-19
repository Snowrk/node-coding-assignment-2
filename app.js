const express = require('express')
const app = express()
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
app.use(express.json())

let db
const dbPath = path.join(__dirname, 'twitterClone.db')

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Started')
    })
  } catch (e) {
    console.log(e.message)
    process.exit(1)
  }
}

initializeDBAndServer()

const convert = item => {
  const convertedItem =
    item.slice(0, item.indexOf('_')) +
    item[item.indexOf('_') + 1].toUpperCase() +
    item.slice(item.indexOf('_') + 2)
  if (convertedItem.includes('_')) {
    convert(convertedItem)
  } else {
    return convertedItem
  }
}

const convertSnakeCaseToCamelCase = obj => {
  const objPropertiesInSnakeCase = Object.getOwnPropertyNames(obj)
  const objPropertiesInCamelCase = objPropertiesInSnakeCase.map(eachItem =>
    eachItem.includes('_') ? convert(eachItem) : eachItem,
  )
  const convertedObj = {}
  for (let counter = 0; counter < objPropertiesInCamelCase.length; counter++) {
    convertedObj[objPropertiesInCamelCase[counter]] =
      obj[objPropertiesInSnakeCase[counter]]
  }
  return convertedObj
}

app.post('/register/', async (request, response) => {
  try {
    const {username, password, name, gender} = request.body
    const userCheckQuery = `SELECT * FROM user WHERE username = '${username}'`
    const tweeterUser = await db.get(userCheckQuery)
    if (tweeterUser !== undefined) {
      response.status(400)
      response.send('User already exists')
    } else {
      if (password.length < 6) {
        response.status(400)
        response.send('Password is too short')
      } else {
        const hashedPassword = await bcrypt.hash(password, 10)
        const registerUserQuery = `INSERT INTO user(name, username, password, gender) VALUES('${name}', '${username}', '${hashedPassword}', '${gender}')`
        await db.run(registerUserQuery)
        response.send('User created successfully')
      }
    }
  } catch (e) {
    console.log(e)
  }
})

app.get('/users/', async (request, response) => {
  try {
    const usersQuery = `SELECT * FROM user`
    const users = await db.all(usersQuery)
    response.send(users)
  } catch (e) {
    console.log(e)
  }
})

app.get('/followers/', async (request, response) => {
  try {
    const followersQuery = `SELECT * FROM follower`
    const followers = await db.all(followersQuery)
    response.send(followers)
  } catch (e) {
    console.log(e)
  }
})

app.get('/tweets/', async (request, response) => {
  try {
    const tweetsQuery = `SELECT * FROM tweet`
    const tweets = await db.all(tweetsQuery)
    response.send(tweets)
  } catch (e) {
    console.log(e)
  }
})

app.get('/reply/', async (request, response) => {
  try {
    const replyQuery = `SELECT * FROM reply`
    const reply = await db.all(replyQuery)
    response.send(reply)
  } catch (e) {
    console.log(e)
  }
})

app.get('/likes/', async (request, response) => {
  try {
    const likesQuery = `SELECT * FROM like`
    const likes = await db.all(likesQuery)
    response.send(likes)
  } catch (e) {
    console.log(e)
  }
})

app.post('/login/', async (request, response) => {
  try {
    const {username, password} = request.body
    const userCheckQuery = `SELECT * FROM user WHERE username = '${username}'`
    const tweeterUser = await db.get(userCheckQuery)
    if (tweeterUser === undefined) {
      response.status(400)
      response.send('Invalid user')
    } else {
      // console.log(password)
      // console.log(tweeterUser)
      const passwordCheck = await bcrypt.compare(password, tweeterUser.password)
      if (!passwordCheck) {
        response.status(400)
        response.send('Invalid password')
      } else {
        const payload = {username}
        const jwtToken = jwt.sign(payload, 'KEY')
        response.send({jwtToken})
      }
    }
  } catch (e) {
    console.log(e)
  }
})

const authenticationToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'KEY', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

app.get(
  '/user/tweets/feed/',
  authenticationToken,
  async (request, response) => {
    try {
      const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${request.username}'`
      const {user_id} = await db.get(getUserIdQuery)
      const followingUserIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${user_id}`
      let followingUserIdArr = await db.all(followingUserIdsQuery)
      followingUserIdArr = followingUserIdArr.map(
        eachItem => eachItem.following_user_id,
      )
      const tweetsOfFollowingUsersQuery = `SELECT user.username as username, tweet.tweet as tweet, tweet.date_time as dateTime FROM tweet NATURAL JOIN user WHERE tweet.user_id IN (${followingUserIdArr}) ORDER BY tweet.date_time DESC LIMIT 4`
      const tweetsOfFollowingUsers = await db.all(tweetsOfFollowingUsersQuery)
      response.send(tweetsOfFollowingUsers)
    } catch (e) {
      console.log(e)
    }
  },
)

app.get('/user/following/', authenticationToken, async (request, response) => {
  try {
    const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${request.username}'`
    const {user_id} = await db.get(getUserIdQuery)
    const followingUserIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${user_id}`
    let followingUserIdArr = await db.all(followingUserIdsQuery)
    followingUserIdArr = followingUserIdArr.map(
      eachItem => eachItem.following_user_id,
    )
    const followingUserNamesQuery = `SELECT name FROM user WHERE user_id IN (${followingUserIdArr})`
    const followingUserNames = await db.all(followingUserNamesQuery)
    response.send(followingUserNames)
  } catch (e) {
    console.log(e)
  }
})

app.get('/user/followers/', authenticationToken, async (request, response) => {
  try {
    const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${request.username}'`
    const {user_id} = await db.get(getUserIdQuery)
    const followerUserIdsQuery = `SELECT follower_user_id FROM follower WHERE following_user_id = ${user_id}`
    let followerUserIdArr = await db.all(followerUserIdsQuery)
    followerUserIdArr = followerUserIdArr.map(
      eachItem => eachItem.follower_user_id,
    )
    const followingUserNamesQuery = `SELECT name FROM user WHERE user_id IN (${followerUserIdArr})`
    const followingUserNames = await db.all(followingUserNamesQuery)
    response.send(followingUserNames)
  } catch (e) {
    console.log(e)
  }
})

app.get('/tweets/:tweetId/', authenticationToken, async (request, response) => {
  try {
    const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${request.username}'`
    const {user_id} = await db.get(getUserIdQuery)
    const followingUserIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${user_id}`
    let followingUserIdArr = await db.all(followingUserIdsQuery)
    followingUserIdArr = followingUserIdArr.map(
      eachItem => eachItem.following_user_id,
    )
    const {tweetId} = request.params
    const tweetUserIdQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId}`
    const tweetUserId = await db.get(tweetUserIdQuery)
    // console.log(tweetUserId)
    // console.log(followingUserIdArr)
    if (!followingUserIdArr.includes(tweetUserId.user_id)) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const tweetStatsQuery = `SELECT tweet.tweet as tweet, COUNT(DISTINCT like.like_id) as likes, COUNT(DISTINCT reply.reply_id) as replies, tweet.date_time as dateTime FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id INNER JOIN reply ON tweet.tweet_id = reply.tweet_id WHERE tweet.tweet_id = ${tweetId}`
      const tweetStats = await db.get(tweetStatsQuery)
      // const tweetStatsQuery1 = `SELECT * FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id INNER JOIN reply ON tweet.tweet_id = reply.tweet_id WHERE tweet.tweet_id = ${tweetId}`
      // const tweetStats1 = await db.all(tweetStatsQuery1)
      response.send(tweetStats)
    }
  } catch (e) {
    console.log(e)
  }
})

app.get(
  '/tweets/:tweetId/likes/',
  authenticationToken,
  async (request, response) => {
    try {
      const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${request.username}'`
      const {user_id} = await db.get(getUserIdQuery)
      const followingUserIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${user_id}`
      let followingUserIdArr = await db.all(followingUserIdsQuery)
      followingUserIdArr = followingUserIdArr.map(
        eachItem => eachItem.following_user_id,
      )
      const {tweetId} = request.params
      const tweetUserIdQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId}`
      const tweetUserId = await db.get(tweetUserIdQuery)
      if (!followingUserIdArr.includes(tweetUserId.user_id)) {
        response.status(401)
        response.send('Invalid Request')
      } else {
        const likedUserIdQuery = `SELECT user_id FROM like WHERE tweet_id = ${tweetId}`
        let likedUserIdArr = await db.all(likedUserIdQuery)
        likedUserIdArr = likedUserIdArr.map(eachItem => eachItem.user_id)
        const likedUserNameQuery = `SELECT username FROM user WHERE user_id IN (${likedUserIdArr})`
        let likedUserNameArr = await db.all(likedUserNameQuery)
        likedUserNameArr = likedUserNameArr.map(eachItem => eachItem.username)
        response.send({likes: likedUserNameArr})
      }
    } catch (e) {
      console.log(e)
    }
  },
)

app.get(
  '/tweets/:tweetId/replies/',
  authenticationToken,
  async (request, response) => {
    try {
      const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${request.username}'`
      const {user_id} = await db.get(getUserIdQuery)
      const followingUserIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${user_id}`
      let followingUserIdArr = await db.all(followingUserIdsQuery)
      followingUserIdArr = followingUserIdArr.map(
        eachItem => eachItem.following_user_id,
      )
      const {tweetId} = request.params
      const tweetUserIdQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId}`
      const tweetUserId = await db.get(tweetUserIdQuery)
      if (!followingUserIdArr.includes(tweetUserId.user_id)) {
        response.status(401)
        response.send('Invalid Request')
      } else {
        const replyQuery = `SELECT user.name as name, reply.reply as reply FROM reply NATURAL JOIN user WHERE tweet_id = ${tweetId}`
        const repliesArr = await db.all(replyQuery)
        response.send({replies: repliesArr})
      }
    } catch (e) {
      console.log(e)
    }
  },
)

app.get('/user/tweets/', authenticationToken, async (request, response) => {
  try {
    const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${request.username}'`
    const {user_id} = await db.get(getUserIdQuery)
    const tweetStatsQuery = `SELECT tweet.tweet as tweet, COUNT(DISTINCT like.like_id) as likes, COUNT(DISTINCT reply.reply_id) as replies, tweet.date_time as dateTime FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id INNER JOIN reply ON tweet.tweet_id = reply.tweet_id WHERE tweet.user_id = ${user_id} GROUP BY tweet.tweet_id`
    const tweetStats = await db.all(tweetStatsQuery)
    response.send(tweetStats)
  } catch (e) {
    console.log(e)
  }
})

app.post('/user/tweets/', authenticationToken, async (request, response) => {
  try {
    const {tweet} = request.body
    const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${request.username}'`
    const {user_id} = await db.get(getUserIdQuery)
    const dateTime = new Date()
    const month =
      dateTime.getMonth() + 1 < 10
        ? '0' + (dateTime.getMonth() + 1)
        : dateTime.getMonth() + 1
    const date_time = `${dateTime.getFullYear()}-${month}-${dateTime.getDate()} ${dateTime.getHours()}:${dateTime.getMinutes()}:${dateTime.getSeconds()}`
    const newTweetQuery = `INSERT INTO tweet(tweet, user_id, date_time) VALUES('${tweet}', ${user_id}, '${date_time}')`
    const newTweet = await db.run(newTweetQuery)
    response.send('Created a Tweet')
  } catch (e) {
    console.log(e)
  }
})

app.delete(
  '/tweets/:tweetId/',
  authenticationToken,
  async (request, response) => {
    try {
      const {tweetId} = request.params
      const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${request.username}'`
      const {user_id} = await db.get(getUserIdQuery)
      const userIdQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId}`
      const userId = await db.get(userIdQuery)
      if (user_id !== userId.user_id) {
        response.status(401)
        response.send('Invalid Request')
      } else {
        const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id = ${tweetId}`
        const deletedTweet = await db.run(deleteTweetQuery)
        response.send('Tweet Removed')
      }
    } catch (e) {
      console.log(e)
    }
  },
)

module.exports = app
