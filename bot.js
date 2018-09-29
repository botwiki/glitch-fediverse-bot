var fs = require('fs'),
    crypto = require('crypto'),
    url = require('url'),
    util = require('util'),
    moment = require('moment'),
    db = require(__dirname + '/helpers/db.js'),
    keys = require(__dirname + '/helpers/keys.js'),
    request = require('request'),
    crypto = require('crypto'),
    public_key_path = '.data/rsa/pubKey',
    private_key_path = '.data/rsa/privKey',
    bot_url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;

if (!fs.existsSync(public_key_path) || !fs.existsSync(private_key_path)) {
  keys.generate_keys(function(){
    process.kill(process.pid);
  });
}
else{
  var public_key = fs.readFileSync(public_key_path, 'utf8'),
      private_key = fs.readFileSync(private_key_path, 'utf8'); 

  module.exports = {
    bot_url: bot_url,
     links: [
        // {
        //   rel: 'http://webfinger.net/rel/profile-page',
        //   type: 'text/html',
        //   href: `${bot_url}`
        // },
        // {
        //   rel: 'http://schemas.google.com/g/2010#updates-from',
        //   type: 'application/atom+xml',
        //   href: `${bot_url}/feed`
        // },
        {
          rel: 'self',
          type: 'application/activity+json',
          href: `${bot_url}/bot`
        },
        // {
        //   rel: 'hub',
        //   href: `${bot_url}/pubsub`
        // },
        // {
        //   rel: 'salmon',
        //   href: `${bot_url}/salmon`
        // },
        // {
        //   rel: 'magic-public-key',
        //   href: `data:application/magic-public-key,RSA.${public_key.replace('-----BEGIN PUBLIC KEY-----\n', '').replace('\n-----END PUBLIC KEY-----', '').replace('\\n', '')}`
        // }      
      ],      
    info: {
      '@context': [
          'https://www.w3.org/ns/activitystreams',
          'https://w3id.org/security/v1'
      ],
      'id': `${bot_url}/bot`,
      'icon': [{
          'url': process.env.BOT_AVATAR_URL,
          'type': 'Image'
        }],
      'image': [{
          'url': process.env.BOT_AVATAR_URL,
          'type': 'Image'
        }],
      'type': 'Person',
      'name': process.env.BOT_USERNAME,
      'preferredUsername': process.env.BOT_USERNAME,
      'inbox': `${bot_url}/inbox`,
      'publicKey': {
          'id': `${bot_url}/bot#main-key`,
          'owner': `${bot_url}/bot`,
          'publicKeyPem': public_key
      }
    },
    create_post: function(options, cb){
      var bot = this;

      if (!options.content || options.content.trim().length === 0 ){
        console.log('error: missing post content')
        return false;
      }

      var type = options.type || 'Note',
          post_date = moment().format(),
          post_in_reply_to = options.in_reply_to || null,
          post_content = options.content || '';

      db.save_post({
        type: type,
        content: post_content
      }, function(err, data){
        var post_id = data.lastID;
        var obj = {
          '@context': 'https://www.w3.org/ns/activitystreams',
          'id': `${bot_url}/post/${post_id}`,
          'type': 'Create',
          'actor': `${bot_url}/bot`,

          'object': {
            'id': `${bot_url}/post/${post_id}`,
            'type': type,
            'published': post_date,
            'attributedTo': `${bot_url}/bot`,
            // 'inReplyTo': post_in_reply_to,
            'content': post_content,
            'to': 'https://www.w3.org/ns/activitystreams#Public'
          }
        }
        if (cb){
          cb(null, obj);
        }
      });
    },
    accept: function(payload, cb){
        var bot = this,
            guid = crypto.randomBytes(16).toString('hex');

        bot.sign_and_send({
          follower: {
            url: payload.actor
          },
          message: {
            '@context': 'https://www.w3.org/ns/activitystreams',
            'id': `${bot.bot_url}/${guid}`,
            'type': 'Accept',
            'actor': `${bot.bot_url}/bot`,
            'object': payload,
          }
        }, function(err, data){
            if (cb){
                cb(err, payload, data);
            }
        });
    },
    sign_and_send: function(options, cb){
      var bot = this;
      // console.log('message to sign:');
      // console.log(util.inspect(options.message, false, null, true));
      
      options.follower.url = options.follower.url.replace('http://localhost:3000', 'https://befc66af.ngrok.io');

      if (options.follower.url && options.follower.url !== 'undefined'){
        options.follower.domain = url.parse(options.follower.url).hostname;

        var signer = crypto.createSign('sha256'),
            d = new Date(),
            string_to_sign = `(request-target): post /inbox\nhost: ${options.follower.domain}\ndate: ${d.toUTCString()}`;

        signer.update(string_to_sign);
        signer.end();
        
        var signature = signer.sign(private_key);
        var signature_b64 = signature.toString('base64');
        var header = `keyId="${bot_url}/bot",headers="(request-target) host date",signature="${signature_b64}"`;
      
        var req_object = {
          url: `https://${options.follower.domain}/inbox`,
          headers: {
            'Host': options.follower.domain,
            'Date': d.toUTCString(),
            'Signature': header
          },
          method: 'POST',
          json: true,
          body: options.message
        };
        
        // console.log('request object:');
        // console.log(util.inspect(req_object, false, null, true));        

        request(req_object, function (error, response){
          console.log(`sent message to ${options.follower.url}...`);
          if (error) {
            console.log('error:', error, response);
          }
          else {
            console.log('response:', response.statusCode, response.statusMessage);
            // console.log(response);
          }
          
          if (cb){
            cb(error, response);
          }
        });
      }
    }
  };
}