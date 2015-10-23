var dbjuggle = require('dbjuggle');
var router = require("express").Router(),
    tools  = require("../lib/tools"),
    path = require("path"),
    renderer = require('../lib/renderer'),
    models = require("../lib/models"),
    app    = require("../lib/app").getInstance(),
    Promise = require("bluebird"),
    multer = require("multer"),
    fs = require('fs'),
    convert = require('netpbm').convert;

models.use(Git);

var dbconn = null;

dbjuggle.opendatabase({
    type:   'mysql',
    host:   'localhost',
    dbname: 'astro',
    user:   'astro',
    pass:   'l3928Xks92Nqm20Keowi3293'  
}, function (err, _dbconn) {
    if (err) {
        console.log('A connection to the database could not be opened.');
        process.exit();
    }
    dbconn = _dbconn;
    dbconn.acquire();
}); 

function _getMaacs(req, res) {
    try {
        return __getMaacs(req, res);
    } catch (err) {
        console.log(err);
    }
}

function __getMaacs(req, res) {
    var urlbase;
    if (req.url.indexOf('?') > -1) {
        urlbase = req.url.substr(0, req.url.indexOf('?'));
    } else {
        urlbase = req.url;
    }
    console.log('req.url', req.url, urlbase);

    if (urlbase == '/maacs/interface') {
        if (!req.body) {
            console.log('no body on maacs interface');
            res.writeHead(404, 'text/plain');
            res.end('The interface was unable to understand your message.');
            return;
        }

        function reply(r) {
            res.writeHead(200, 'text/plain');
            res.end(JSON.stringify(r));
        }

        function error(msg) {
            res.writeHead(400, 'text/plain');
            res.end(msg);
        }

        function servererror(msg) {
            res.writeHead(500, 'text/plain');
            res.end(msg);
        }

        var params;
        if (!req.body || !req.body.params) {
            if (!req.query.op) {
                error('The interface requires the `op` parameter.');
                return;
            }
            params = req.query;
        } else {
            params = JSON.parse(req.body.params);
            if (!params.op) {
                error('The POST request did not have the `op` parameter.');
                return;
            }
        }
        
        console.log('params', params);

        switch (params.op) {
            case 'view.query':
                var t = dbconn.transaction();
                var filters = params.filters;
                t.add('SELECT views.*, COUNT(view_skyrefs.view_id) AS skyref_count FROM views JOIN view_skyrefs ON views.id = view_skyrefs.view_id GROUP BY views.id', [], 'r');
                t.execute(function (t) {
                    var r = t.results.r.rows;
                    if (!r) {
                    	servererror('A temporary error has happened. Code: 20SM2');
                    	return;
                    }
                    var views = [];
                    for (var x = 0; x < r.length; ++x) {
                        var rec = r[x];
                        console.log('rec', rec);
                        var _rec = {};
                        for (var k in rec) {
                        	_rec[k] = rec[k];
                        }
                        _rec['skyref_count'] = rec.skyref_count;
                        views.push(_rec);
                     }
                    reply({
                        views:   views,
                    });
                });
                break;
            case 'image.fetch':
                if (isNaN(parseInt(params.image_id)) || !params.type) {
                    error('The image_id or type parameter missing.');
                    return;
                }

                var t = dbconn.transaction();
                t.add('SELECT mime, uploaded, path FROM images WHERE id = ?', [parseInt(params.image_id)], 'r');
                t.execute(function (t) {
                    var r = t.results.r.rows[0];
                    if (!r) {
                        error('The image ID did not exit.');
                        return;
                    }
                    var mime = r.mime;
                    var path = r.path;
                    switch (params.type) {
                        case 'jpg':
                            var quality = parseInt(params.quality);
                            if (isNaN(parseInt(params.quality)) || quality < 0 || quality > 100) {
                                error('The jpeg quality was not a integer or was outside the range of 0 to 100.');
                                return;
                            }

                            var path_base = path.substr(path.lastIndexOf('/') + 1);

                            convert(
                                path + '.png', path + '.' + params.quality + '.jpg', 
                                {
                                    jpegQuality:    quality, 
                                },
                                function (err) {
                                    if (err) {
                                        error(err);
                                        return;
                                    }
                                    res.writeHead(200, 'image/jpeg');
                                    var rs = fs.createReadStream(path + '.' + params.quality + '.jpg');
                                    rs.on('error', function () {
                                        error('An error occured opening the data resource.');
                                    });
                                    rs.on('data', function (data) {
                                        res.write(data);
                                    });
                                    rs.on('end', function () {
                                        res.end();
                                    });
                                    return;
                                }
                            );
                            break;
                        case 'png':
                            break;
                    }
                });
                break;
            case 'view.pull':
                if (!params.view_id) {
                    reply({ success: false, message: 'There was not ID provided.' });
                    return;
                }

                var t = dbconn.transaction();
                t.add(
                    'SELECT *, UNIX_TIMESTAMP(datetaken) AS datetaken_unix FROM views WHERE id = ?',
                    [parseInt(params.view_id)],
                    'r'
                );
                t.execute(function (t) {
                    var view_row = t.results.r.rows[0];
                    if (!view_row) {
                        reply({ success: false, message: 'The ID did not exist.' });
                        return;
                    }

                    t = dbconn.transaction();
                    t.add(
                        'SELECT j2000_ra, j2000_dec, x, y, cat, id FROM view_skyrefs WHERE view_id = ?',
                        [parseInt(params.view_id)],
                        'r'
                    );
                    t.execute(function (t) {
                        var skyref_rows = t.results.r.rows;
                        var skyrefs = [];
                        for (var x = 0; x < skyref_rows.length; ++x) {
                            var skyref = skyref_rows[x];
                            skyrefs.push({
                                j2000_ra:       skyref.j2000_ra,
                                j2000_dec:      skyref.j2000_dec,
                                x:              skyref.x,
                                y:              skyref.y,
                                cat:            skyref.cat,
                                id:             skyref.id
                            });
                        }
								
								var rp = {};
								
								for (var k in view_row) {
									rp[k] = view_row[k];
								}                      
								
								rp.skyrefs = skyrefs;								
								
								rp.success = true;  
                        
                        reply(rp);
                    });
                });
                break;  
            case 'view.push':
                if (req.file) {
                    fs.rename(req.file.path, req.file.path + '.png');
                }

                //fs.readFile(req.file.path, function (err, imgdata) {
                        //console.log('got file read into memory');
                        var t = dbconn.transaction();
                        if (req.file) {
                            t.add(
                                'INSERT INTO images (path, mime, uploaded) VALUES (?, ?, NOW())',
                                [req.file.path, req.file.mimetype]
                            );
                            t.add('SELECT LAST_INSERT_ID() AS image_id', [], 'image_id');
                        }
                        t.execute(function (t) {
                            var image_id;
                            if (t.results.image_id && t.results.image_id.rows[0]) {
                                params.image_id = t.results.image_id.rows[0].image_id;
                            }

                            var t = dbconn.transaction();

									  var fields = [];
									  var vholders = [];
									  var values = [];
									  var updt = [];
									  
									  var view_id;
										
									  if (params.view_id == null || params.view_id == undefined) {
									  		view_id = null;
									  } else {
									  		view_id = params.view_id;
									  }
									  
									  delete params.view_id;
									  
									  for (var k in params) {
									  		if (k == 'op' || k == 'skyrefs') {
									  			continue;
									  		}
									  												  		
									  		fields.push(k);
									  		
									  		if (k == 'datetaken') {
									  			vholders.push('FROM_UNIXTIME(?)');
									  		} else {
									  			vholders.push('?');
									 		}
									 		
									 		values.push(params[k]);
									 		
									 		if (k == 'datetaken') {
									 			updt.push(k + ' = FROM_UNIXTIME(?)');
									 		} else {
									 			updt.push(k + ' = ' + '?');
									 		}
									  }                                                        
                            
                            if (view_id == null) {
                                /* create new view */
										  
										  var sqlstmt = 'INSERT INTO views (' + fields.join(',') + ') VALUES (' + vholders.join(',') + ')';
										  t.add(sqlstmt, values, 'r');
                                
                                t.add('SELECT LAST_INSERT_ID() AS view_id', [], 'id');
                                t.execute(function (t) {
                                    var view_id = t.results.id.rows[0].view_id;
                                    var t = dbconn.transaction();
                                    for (var x = 0; x < params.skyrefs.length; ++x) {
                                        var skyref = params.skyrefs[x];
                                        t.add(
                                            'INSERT INTO view_skyrefs (view_id, j2000_ra, j2000_dec, x, y, cat, id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                            [view_id, parseFloat(skyref.j2000_ra), parseFloat(skyref.j2000_de), parseFloat(skyref.x), parseFloat(skyref.y), parseFloat(skyref.cat), skyref.id]
                                        );
                                    }
                                    t.execute(function (t) {
                                        console.log('inserted view and sky refs');
                                        reply({ success: true, view_id: view_id });
                                    });
                                    console.log('inserting sky refs');
                                });
                                console.log('inserting new view');
                            } else {
                                console.log('inserting existing view');
                                
                                values.push(view_id);

										  var sqlstmt = 'UPDATE views SET ' + updt.join(', ') + ' WHERE id = ? '
										  t.add(sqlstmt, values, 'r');
                                
                                t.execute(function (t) {
                                    var  t = dbconn.transaction();
                                    t.add('DELETE FROM view_skyrefs WHERE view_id = ?', [params.view_id]);
                                    for (var x = 0; x < params.skyrefs.length; ++x) {
                                        var skyref = params.skyrefs[x];
                                        t.add(
                                            'INSERT INTO view_skyrefs (view_id, j2000_ra, j2000_dec, x, y, cat, id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                            [view_id, parseFloat(skyref.j2000_ra), parseFloat(skyref.j2000_de), parseFloat(skyref.x), parseFloat(skyref.y), parseFloat(skyref.cat), skyref.id]
                                        );
                                    }
                                    t.execute(function (t) {
                                        console.log('inserted view and sky refs');
                                        reply({ success: true, view_id: view_id });
                                    });
                                    
                                });
                            }
                            console.log('inserting view');
                        });
                        console.log('read image from disk from http post');
                //});
                break;  
            case 'constants.del':
            	var category = params.category;
            	var id = params.id;
            	var t = dbconn.transaction();
            	t.add('UPDATE ?? SET deleted = 1 WHERE id = ?', ['constants_' + category, id]);
            	t.execute(function (t) {
            		reply({ success: true });
            	});
            	break;
            case 'constants.add':
            	var category = params.category;
            	var desc = params.description;
            	var t = dbconn.transaction();
            	t.add('INSERT INTO ?? (description, deleted) VALUES (?, 0)', ['constants_' + category, desc]);
            	t.execute(function (t) {
            		reply({ success: true });
            	});
            	break;
            case 'constants.fetch':
					 var category = params.category;
                var t = dbconn.transaction();
                t.add('SELECT id, description FROM ?? WHERE deleted = 0', ['constants_' + category], 'r');
                t.execute(function (t) {
                    var rows = t.results.r.rows;
                    var out = {};
                    if (rows) {
                    		for (var x = 0; x < rows.length; ++x) {
                    			out[rows[x].id] = rows[x].description;
                    		}
                    	}
                    reply(out);
                });
                break;
            case 'views.get':
                var t = dbconn.transaction();
                t.add(
                    'SELECT id, telescope, camera, datetaken, datesource, image_id, image_location FROM views',
                    [],
                    'r'
                );
                t.execute(function (t) {
                    var r = t.results.r.rows;

                    for (var x = 0; x < r.length; ++x) {    
                    }
                });
                reply({});
                break;
        }
        return;
    }

    var path;
    var raw;
    var mime;

    console.log('urlbase', urlbase);

    if (urlbase == '/maacs' || urlbase == '/maacs/') {
        path = './jingo/maacs/main.html';
        raw = false;
    } else {
        var ext = req.url.substr(req.url.lastIndexOf('.') + 1);
        switch (ext) {
            case 'js': mime = 'text/javascript'; break;
        }
        path = './jingo' + req.url;
        raw = true;
    }

    var s = fs.createReadStream(path);
    var buf = [];

    s.on('data', function (chunk) {
        buf.push(chunk);
    });

    s.on('error', function (err) {
        if (raw) {
            res.writeHead(404, mime);
            res.end('The resource did not exist');
            return;
        }
        res.render('maacs', {
            page: { wikiname: 'MAACS' },
            title: 'MAACS Interface',
            content:        'Opps.. There was a server side error. Please report this error.. ' + err
        });
    });
    
    s.on('end', function () {
        //if (raw) {
            res.writeHead(200, mime);
            res.end(buf.join(''));
            return;
        //} 
        //res.render('maacs', {
        //    page: {
        //        wikiname: 'MAACS'
        //    },
        //    title:          'MAACS Interface',
        //    content:        buf.join('')
        //}); 
    });
}

var upload = multer({ dest: app.locals.config.get("application").repository + '/catimages/' });

router.get('/maacs', _getMaacs);
router.get('/maacs/*', _getMaacs);
router.post('/maacs/*', upload.single('imgdata'), _getMaacs);
//router.post('/maacs/*', _getMaacs);

module.exports = router;
