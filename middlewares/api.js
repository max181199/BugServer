const fs = require('fs-extra')
const { resolve } = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer')
const moment = require('moment');

const currentDir = resolve(__dirname, '..');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let TmpDirPath = currentDir + '/upload/' + (req.cookies.login !== undefined ? req.cookies.login : (req.signedCookies.login !== undefined ? req.signedCookies.login : 'Default')) + '/';
    fs.mkdirsSync(TmpDirPath)
    cb(null, './upload/' + (req.cookies.login !== undefined ? req.cookies.login : (req.signedCookies.login !== undefined ? req.signedCookies.login : 'Default')) + '/')
  },
  filename: (req, file, cb) => {
    cb(null, moment().format('DD.MM.YYYY_HH:mm:ss:SSS') + '_' + file.originalname);
  }
})

const upload = multer({
  storage: storage,
}).fields([
  { name: 'email', maxCount: 1 },
  { name: 'text', maxCount: 1 },
  { name: 'photos', maxCount: 99 },
])

const transporter = nodemailer.createTransport({
  pool: true,
  maxConnections: 10,
  host: 'smtp.yandex.ru',
  port: 465,
  secure: true,
  auth: {
    user: 'TestMaxMailer@yandex.ru',
    pass: '123789456TMM'
  }
},
  {
    from: 'Users Bug <TestMaxMailer@yandex.ru>',
    subject: 'Another one bug...'
  }
)

const mailer = (message) => {
  transporter.sendMail(message, (err) => {
    if (err) { console.log('MAIL ERROR ::: ', err) }
  })
}


module.exports = function setup(app) {

  app.get('/api/mail', (req, res) => {
    console.log(req.signedCookies.login)
    res.send('I LIVE')
  })

  app.post('/api/mail', upload, (req, res) => {
    try {
      let message = {}
      let signature = '\n' + (req.cookies.login !== undefined ? req.cookies.login : (req.signedCookies.login !== undefined ? req.signedCookies.login : 'unknown'));
      if (req.files.photos !== undefined) {
        message = {
          to: req.body.email,
          text: req.body.text + signature,
          attachments: req.files.photos.map((el) => { return ({ name: el.originalname, path: el.path }) })
        }
      } else {
        message = {
          to: req.body.email,
          text: req.body.text + signature,
        }

      }
      mailer(message)
      res.send(JSON.stringify({
        state: 'ok'
      }))
    } catch (err) {
      console.log(err);
      res.send(JSON.stringify({
        state: 'error'
      }));
    }

  })


}