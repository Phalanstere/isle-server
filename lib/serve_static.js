'use strict';

/*!
 * serve-static
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 *
 * Used as an answer to:
 *   http://stackoverflow.com/questions/26388122
 */

// MODULES //

var escapeHtml = require( 'escape-html' );
var merge = require( 'utils-merge' );
var parseurl = require( 'parseurl' );
var resolve = require( 'path' ).resolve;
var send = require( 'send' );
var url = require( 'url' );
var Lesson = require( './lesson.js' );
var Namespace = require( './namespace.js' );


// VARIABLES //

var PATH_REGEXP = /^\/([^\/]*)\/([^\/]*)\//i;

/**
 * @param {String} root
 * @param {Object} options
 * @return {Function}
 * @api public
 */
exports = module.exports = function serveStatic(root, options) {
	if ( !root ) {
		throw new TypeError('root path required')
	}

	if ( typeof root !== 'string' ) {
		throw new TypeError( 'root path must be a string' )
	}

	// copy options object
	options = merge( {}, options );

	// resolve root to absolute
	root = resolve( root );

	// default redirect
	var redirect = options.redirect !== false;

	// headers listener
	var setHeaders = options.setHeaders;
	delete options.setHeaders;

	if ( setHeaders && typeof setHeaders !== 'function' ) {
		throw new TypeError( 'option setHeaders must be function' );
	}

	// setup options for send
	options.maxage = options.maxage || options.maxAge || 0;
	options.root = root;

	return function serveStatic(req, res, next) {
		if ( req.method !== 'GET' && req.method !== 'HEAD' ) {
			return next()
		}
		var matches = req.path.match( PATH_REGEXP );
		if ( matches && matches.length >= 2 && req.path.endsWith( '/' ) ) {
			var namespace = decodeURIComponent( matches[ 1 ] );
			var lessonName = decodeURIComponent( matches[ 2 ] );
			Namespace.findOne({ title: namespace }, function( err, namespace ) {
				if ( err ) {
					return next();
				}
				Lesson.findOne({ namespace: namespace, title: lessonName }, function( err, lesson ) {
					if ( err ) {
						return next();
					}
					if ( lesson && lesson.active === false ) {
						return res.redirect( '/forbidden.html' );
					}
					runner();
				});
			});
		} else {
			runner();
		}

		function runner() {
			var opts = merge({}, options)
			var originalUrl = parseurl.original(req)
			var path = parseurl(req).pathname
			var hasTrailingSlash = originalUrl.pathname[originalUrl.pathname.length - 1] === '/'

			if (path === '/' && !hasTrailingSlash) {
			// make sure redirect occurs at mount
			path = ''
			}

			// create send stream
			var stream = send(req, path, opts)

			if (redirect) {
			// redirect relative to originalUrl
			stream.on('directory', function redirect() {
				if (hasTrailingSlash) {
				return next()
				}

				originalUrl.pathname += '/'

				var target = url.format(originalUrl)

				res.statusCode = 303
				res.setHeader('Content-Type', 'text/html; charset=utf-8')
				res.setHeader('Location', target)
				res.end('Redirecting to <a href="' + escapeHtml(target) + '">' + escapeHtml(target) + '</a>\n')
			})
			} else {
			// forward to next middleware on directory
			stream.on('directory', next)
			}

			// add headers listener
			if (setHeaders) {
			stream.on('headers', setHeaders)
			}

			// forward non-404 errors
			stream.on('error', function error(err) {
				next(err.status === 404 ? null : err)
			});

			// pipe
			stream.pipe(res)
		}
	}
};

/**
 * Expose mime module.
 *
 * If you wish to extend the mime table use this
 * reference to the "mime" module in the npm registry.
 */
exports.mime = send.mime;
