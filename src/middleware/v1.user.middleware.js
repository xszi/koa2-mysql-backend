const { APPID, SECRET } = require('../config/config.default')
const User = require("../model/user.model");
const axios = require('axios')

const { getUserInfoByOpenid, UserCreate } = require('../service/v1.user.service')
const jwt = require('jsonwebtoken');

const { JWTSECRET } = require("../config/config.default");

const getOpenid = async (ctx, next) => {
    const { code ,name} = ctx.request.body
    console.log(code, 'code22222');
    let result = await axios({
        method: 'get',
        url: `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${SECRET}&js_code=${code}&grant_type=authorization_code`
    })
    ctx.state.v1user = result.data
    ctx.state.v1user.user_name = name
    console.log(ctx.state.v1user,'ctx.state.v1user');
    await next()
}

const hasUserInfo = async (ctx, next) => {
  console.log(ctx, 'ctx999');
    const res = await getUserInfoByOpenid(ctx.state.v1user.openid)
    if (!res) {
        // 说明数据库没有该用户信息
        await UserCreate(ctx.state.v1user.openid,ctx.state.v1user.user_name)
    }
    ctx.state.v1user = {
        session_key: ctx.state.v1user.session_key,
        ...res.dataValues
    }
    await next()
}

const hasAdminUserInfo = async (ctx, next) => {
  console.log(ctx.request.body, 'ctx-admin')
  const { username, password } = (ctx.request.body)
  const opt = {};
    username && Object.assign(opt, { user_name: username });
    password && Object.assign(opt, { password: password });
    let result
    try {
      result = await User.findOne({
        attributes: ["user_name", "password"],
        where: opt,
      });
    } catch(error) {
      console.log(error);
    }
    if (!result) {
        // 说明数据库没有该用户信息
        ctx.state = {
          data: null
        }
    } else {
      ctx.state.data = {
        ...result.dataValues,
        token: 'madaha'
      }
    }
    await next()
}

const jwtTokenCheck = async (ctx, next) => {
    try {
      const { authorization } = ctx.request.header
      const token = (authorization ? authorization : '').replace('Bearer ', '')
      const user = jwt.verify(token, JWTSECRET)
      ctx.state.v1user = user
    } catch (error) {
      console.log(error,'token');
      switch (error.name) {
        case 'TokenExpiredError':
          return ctx.app.emit('error', {
            code: 500,
            msg: "用户登录已过期",
            result: ''
          }, ctx)
        case 'JsonWebTokenError':
          return ctx.app.emit('error', {
            code: 500,
            msg: "无效的token",
            result: ''
          }, ctx)
        default:
          return ctx.app.emit('error', {
            code: 500,
            msg: "无效的token",
            result: ''
          }, ctx)
      }
    }
    await next()
  };

module.exports = {
    getOpenid,
    hasUserInfo,
    hasAdminUserInfo,
    jwtTokenCheck
}