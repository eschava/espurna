/*

ESP8266 file system builder

Copyright (C) 2016-2018 by Xose Pérez <xose dot perez at gmail dot com>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

/*eslint quotes: ['error', 'single']*/
/*eslint-env es6*/

// -----------------------------------------------------------------------------
// Dependencies
// -----------------------------------------------------------------------------

const gulp = require('gulp');
const runSequence = require('run-sequence');
const through = require('through2');

const htmlmin = require('gulp-htmlmin');
const uglify = require('gulp-uglify');
const inline = require('gulp-inline');
const inlineImages = require('gulp-css-base64');
const favicon = require('gulp-base64-favicon');
const crass = require('gulp-crass');

const htmllint = require('gulp-htmllint');
const csslint = require('gulp-csslint');

const rename = require('gulp-rename');
const replace = require('gulp-replace');
const remover = require('gulp-remove-code');
const gzip = require('gulp-gzip');
const path = require('path');

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const htmlFolder = 'html/';
const configFolder = 'espurna/config/';
const dataFolder = 'espurna/data/';
const staticFolder = 'espurna/static/';

// -----------------------------------------------------------------------------
// Methods
// -----------------------------------------------------------------------------

var toHeader = function(name, debug) {

    return through.obj(function (source, encoding, callback) {

        var parts = source.path.split(path.sep);
        var filename = parts[parts.length - 1];
        var safename = name || filename.split('.').join('_');

        // Generate output
        var output = '';
        output += '#define ' + safename + '_len ' + source.contents.length + '\n';
        output += 'const uint8_t ' + safename + '[] PROGMEM = {';
        for (var i=0; i<source.contents.length; i++) {
            if (i > 0) { output += ',' };
            if (0 === (i % 20)) { output += '\n' };
            output += '0x' + ('00' + source.contents[i].toString(16)).slice(-2);
        }
        output += '\n};';

        // clone the contents
        var destination = source.clone();
        destination.path = source.path + '.h';
        destination.contents = Buffer.from(output);

        if (debug) {
            console.info('Image ' + filename + ' \tsize: ' + source.contents.length + ' bytes');
        }

        callback(null, destination);

    });

};

var htmllintReporter = function(filepath, issues) {
    if (issues.length > 0) {
        issues.forEach(function (issue) {
            console.info(
                '[gulp-htmllint] ' +
                filepath + ' [' +
                issue.line + ',' +
                issue.column + ']: ' +
                '(' + issue.code + ') ' +
                issue.msg
            );
        });
        process.exitCode = 1;
    }
};

var buildWebUI = function(module) {

    var modules = {'light': false, 'sensor': false, 'rfbridge': false, 'rfm69': false};
    if ('all' === module) {
        modules['light'] = true;
        modules['sensor'] = true;
        modules['rfbridge'] = true;
        modules['rfm69'] = false;   // we will never be adding this except when building RFM69GW
    } else if ('small' !== module) {
        modules[module] = true;
    }

    return gulp.src(htmlFolder + '*.html').
        pipe(htmllint({
            'failOnError': true,
            'rules': {
                'id-class-style': false,
                'label-req-for': false,
            }
        }, htmllintReporter)).
        pipe(favicon()).
        pipe(inline({
            base: htmlFolder,
            js: [],
            css: [crass, inlineImages],
            disabledTypes: ['svg', 'img']
        })).
        pipe(remover(modules)).
        pipe(htmlmin({
            collapseWhitespace: true,
            removeComments: true,
            minifyCSS: true,
            minifyJS: true
        })).
        pipe(replace('pure-', 'p-')).
        pipe(gzip()).
        pipe(rename('index.' + module + '.html.gz')).
        pipe(gulp.dest(dataFolder)).
        pipe(toHeader('webui_image', true)).
        pipe(gulp.dest(staticFolder));

};

// -----------------------------------------------------------------------------
// Tasks
// -----------------------------------------------------------------------------

gulp.task('certs', function() {
    gulp.src(dataFolder + 'server.*').
        pipe(toHeader(debug=false)).
        pipe(gulp.dest(staticFolder));
});

gulp.task('csslint', function() {
    gulp.src(htmlFolder + '*.css').
        pipe(csslint({ids: false})).
        pipe(csslint.formatter());
});

gulp.task('webui_small', function() {
    return buildWebUI('small');
});

gulp.task('webui_sensor', function() {
    return buildWebUI('sensor');
});

gulp.task('webui_light', function() {
    return buildWebUI('light');
});

gulp.task('webui_rfbridge', function() {
    return buildWebUI('rfbridge');
});

gulp.task('webui_rfm69', function() {
    return buildWebUI('rfm69');
});

gulp.task('webui_all', function() {
    return buildWebUI('all');
});

gulp.task('webui', function(cb) {
    runSequence([
        'webui_small',
        'webui_sensor',
        'webui_light',
        'webui_rfbridge',
        'webui_rfm69',
        'webui_all'
    ], cb);
});

gulp.task('default', ['webui']);
