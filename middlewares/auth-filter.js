module.exports = function setup(app) {
    app.use((req, res, next) => {
      console.log(req.originalUrl);
      if ((req.originalUrl.indexOf('/static/') != -1) || (req.originalUrl.indexOf('favicon.ico') != -1)) {
        console.log(req.originalUrl);
        next();
      } else {
        if (req.query.login) {
          const login = req.query.login.split('\\')[1] || req.query.login;
          res.cookie('login', login, {expires: new Date(Date.now() + 8 * 3600000)})
          res.append('Cache-Control', 'no-store')
  
          if (Object.keys(req.query).length == 1) {
            res.redirect(302, (req.baseUrl + req.path));
          } else {
            console.log(login);
            res.redirect(302, (req.originalUrl.replace(`login=${login}`, '')));
          }
        } else {
          if (req.cookies.login) {
            console.log(req.cookies.login);
            next();
          } else {
            res.redirect(302, `http://triada.consultant.ru/AuthRedirectService/?callback=${req.protocol}://${req.headers['last-host']+req.originalUrl}`);
          }
        }
      }
    });
  };
  