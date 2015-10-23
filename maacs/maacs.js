/*
    McGuire Amatuer Astronomical Catalog System
*/
//var fs = require('fs');

var maacs = {
	util: {},
};

function Maacs(dbsource, cb) {
    var self = this;
    switch (dbsource.type) {
        case 'json':
            this.data = null;
            this.load_datasource_json(dbsource.path, function () {
                cb(self);
            });
            break;
        default:
            throw new Error('The data source type not supported.');
    }
    return true;
}

Maacs.prototype.load_datasource_json = function (jsonpath, cb) {
    var self = this;
    fs.readFile(jsonpath, 'utf8', function (err, data) {
        if (err) {
            throw new Error('Could not open JSON source.');
        }
        self.data = JSON.parse(data);
        cb();
    });     
};

Maacs.prototype.get_image_list = function () {
    var out = [];
    for (var imageid in this.data) {
        out.push(imageid);
    }
    return out;
};

Maacs.prototype.cat_to_cat = function (from_cat, from_id, to_cat) {
        
};

function Vec2(x, y) {
    this.x = x;
    this.y = y;
}

Vec2.prototype.unit = function () {
    var l = Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    return new Vec2(this.x / l, this.y / l);
};

Vec2.prototype.add = function (a) {
	return new Vec2(this.x + a.x, this.y + a.y);
};

Vec2.prototype.sub = function (a) {
    return new Vec2(this.x - a.x, this.y - a.y);
};

Vec2.prototype.scalar_mul = function (s) {
    return new Vec2(this.x * s, this.y * s);
};

Vec2.prototype.atan2 = function () {
    return Math.atan2(this.y, this.x);
};

Vec2.prototype.atan2_half = function () {
    var r = this.atan2();
    if (r < 0.0) {
        return Math.PI + r;
    }
    return r;
};

Vec2.prototype.mag = function () {
    return Math.sqrt(this.x * this.x + this.y * this.y);
};

Vec2.prototype.abs = function () {
    return new Vec2(Math.abs(this.x), Math.abs(this.y));
};

Vec2.prototype.rotate = function (theta) {
    var cos = Math.cos(theta);
    var sin = Math.sin(theta);

    return new Vec2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
};

Maacs.prototype.get_image_coordinates_radec = function (imageid) {
};

maacs.util.compute_pp = function (skyrefs, realign) {
   // (1) rotate refs by angle then use new pixel (x,y) to compute RA and DEC per X and Y
   
   var rot_refs = [];
   for (var q = 0; q < skyrefs.length; ++q) {
       var sref = skyrefs[q];
       var n = new Vec2(sref.x, sref.y);
       rot_refs.push({ p: n.rotate(realign.angle), e: new Vec2(sref['j2000_ra'], sref['j2000_de']) });
   }
   
   var pp = [];
   
   for (var q0 = 0; q0 < rot_refs.length; ++q0) {
       for (var q1 = q0 + 1; q1 < rot_refs.length; ++q1) {
           var r0 = rot_refs[q0];
           var r1 = rot_refs[q1];
           var pdiff = r1.p.sub(r0.p).abs();
           var ediff = r1.e.sub(r0.e).abs();
           if (pdiff.mag() == 0.0 || ediff.mag() == 0.0) {
               continue;
           }
           // How many degrees per pixel.
           var tmp = new Vec2(ediff.x / pdiff.x, ediff.y / pdiff.y);
           pp.push([tmp, q0, q1]);
       }
   }

   var ppa = new Vec2(0, 0);

   var error_ra = 0;
   var error_de = 0;

	var error_per = [];

	for (var i = 0; i < rot_refs.length; ++i) {
		error_per.push([]);
	}	
	
	for (var i = 0; i < pp.length; ++i) {
		error_per[pp[i][1]].push(pp[i][0]);
		error_per[pp[i][2]].push(pp[i][0]);
	}
	
	for (var i = 0; i < error_per.length; ++i) {
		console.log('@@', i, error_per[i]);
	}
	
	for (var i = 0; i < error_per.length; ++i) {
		var err_x = 0, err_y = 0, err_c = 0;	
		for (var w0 = 0; w0 < error_per[i].length; ++w0) {
			for (var w1 = w0 + 1; w1 < error_per[i].length; ++w1) {
				err_x += Math.abs(error_per[i][w0].x - error_per[i][w1].x);
				err_y += Math.abs(error_per[i][w0].y - error_per[i][w1].y);
				++err_c;
			}
		}
		error_per[i] = new Vec2(err_x / err_c, err_y / err_c);
	}

	for (var q0 = 0; q0 < pp.length; ++q0) {
		for (var q1 = 0; q1 < pp.length; ++q1) {
			error_ra += Math.abs(pp[q0][0].x - pp[q1][0].x);
			error_de += Math.abs(pp[q0][0].y - pp[q1][0].y);
		}
	}   
   
   // Find average of equatorial coord per pixel coord.
   for (var q = 0; q < pp.length; ++q) {
       ppa.x += pp[q][0].x;
       ppa.y += pp[q][0].y;
   }
   
   ppa.x /= pp.length;
   ppa.y /= pp.length;
   
   return {
   	error:           Math.sqrt(Math.pow(error_ra, 2) + Math.pow(error_de, 2)), 
   	error_per:       error_per,
   	error_ra:        error_ra,
   	error_de:        error_de,
		pp:              pp,   	
   	pixels_per_ra:   ppa.x,
   	pixels_per_dec:  ppa.y,
   };
};

maacs.util.parse_radec = function (v) {
	function isnum(c) {
		switch (c) {
			case '0': case '1': case '2': case '3': case '4': case '5': case '6':
			case '7': case '8': case '9': case '.': return true;
		}
		return false;
	}

	var anum = true;
	for (var x = 0; x < v.length; ++x) {
		if (!isnum(v[x])) {
			anum = false;
			break;
		}
	}
	
	if (anum) {
		return {
			result: parseFloat(v),
			error: null,
		};
	}
	
	var buf = [];
	var components = [];
	
	var h = v.indexOf('h');
	var d = v.indexOf('d');
	var m = v.indexOf('m');
	var s = v.indexOf('s');
	
	if (h > -1 && d > -1) {
		return { result: null, error: 'found `h` and `d` in string' };
	}	
	
	if (h < 0 && d < 0) {
		return { result: null, error: 'expected `h` or `d` to designate hours or degrees' };
	}
	
	if (m < 0 || s < 0) {
		return { result: null, error: 'missing `m` and/or `s` for minutes and seconds' };
	}

	if (d > -1) {
		h = d;
	}
	
	var _h = parseFloat(v.substr(0, h));
	var _m = parseFloat(v.substr(h + 1, m));
	var _s = parseFloat(v.substr(m + 1, s));
	
	if (isNaN(_h) || isNaN(_m) || isNaN(_s)) {
		return { result: null, error: 'some component was not a number' };
	}
	
	if (d > - 1) {
		// The _h should already be in degrees. For example declination 
		// should not be using hours unless it desires to be treated as
		// such a measurement (below).		
	} else {
		_h = _h / 24 * 360;
	}
		
	return { 
		result: _h + 15 * (1 / 60) * _m + 15 * (1 / 60) * (1 / 60) * _s, 
		error: null 
	};
};

/*
	@original: view-source:http://www.robertmartinayers.org/tools/coordinates.html
	@original-author:
	@original-notes: rewrote in self contained manner 
*/
maacs.util.transform_j2000_useryear = function (j2000_ra, j2000_dec, useryear) {
	/*
  		var JtoUser = Supplement (useryear, 2000.0); 
  		var uradec = Transform (xradec, JtoUser);
	*/
	
	// In arcseconds.
	// globalJRA
	// globalJDec

	var toDegrees = 180 / Math.PI;	
	
	var xradec = [
		j2000_ra / toDegrees,
		j2000_dec / toDegrees,
	];
	
	function Transform (radec, matrix) {
		var r0 = [
			Math.cos(radec[0]) * Math.cos(radec[1]),
			Math.sin(radec[0]) * Math.cos(radec[1]),
			Math.sin(radec[1])
		];
		
		var s0 = [
			r0[0] * matrix[0] + r0[1] * matrix[1] + r0[2] * matrix[2],
			r0[0] * matrix[3] + r0[1] * matrix[4] + r0[2] * matrix[5],
			r0[0] * matrix[6] + r0[1] * matrix[7] + r0[2] * matrix[8]
		];
		
		var r = Math.sqrt(s0[0] * s0[0] + s0[1] * s0[1] + s0[2] * s0[2]);
		var result = [0, 0];

		result[1] = Math.asin(s0[2] / r);

		var cosaa = ((s0[0] / r) / Math.cos(result[1]));
		var sinaa = ((s0[1] / r) / Math.cos(result[1]));

		result[0] = Math.atan2(sinaa, cosaa);
		
		if (result[0] < 0.0) {
			result[0] = result[0] + pi + pi;
		}
		return result;
	}
	
	function MakeMatrixSupplement (a, b, c) {
		var m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
		var cA = Math.cos(a), sA = Math.sin(a);
		var cB = Math.cos(b), sB = Math.sin(b);
		var cC = Math.cos(c), sC = Math.sin(c);
		
		m[0] = cA * cB * cC - sA * sC;
		m[3] = -cA * cB * sC - sA * cC;
		m[6] = -cA * sB;
		
		m[1] = sA * cB * cC + cA * sC;
		m[4] = -sA * cB * sC + cA * cC;
		m[7] = -sA * sB;
		
		m[2] = sB * cC;
		m[5] = -sB * sC;
		m[8] = cB;
		
		return m;
	}

	// useryear is actually a floating point number
	//
	fixed = useryear;
	var date = 2000;
	
	// Supplement(useryear:fixed:juliandays, date:2000)
	var T = (fixed - 2000) / 100;
	var t = (date - fixed) / 100;
	var asec = (2306.218 + 1.397 * T) * t + 1.095 * t * t;
	var bsec = (2004.311 - 0.853 * T) * t - 0.427 * t * t;
	var csec = (2306.218 + 1.397 * T) * t + 0.302 * t * t;
	var SecondsPerRadian = (180 / Math.PI) * 3600;
	var JtoUser = MakeMatrixSupplement(
		asec / SecondsPerRadian,
		bsec / SecondsPerRadian,
		csec / SecondsPerRadian
	);
	// m:JtoUser is output
	
	var uradec = Transform (xradec, JtoUser);

	function RadiansPrintD (rad) {
		var sign = 1.0;		
		if (rad < 0.0) {
			sign = -1;
			rad = 0 - rad;
		}
		
		var hh = rad * toDegrees;
		hh += 0.00005;
		var h = Math.floor(hh);
		hh -= h;
		hh = hh * 10;
		var f1 = Math.floor(hh);
		hh -= f1;
		hh *= 10;
		var f2 = Math.floor(hh);
		hh -= f2;
		hh *= 10;
		var f3 = Math.floor(hh);
		hh -= f3;
		hh *= 10;
		var f4 = Math.floor(hh);
		ret = sign * parseFloat(h + '.' + f1 + f2 + f3 + f4);
		return ret;
	}
	
	return [RadiansPrintD(uradec[0]), RadiansPrintD(uradec[1])];	
};

/*
    @release-candidate
    @web
*/
maacs.util.compute_radec_alignment = function (skyrefs) {
    // RA inclusive 00:00 exclusive 24:00:00
    // DEC inclusive 90 NORTH STAR inclusive -90
    var convs = [];
    
    console.log('skyrefs', skyrefs);

    // Try to get the image coordinates via any "sky-ref" sections.
    for (var x = 0; x < skyrefs.length; ++x) {
        // cat, id, x, y, j2000-ra, j2000-de, dist
        var asr = skyrefs[x];
        for (var y = x + 1; y < skyrefs.length; ++y) {
            var bsr = skyrefs[y];
            //for (var z = y + 1; z < skyrefs.length; ++z) {
            //    var csr = skyrefs[z];

                var ea = new Vec2(asr['j2000_ra'], asr['j2000_de']);
                var eb = new Vec2(bsr['j2000_ra'], bsr['j2000_de']);
                //var ec = new Vec2(csr['j2000_ra'], csr['j2000_de']);

                var pa = new Vec2(asr.x, asr.y);
                var pb = new Vec2(bsr.x, bsr.y);
                //var pc = new Vec2(csr.x, csr.y);

                var radec_vec = eb.sub(ea);
                //var radec_A_vec_C = ec.sub(ea);
                var pixel_vec = pb.sub(pa);
                //var pixel_A_vec_C = pc.sub(pa);
                //var radec_B_vec_A = ea.sub(eb);
                //var pixel_B_vec_A = pa.sub(pb);

					 /*
                var delta_dec_x_a_b = radec_A_vec_B.x / pixel_A_vec_B.x;
                var delta_ra_y_a_b = radec_A_vec_B.y / pixel_A_vec_B.y;
                var delta_dec_x_a_c = radec_A_vec_C.x / pixel_A_vec_C.x;
                var delta_ra_y_a_c = radec_A_vec_C.y / pixel_A_vec_C.y;

                var dec_point_a = radec_A_vec_B.unit().scalar_mul(delta_dec_x_a_b);
                var dec_point_b = radec_A_vec_C.unit().scalar_mul(delta_dec_x_a_c);
                var dec_vec = dec_point_a.sub(dec_point_b);

                var ra_point_a = radec_A_vec_B.unit().scalar_mul(delta_ra_y_a_b);
                var ra_point_b = radec_A_vec_C.unit().scalar_mul(delta_ra_y_a_c);
                var ra_vec = ra_point_a.sub(ra_point_b);

                convs.push(['RADEC_REALIGN', ra_vec.atan2_half(), dec_vec.atan2_half()]);
                */
                
                convs.push([
                	'RADEC_REALIGN', 
                	 Math.atan2(pixel_vec.y, pixel_vec.x) - Math.atan2(radec_vec.y, radec_vec.x)
                ]);
            //}       
        }
    }
    // Try to get the image coordinates via any "dist-length-ref" sections.
    //for (var x = 0; x < imm['dist-length-ref'].length; ++x) {
    //    var dlr = imm['dist-length-ref'][x];
    //    // length, dist, x0, y0, x1, y1
    //}
    //
 

    if (convs.length < 1) {
        return null;
    }

    var d_ra_a = 0; // average sum
    var d_de_a = 0; // average sum
    var total_error_ra = 0;
    var total_error_de = 0;
    var error_per = [];

    for (var x = 0; x < convs.length; ++x) {
    	  error_per.push([0, 0]);
        for (var y = x + 1; y < convs.length; ++y) {
            var era = Math.abs(convs[x][1] - convs[y][1]);
            //var ede = Math.abs(convs[x][2] - convs[y][2]);
            total_error_ra += era;
            //total_error_de += ede;
            error_per[x][0] += era;
            //error_per[x][1] += ede;
        }
    }

    var total_error = total_error_ra + total_error_de;

    for (var x = 0; x < convs.length; ++x) {
        var conv = convs[x];
        var d_ra = conv[1];
        //var d_de = conv[2];

        d_ra_a += d_ra;
        //d_de_a += d_de;
    }

    d_ra_a /= convs.length;
    //d_de_a /= convs.length;
    //d_a = Math.PI - (d_ra_a + (d_d_a + Math.PI * 0.5)) / 2;
    
    return {
        'angle':     d_ra_a,
        'error':     total_error,
        'error-ra':  total_error_ra,
        //'error-dec': total_error_de,
        //'angle-de':  d_de_a,
        'convs':     convs,
        'error_per': error_per,
    };
}

function View(state, data) {
    this.data = data;
    this.state = state;
    this.data.level = [];
}

View.prototype.setdata = function (level, k, data) {
    this.data.level[level] = this.data.level[level] || {};
    this.data.level[level][k] = data;
    this.data.level.splice(level + 1, this.data.level.length - level - 1);
};

View.prototype.getdata = function (level, k) {
    return this.data.level[level][k];
};

Maacs.prototype.for_each_view = function (cb, ecb) {
    for (var k in this.data) {
        cb(k, new View(this, this.data[k]));
    }
    ecb();
};

Maacs.prototype.get_view_count = function () {
};

function read_image(path, cb) {
    var PNG = require('node-png').PNG;

    fs.createReadStream(path)
        .pipe(new PNG({
            filterType:  4
        }))
        .on('parsed', function () {
            cb(null, this.width, this.height, this.data, PNG);
        });
}

Maacs.prototype.render_sky_all = function (rparams, cb) {
    var png = require('node-png').PNG;
    var ow = 1024 * 3;
    var oh = 1024 * 3;
    var fetched = {};
    var fetched_count = 0;
    var fetch_queue_count = 0;

    var ibuf = new Float32Array(ow * oh * 3);
    var abuf = new Uint8Array(ow * oh);

    var out = new png({
        width:       ow,
        height:      oh,
        filterType:  -1
    });

    var self = this;

    var __m = 0;

    function plot_ra_dec(ra, de, r, g, b) {
        if (de < 0.0) {
            if (de < __m) {
                __m = de;
                //console.log(de);
            }
        }
        var theta = (ra / 360) * Math.PI * 2.0;
        var dist;
        if (de > 90) {
            return;
        } else if (de < -90) {
            dist = -((180 - (Math.abs(de) - 90)) / 180);
        } else {
            de += 90;
            dist = (180 - de) / 180;
        }
        dist = dist * ow * 0.5;
        var x = Math.floor(Math.sin(theta) * dist + ow * 0.5);
        var y = Math.floor(Math.cos(theta) * dist + oh * 0.5);
        var i = (x + y * ow);
        if (r < rparams.red_low_threshold && g < rparams.green_low_threshold && b < rparams.blue_low_threshold) {
            return;
        }
        switch (rparams.immedblendmode) {
            case 'replace-brightest':
                ibuf[i*3+0] = ibuf[i*3+0] > r ? ibuf[i*3+0] : r;
                ibuf[i*3+1] = ibuf[i*3+1] > g ? ibuf[i*3+1] : g;
                ibuf[i*3+2] = ibuf[i*3+2] > b ? ibuf[i*3+2] : b;
                abuf[i] = 0xff;
                break;
            case 'replace':
                ibuf[i*3+0] = r;
                ibuf[i*3+1] = g;
                ibuf[i*3+2] = b;
                abuf[i] = 0xff;
                break;
            case 'add':
                ibuf[i*3+0] += r;
                ibuf[i*3+1] += g;
                ibuf[i*3+2] += b;
                abuf[i] = 0xff;
                break;

        }
        //out.data[i+0] = (out.data[i+0] + r) / 2;
        //out.data[i+1] = (out.data[i+1] + g) / 2;
        //out.data[i+2] = (out.data[i+2] + b) / 2;
        //out.data[i+3] = 0xff;
        //console.log('plot', x, y);
    }

    for (var i in this.data) {
        var view = this.data[i];
        /*
            Draw the image data into the pixel buffer.
        */
        if (view.image.id.substr(view.image.id.length - 3) != 'png') {
            continue;
        }
        console.log('getting image data for', view.image.id);
        read_image('/home/kmcguire/astro-site/data/catimages/' + view.image.id, function (i) { return function (err, w, h, pixels) {
            fetched_count++;
            fetched[i] = pixels;

            console.log('got image data for', i);

            var view = self.data[i];

            if (!view.level[0]) {
                return;
            }

            var realign = view.level[0].realign;

            if (!realign) {
                return;
            }

            // realign.angle = ((Math.PI * 2) / 360) * 4;
            realign.angle = -realign.angle;
            // realign.angle..
            // (1) rotate refs by angle then use new pixel (x,y) to compute RA and DEC per X and Y
            
            var rot_refs = [];
            for (var q = 0; q < view['sky-refs'].length; ++q) {
                var sref = view['sky-refs'][q];
                var n = new Vec2(sref.x, sref.y);
                rot_refs.push({ p: n.rotate(realign.angle), e: new Vec2(sref['j2000.ra'], sref['j2000.de']) });
            }

            var pp = [];
            for (var q0 = 0; q0 < rot_refs.length; ++q0) {
                for (var q1 = q0 + 1; q1 < rot_refs.length; ++q1) {
                    var r0 = rot_refs[q0];
                    var r1 = rot_refs[q1];
                    var pdiff = r1.p.sub(r0.p).abs();
                    var ediff = r1.e.sub(r0.e).abs();
                    if (pdiff.mag() == 0.0 || ediff.mag() == 0.0) {
                        continue;
                    }
                    pp.push(new Vec2(ediff.x / pdiff.x, ediff.y / pdiff.y));
                }
            }

            var ppa = new Vec2(0, 0);
            // Find average of equatorial coord per pixel coord.
            for (var q = 0; q < pp.length; ++q) {
                console.log(pp[q]);
                ppa.x += pp[q].x;
                ppa.y += pp[q].y;
            }
            ppa.x /= pp.length;
            ppa.y /= pp.length;

            console.log(ppa);
            console.log('realign.angle', realign.angle);
            //process.exit();

            console.log('ppa', ppa);

            // debugging
            ppa.x = 0.02082056;
            ppa.y = 0.01317696;

            var ref_x = view['sky-refs'][0].x;
            var ref_y = view['sky-refs'][0].y;
            var ref_ra = view['sky-refs'][0]['j2000.ra'];
            var ref_de = view['sky-refs'][0]['j2000.de'];

            for (var y = 0; y < h; ++y) {
                for (var x = 0; x < w; ++x) {
                    var pndx = (x + y * w) * 4;
                    var r = pixels[pndx + 0];
                    var g = pixels[pndx + 1];
                    var b = pixels[pndx + 2];
                    var a = pixels[pndx + 3];
                    // Skip anything with zero alpha.
                    if (a == 0) {
                        continue;
                    }

                    // Turn pixel into RA and DEC using REALIGN data.
                    // (1) rotate pixel around pixel with known RA and DEC thus
                    //     the pixel becomes oriented in respect to the equatorial
                    //     system plane
                    // (2) take determination of RA and DEC degrees per unit
                    var n = new Vec2(x - ref_x, (h - y - 1) - ref_y);
                    n = n.rotate(realign.angle);
                    plot_ra_dec(n.x * ppa.x + ref_ra, n.y * ppa.y + ref_de, r, g, b);
                }
            }   

            if (fetched_count == fetch_queue_count) {
                console.log('translating float buffer into image pixel buffer');

                for (var x = 0; x < ow * oh; ++x) {
                    var ii = x << 2;
                    switch (rparams.finalblendmode) {
                        case "pixel-vector-normalize":
                            var l = Math.sqrt(Math.pow(ibuf[x*3+0], 2) + Math.pow(ibuf[x*3+1], 2) + Math.pow(ibuf[x*3+2], 2));
                            out.data[ii+0] = (ibuf[x*3+0] / l) * 255;
                            out.data[ii+1] = (ibuf[x*3+1] / l) * 255;
                            out.data[ii+2] = (ibuf[x*3+2] / l) * 255;
                            out.data[ii+3] = abuf[x];
                            break;
                        case 'color-channel-saturate':
                            out.data[ii+0] = ibuf[x*3+0] > 255 ? 255 : ibuf[x*3+0];
                            out.data[ii+1] = ibuf[x*3+1] > 255 ? 255 : ibuf[x*3+1];
                            out.data[ii+2] = ibuf[x*3+2] > 255 ? 255 : ibuf[x*3+2];
                            out.data[ii+3] = abuf[x];
                            break;
                    }
                }

                png_filter_rapid_lum(out.data, ow, oh);

                out.pack().pipe(fs.createWriteStream('./test.png'));
                cb();
            }
        };}(i));
        fetch_queue_count++;
    }
    console.log('fetch queue count is', fetch_queue_count);
};

function png_filter_rapid_lum(pixels, w, h) {
    var cc = 4;

    function geti(x, y) {
        return x + y * w;
    }

    function gpv(i) {
        if (pixels[i*cc+3] < 255) {
            return 0;
        }
        return Math.pow(pixels[i*cc+0], 2) + Math.pow(pixels[i*cc+1], 2) + Math.pow(pixels[i*cc+2], 2);
    }
    
    function chchg(ia, ib) {
        if (ia >= w * h) return false;
        if (ib >= w * h) return false;
        if (gpv(ia) / gpv(ib) > 5) {
            return true;
        } 
        return false;
    }

    var kmap = new Uint8Array(w * h);

    for (var x = 0; x < w; ++x) {
        for (var y = 0; y < h; ++y) {
            var i = geti(x, y);
            var offs = [
                [1, 0], [-1, 0],
                [1, 1], [0, 1], [-1, 1],
                [1, -1], [0, -1], [-1, -1]
            ];

            var keep = false;
            for (var z = 0; z < offs.length; ++z) {
                keep = chchg(i, geti(x + offs[z][0], y + offs[z][1]));
                if (keep) 
                    break;
            }
            kmap[i] = keep ? 1 : 0;
        }
    }

    for (var i = 0; i < w * h; ++i) {
        pixels[i*cc+0] = 255;
        if (kmap[i] == 0) {
            pixels[i*cc+0] = 0;
            pixels[i*cc+1] = 0;
            pixels[i*cc+2] = 0;
            pixels[i*cc+3] = 0;
        }
    }
}

/*
read_image('./P1020825.png', function (err, w, h, pixels, png) {
    console.log('running filter');
    png_filter_rapid_lum(pixels, w, h);
    var out = new png({
        width:       w,
        height:      h,
        filterType:  -1
    });
    console.log('copying in memory');
    for (var i = 0; i < w * h * 3; ++i) {
        out.data[i] = pixels[i];
    }
    out.pack().pipe(fs.createWriteStream('./test.png'));
});
*/
/*
new Maacs({ type: 'json', path: 'master.json' }, function (state) {
    //
    //  Make sure to compute the realignment vectors.
    //
    state.for_each_view(function (id, view) {
        var realign = state.compute_image_radec_alignment(id);
        view.setdata(0, 'realign', realign);
    }, function () {
        state.render_sky_all({
            red_low_threshold:      -1,
            green_low_threshold:    -1,
            blue_low_threshold:     -1,
            finalblendmode:         'color-channel-saturate',
            immedblendmode:         'replace-brightest'
        }, function () { console.log('done'); });
    });
    
      
});
*/




