var UserNotification = require('../../models').UserNotification;
var Notification = require('../../models').Notification;
var Answer = require('../../models').Answer;
var Question = require('../../models').Question;
var Posts = require('../../models').Posts;
var User = require('../../models').User;

var async = require('async');

exports.fetch = function(req, res, next) {

  var user = req.user,
      ltCreateAt = req.body.lt_create_at,
      gtCreateAt = req.body.gt_create_at,
      perPage = req.body.per_page || 20,
      query = {},
      select = { __v: 0, addressee_id: 0, deleted: 0 },
      options = {}

  async.waterfall([

    function(callback) {

      query.addressee_id = user._id
      query.deleted = false

      if (ltCreateAt) {
        query.create_at = { '$lt': ltCreateAt }
      }

      if (gtCreateAt) {
        query.create_at = { '$gt': gtCreateAt }
      }

      options.limit = perPage

      options.sort = { create_at: -1 }

      options.populate = [
        { path: 'sender_id', select: { _id: 1, nickname: 1, avatar: 1, create_at: 1  } },
        { path: 'posts_id', match: { 'deleted': false }, select: { _id: 1, title: 1, content_html: 1, type: 1 } },
        { path: 'comment_id', match: { 'deleted': false }, select: { _id: 1, content_html: 1,  posts_id: 1, reply_id: 1, parent_id: 1 }  }
      ]

      UserNotification.find(query, select, options, function(err, notices){
        if (err) console.log(err)
        callback(null, notices)
      })

    },

    function(notices, callback) {

      var options = [
        {
          path: 'comment_id.posts_id',
          model: 'Posts',
          match: { 'deleted': false },
          select: { '_id': 1, 'title': 1, type: 1 }
        },
        {
          path: 'comment_id.parent_id',
          model: 'Comment',
          match: { 'deleted': false },
          select: { '_id': 1, 'content_html': 1 }
        },
        {
          path: 'comment_id.reply_id',
          model: 'Comment',
          match: { 'deleted': false },
          select: { '_id': 1, 'content_html': 1 }
        }
      ]

      Posts.populate(notices, options, function(err, notices){
        if (err) console.log(err)
        callback(null, notices)
      })

    },

    function(notices, callback) {
      // 删除一些，通知
      var _notices = JSON.stringify(notices);
      _notices = JSON.parse(_notices);

      _notices.map(function(item, key){
        if (typeof item.comment_id != 'undefined' && item.comment_id == null ||
          typeof item.posts_id != 'undefined' && item.posts_id == null
          ) {
          _notices.splice(key, 1);
          return
        }
      })

      // 未读的通知设置成已读
      for (var i = 0, max = notices.length; i < max; i++) {
        if (notices[i].has_read == false) {
          notices[i].has_read = true;
          notices[i].save();
        }
      }

      callback(null, _notices)

    }

  ], function(err, _notices){

    // var _notices = JSON.stringify(notices);
    // _notices = JSON.parse(_notices);

    _notices.map(function(item, key){

      if (item.comment_id) {

        var text = item.comment_id.content_html

        text = text.replace(/<[^>]+>/g,"");

        if (text.length > 100) {
          text = text.substring(0,100) + '...'
        }

        _notices[key].comment_id.content_trim = text
      }

      if (item.comment_id && item.comment_id.parent_id) {

        var text = item.comment_id.parent_id.content_html

        text = text.replace(/<[^>]+>/g,"");

        if (text.length > 100) {
          text = text.substring(0,100) + '...'
        }

        _notices[key].comment_id.parent_id.content_trim = text
      }

      if (item.comment_id && item.comment_id.reply_id) {

        var text = item.comment_id.reply_id.content_html

        text = text.replace(/<[^>]+>/g,"");

        if (text.length > 100) {
          text = text.substring(0,100) + '...'
        }

        _notices[key].comment_id.reply_id.content_trim = text
      }


      if (item.answer_id) {

        var text = item.answer_id.content_html

        text = text.replace(/<[^>]+>/g,"");

        if (text.length > 100) {
          text = text.substring(0,100) + '...'
        }

        _notices[key].answer_id.content_trim = text
      }

      if (item.comment_id && item.comment_id.answer_id) {

        var text = item.comment_id.answer_id.content_html

        text = text.replace(/<[^>]+>/g,"");

        if (text.length > 100) {
          text = text.substring(0,100) + '...'
        }

        _notices[key].comment_id.answer_id.content_html = text
      }
    })



    res.send({ success: true, data: _notices })

  })

  /*
  query.addressee_id = user._id
  query.deleted = false

  if (gtCreateAt) {
    query.create_at = { '$lt': gtCreateAt }
  }

  options.sort = { create_at: -1 }

  options.populate = [
    { path: 'sender_id', select: { _id: 1, nickname: 1, avatar: 1, create_at: 1  } },
    { path: 'question_id', select: { _id: 1, title: 1, content_html: 1 } },
    { path: 'answer_id', select: { _id: 1, content_html: 1, question_id: 1 } },
    { path: 'comment_id', select: { _id: 1, content: 1, answer_id: 1  }  }
  ]

  UserNotification.fetch(query, select, options, function(err, notices){

    if (err) console.log(err);

    var options = [
      {
        path: 'answer_id.question_id',
        model: 'Question',
        select: { '_id': 1, 'title': 1 }
      }
    ]

    Question.populate(notices, options, function(err, notices){

      var _notices = JSON.stringify(notices);
      _notices = JSON.parse(_notices);

      // 未读的通知设置成已读
      for (var i = 0, max = notices.length; i < max; i++) {
        if (notices[i].has_read == false) {
          notices[i].has_read = true;
          notices[i].save();
        }
      }

      res.send({
        success: true,
        data: _notices
      })

    })

  })
  */
}


exports.fetchUnreadCount = function(req, res) {
  var user = req.user

  async.waterfall([

    // 拉取通知
    function(callback) {

      var query = {
        addressee_id: user._id, deleted: false
      }

      if (user.find_notification_at) {
        query.create_at = { '$gt': user.find_notification_at }
      }

      Notification.find(query, {}, { sort:{ 'create_at': -1 } },
        function(err, notice){
          if (err) console.log(err);

          if (notice.length > 0) {

            User.update({ _id: user._id }, { find_notification_at: notice[0].create_at }, function(err, result){
              if (err) console.log(err);
            })

            notice.map(function(item){

              if (item.type == 'new-comment') {

                UserNotification.save({
                  sender_id: item.sender_id,
                  comment_id: item.target,
                  addressee_id: user._id,
                  create_at: item.create_at,
                  type: item.type
                }, function(err){
                  if (err) console.log(err)
                })

              }

            })

          }

          callback(null)
        })

    },
    function(callback){
      UserNotification.count({ addressee_id: user._id, has_read: false, deleted: false }, function(err, count){
        res.send({
          success: true,
          data: count
        })
      })
    }
  ], function(err, result){

  })

}

exports.add = function(data, callback) {

  UserNotification.findOne(data, {}, function(err, notice){

    if (err) console.log(err);

    if (notice) {
      UserNotification.update({ _id: notice._id }, { deleted: false }, function(err){
        if (err) console.log(err)
        callback()
      })
      return
    }

    // 添加通知
    UserNotification.save(data, function(err){
      if (err) console.log(err)
      callback()
    })

  })

}

exports.delete = function(query, callback) {

  UserNotification.findOne(query, {}, function(err, notice){

    if (notice) {
      UserNotification.update({ _id: notice._id }, { deleted: true }, function(err){
        if (err) console.log(err)
        callback()
      })
    } else {
      callback()
    }
  })
}
